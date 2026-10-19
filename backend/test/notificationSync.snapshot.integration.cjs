// Automated event/race replay using captured REAL backend history. No generated notification content.
// This is not a live cross-device mutation test. See notificationSync.real.integration.cjs for that.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events')
const snapshot=process.env.KESHILLAKOS_NOTIFICATION_SNAPSHOT
const root=path.resolve(__dirname,'../..'),mobile=process.env.KESHILLAKOS_MOBILE_ROOT||path.resolve(root,'../keshillakos-mobile/mobile-app')
const ts=require(root+'/frontend/node_modules/typescript')
function load(file,isMobile){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Date,Map,Set,Number,require:name=>isMobile&&name==='./i18n'?require(mobile+'/test/i18nFixture.cjs'):{}});return module.exports}
const runtimes={web:load(root+'/frontend/src/notifications/notificationStore.ts'),mobile:load(mobile+'/src/notificationState.ts',true)}
const tick=()=>new Promise(resolve=>setImmediate(resolve))
for(const [platform,runtime]of Object.entries(runtimes))test(`${platform}: real-history replay invalidates stale responses for every socket action and reconnect`,{skip:!snapshot},async()=>{
 const page=JSON.parse(fs.readFileSync(snapshot,'utf8'))[0]
 assert.ok(page.notifications.length>1,'requires captured real history')
 let calls=0,hold=false,release
 const api={list:async()=>{calls++;if(hold){hold=false;return new Promise(resolve=>{release=()=>resolve(page)})}return page},read:async()=>({unreadCount:page.unreadCount}),clear:async()=>{throw Error('Non-destructive test')},remove:async()=>{throw Error('Non-destructive test')}}
 const store=runtime.createNotificationStore(api),socket=new EventEmitter(),unbind=runtime.bindNotificationSocket(socket,store)
 await store.load()
 for(const event of ['connect','notification:new','notification:read','notification:count','notification:deleted','notification:cleared']){
  const before=calls
  hold=true;const pending=store.load()
  socket.emit(event,{id:page.notifications[0].id,unreadCount:99999})
  release();await pending
  assert.ok(calls>=before+2,event+' must invalidate the in-flight history request')
  assert.equal(store.snapshot().unreadCount,page.unreadCount,'unversioned event count must never replace backend count')
  assert.equal(new Set(store.snapshot().notifications.map(n=>n.id)).size,store.snapshot().notifications.length)
 }
 const before=calls
 socket.emit('notification:new',{type:'message:new'})
 assert.equal(calls,before,'chat events do not inflate bell notifications')
 unbind();socket.emit('notification:read',{})
 assert.equal(calls,before,'cleanup removes every listener')
 assert.equal(await store.remove(page.notifications[0].id),false)
 assert.equal(store.snapshot().notifications.length,page.notifications.length,'failed deletion retains actual backend history')
 assert.equal(store.snapshot().error,'notifications.delete.error')
 store.dispose()
})
for(const [platform,runtime]of Object.entries(runtimes))test(`${platform}: refreshing loaded pages retains and reconciles real older rows`,{skip:!snapshot},async()=>{
 const original=JSON.parse(fs.readFileSync(snapshot,'utf8'))[0]
 const middle=Math.ceil(original.notifications.length/2)
 assert.ok(middle>0)
 const calls=[]
 const store=runtime.createNotificationStore({list:async page=>{calls.push(page);return {...original,page,hasMore:page===1,notifications:page===1?original.notifications.slice(0,middle):original.notifications.slice(middle)}},read:async()=>({unreadCount:original.unreadCount}),clear:async()=>{throw Error('Not allowed')},remove:async()=>{throw Error('Not allowed')}})
 await store.load();await store.load(true)
 const before=store.snapshot().notifications.map(n=>n.id).join()
 await store.load()
 assert.equal(calls.slice(-2).join(), '1,2')
 assert.equal(store.snapshot().notifications.map(n=>n.id).join(),before)
 assert.equal(store.snapshot().notifications.length,original.notifications.length)
})
for(const [platform,runtime]of Object.entries(runtimes))test(`${platform}: post-commit unknown counts reconcile without fabricating a badge or reporting mutation failure`,{skip:!snapshot},async()=>{
 const page=JSON.parse(fs.readFileSync(snapshot,'utf8'))[0]
 let calls=0
 const store=runtime.createNotificationStore({list:async()=>{calls++;return page},read:async()=>({unreadCount:null,requiresSync:true}),clear:async()=>{throw Error('Not allowed')},remove:async()=>{throw Error('Not allowed')}})
 await store.load()
 assert.equal(await store.read(page.notifications[0].id),true)
 await tick()
 assert.ok(calls>=2)
 assert.equal(store.snapshot().unreadCount,page.unreadCount)
 assert.equal(store.snapshot().error,'')
})
test('mobile: actual notification rows require a translated confirmation before individual deletion',{skip:!snapshot},async()=>{
 const page=JSON.parse(fs.readFileSync(snapshot,'utf8'))[0],i18n=require(mobile+'/test/i18nFixture.cjs'),React=require(mobile+'/node_modules/react')
 const file=fs.readFileSync(mobile+'/test/notifications.test.cjs','utf8')
 const harness=file.slice(file.indexOf('function renderScreen('),file.indexOf("test('screen renders skeleton"))
 const module={exports:{}}
 vm.runInNewContext(harness+'\nmodule.exports={renderScreen,nodes}',{module,exports:module.exports,i18n,require:require('node:module').createRequire(mobile+'/test/notifications.test.cjs'),path,React,__dirname:mobile+'/test',...runtimes.mobile})
 const previous=i18n.getLanguage()
 try{for(const language of ['sq','en','de']){
  i18n.activateLanguage(language)
  let calls=0
  const screen=module.exports.renderScreen({...page,loaded:true,loading:false,reading:null,error:'',reload:async()=>{},deleteNotification:async()=>{calls++;return false}})
  const list=module.exports.nodes(screen.tree,'List')[0]
  const row=list.props.renderItem({item:page.notifications[0]})
  const button=module.exports.nodes(row,'Button').find(n=>n.props.accessibilityLabel===i18n.t('notifications.delete.accessibility',{title:i18n.uiMessage(page.notifications[0].title)}))
  assert.ok(button)
  button.props.onPress()
  assert.equal(calls,0)
  assert.equal(screen.alerts[0][0],i18n.t('notifications.delete.confirmTitle'))
  assert.equal(screen.alerts[0][1],i18n.t('notifications.delete.confirmMessage'))
  assert.equal(screen.alerts[0][2][0].style,'cancel')
  assert.equal(screen.alerts[0][2][1].style,'destructive')
  screen.alerts[0][2][1].onPress();await tick()
  assert.equal(calls,1)
 }}finally{i18n.activateLanguage(previous)}
})
