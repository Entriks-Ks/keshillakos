// Uses actual notification history and the actual authenticated HTTP/Socket.IO backend.
// Never creates notifications. Read-only by default. Mutations require explicit opt-in and disposable history.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const backend = path.resolve(__dirname,'..'), web = path.resolve(backend,'../frontend'), mobile = process.env.KESHILLAKOS_MOBILE_ROOT || path.resolve(backend,'../../keshillakos-mobile/mobile-app')
const ts = require(web+'/node_modules/typescript')
const ioWeb = require(web+'/node_modules/socket.io-client').io, ioMobile = require(mobile+'/node_modules/socket.io-client').io
const origin = process.env.KESHILLAKOS_NOTIFICATION_API_URL, token = process.env.KESHILLAKOS_NOTIFICATION_TOKEN
const allowMutations = process.env.KESHILLAKOS_NOTIFICATION_ALLOW_MUTATIONS === '1'
const tick = () => new Promise(resolve => setTimeout(resolve,30))
async function until(check,label) { const end=Date.now()+10000; while(Date.now()<end){if(check())return;await tick()} assert.fail('Timed out: '+label) }
function moduleStore(file, mobileRuntime=false) {
 const module={exports:{}}
 const i18n=mobileRuntime ? require(mobile+'/test/i18nFixture.cjs') : {}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Date,Map,Set,Number,require:name=>name==='./i18n'?i18n:{}})
 return module.exports
}
const modules=[moduleStore(web+'/src/notifications/notificationStore.ts'),moduleStore(mobile+'/src/notificationState.ts',true)]
function apiFor(authToken) {
 let lists=0
 const request=async(method,path='')=>{const response=await fetch(origin+'/api/notifications'+path,{method,headers:{Authorization:'Bearer '+authToken}});assert.equal(response.status,200,method+' '+path);return response.json()}
 return {listCalls:()=>lists,list:page=>{lists++;return request('GET','?page='+page)},read:id=>request('PATCH',id?'/'+encodeURIComponent(id)+'/read':'/read-all'),remove:id=>request('DELETE','/'+encodeURIComponent(id)),clear:()=>request('DELETE')}
}
async function clients() {
 const api=apiFor(token),adapters=modules.map(()=>apiFor(token)),stores=modules.map((m,i)=>m.createNotificationStore(adapters[i])),sockets=[ioWeb,ioMobile].map(io=>io(origin,{path:'/socket.io',auth:{token},autoConnect:false,transports:['websocket']}))
 const cleanups=sockets.map((socket,i)=>modules[i].bindNotificationSocket(socket,stores[i]))
 sockets.forEach(socket=>socket.connect())
 try {await until(()=>sockets.every(s=>s.connected),'authenticated web/mobile socket connections');await until(()=>stores.every(s=>s.snapshot().loaded&&!s.snapshot().loading),'initial history')}
 catch(error){sockets.forEach(s=>s.disconnect());throw error}
 return {api,adapters,stores,sockets,close:()=>{cleanups.forEach(fn=>fn());sockets.forEach(s=>s.disconnect());stores.forEach(s=>s.dispose())}}
}
function ids(store){return Array.from(store.snapshot().notifications,n=>n.id).sort()}
function readStates(rows){return JSON.stringify(Array.from(rows,n=>[n.id,n.readAt||null]).sort((a,b)=>a[0].localeCompare(b[0])))}
async function matchesBackend(c) {
 const latest=await c.api.list(1)
 await until(()=>c.stores.every(s=>!s.snapshot().loading&&s.snapshot().unreadCount===latest.unreadCount&&readStates(s.snapshot().notifications)===readStates(latest.notifications)),'both clients match backend')
 for(const store of c.stores) assert.equal(new Set(ids(store)).size,ids(store).length)
 return latest
}
test('real authenticated web/mobile clients reconcile existing backend history after disconnect/reconnect (no writes)',{skip:!origin||!token},async()=>{
 const c=await clients()
 try {
  const before=await matchesBackend(c)
  assert.ok(before.notifications.length,'requires real existing notifications')
  const mobileBefore=c.adapters[1].listCalls()
  c.sockets[1].disconnect();c.sockets[1].connect()
  await until(()=>c.sockets[1].connected,'mobile reconnect');await until(()=>c.adapters[1].listCalls()>mobileBefore,'mobile reconnect refresh');await matchesBackend(c)
  c.sockets[0].disconnect();c.sockets[0].connect()
  await until(()=>c.sockets[0].connected,'web reconnect');await matchesBackend(c)
 } finally {c.close()}
})
test('real web-to-mobile and mobile-to-web reads/deletes/clears and missed offline updates',{skip:!origin||!token||!allowMutations},async()=>{
 const c=await clients()
 try {
  const before=await matchesBackend(c)
  assert.ok(before.notifications.length>=4,'requires at least four real disposable notifications; this test never creates content')
  const [first,second,third]=before.notifications
  for(const store of c.stores){assert.equal(await store.read(first.id),true);await matchesBackend(c);assert.equal(await store.read(),true);await matchesBackend(c)}
  await Promise.all([c.stores[0].read(first.id),c.stores[1].read()]);await matchesBackend(c)
  assert.equal(await c.stores[0].remove(first.id),true);await matchesBackend(c)
  assert.equal(await c.stores[1].remove(second.id),true);await matchesBackend(c)
  assert.ok((await Promise.all([c.stores[0].remove(second.id),c.stores[1].remove(second.id)])).every(Boolean));await matchesBackend(c)
  c.sockets[1].disconnect()
  assert.equal(await c.stores[0].remove(third.id),true)
  await until(()=>!c.stores[0].snapshot().loading,'web deletion reconciliation')
  assert.ok(ids(c.stores[1]).includes(third.id),'offline client retains its last state before reconnection')
  c.sockets[1].connect();await until(()=>c.sockets[1].connected,'offline mobile reconnect');await matchesBackend(c)
  assert.equal(await c.stores[1].clear(),true);await matchesBackend(c)
  assert.equal(c.stores[0].snapshot().unreadCount,0)
  assert.equal(c.stores[0].snapshot().notifications.length,0)
  const mobileCalls=c.adapters[1].listCalls()
  assert.equal(await c.stores[0].clear(),true);await until(()=>c.adapters[1].listCalls()>mobileCalls,'web clear event reaches mobile');await matchesBackend(c)
 } finally {c.close()}
})
