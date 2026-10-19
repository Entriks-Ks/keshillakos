import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as jsx from 'react/jsx-runtime'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Dropdown as HeroDropdown, buttonVariants } from '@heroui/react'
import { Bell } from 'lucide-react'
import sq from '../src/i18n/locales/sq.ts'
import en from '../src/i18n/locales/en.ts'
import de from '../src/i18n/locales/de.ts'
const source = fs.readFileSync(new URL('../src/notifications/NotificationBell.tsx', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  return [...(tree.type === type ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap(n => nodes(n, type))]
}
function fixture(locale, success) {
  const slots = []; let cursor = 0, calls = 0
  const state = { notifications: [{ id: 'one', type: 'request:new', title: 'Request', body: '', createdAt: '2026-10-19', readAt: null }], unreadCount: 1, loaded: true, loading: false, reading: null, error: '', hasMore: false,
    clearNotifications: async () => { calls++; if (!success) { state.error = 'notifications.clear.error'; return false }; state.notifications = []; state.unreadCount = 0; return true } }
  const t = key => key.split('.').reduce((a,k) => a?.[k], locale) || key
  const module = { exports: {} }
  const Modal = Object.assign(() => {}, Object.fromEntries(['Backdrop','Container','Dialog','Header','Heading','Body','Footer'].map(k => [k, k])))
  const Dropdown = Object.assign(() => {}, { Trigger: 'Trigger', Popover: 'Popover' })
  const deps = { 'react/jsx-runtime': jsx, react: { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value }] } }, 'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
    '../auth/AuthContext': { useAuth: () => ({ user: { uid: 'me' } }) }, './notificationTarget': {}, '@heroui/react': { Button: 'Button', Modal, Dropdown, buttonVariants }, 'lucide-react': { Bell: 'Bell' }, 'react-router-dom': { useNavigate: () => () => {} }, './NotificationProvider': { useNotifications: () => state }, './Notifications.css': {} }
  vm.runInNewContext(js, { module, exports: module.exports, require: name => deps[name] })
  return { render: () => { cursor = 0; return module.exports.default() }, calls: () => calls, Modal, t }
}
for (const [language, locale] of Object.entries({ sq, en, de })) for (const success of [true,false]) test(`${language}: web clear requires confirmation and only shows success after deletion=${success}`, async () => {
  const f = fixture(locale, success)
  let tree = f.render()
  const clearLabel = f.t('notifications.clear.action')
  const clearMenu = nodes(tree,'Button').find(n => n.props.children === clearLabel)
  clearMenu.props.onPress(); tree = f.render()
  assert.equal(nodes(tree,f.Modal)[0].props.isOpen, true)
  assert.equal(f.calls(), 0)
  assert.ok(nodes(tree,'Heading').some(n => n.props.children === f.t('notifications.clear.confirmTitle')))
  const confirm = nodes(tree,'Button').filter(n => n.props.children === clearLabel).at(-1)
  confirm.props.onPress(); await new Promise(resolve => setImmediate(resolve)); tree = f.render()
  assert.equal(f.calls(), 1)
  assert.equal(nodes(tree,f.Modal)[0].props.isOpen, !success)
  assert.equal(nodes(tree,'p').some(n => n.props.role === 'status' && n.props.children === f.t('notifications.clear.success')), success)
  if (!success) assert.ok(nodes(tree,'p').some(n => n.props.role === 'alert' && n.props.children === f.t('notifications.clear.error')))
  else assert.ok(nodes(tree,'strong').some(n => n.props.children === f.t('notifications.emptyTitle')))
})


test('notification trigger renders one accessible button with the real HeroUI/React Aria components', () => {
  const f = fixture(en, true)
  const trigger = nodes(f.render(), 'Trigger')[0]
  const [icon, badge] = trigger.props.children
  // Render the actual library trigger rather than a button-shaped fixture.
  const html = renderToString(createElement(HeroDropdown, null,
    createElement(HeroDropdown.Trigger, { ...trigger.props, children: undefined },
      createElement(Bell, icon.props), badge)))
  assert.equal((html.match(/<button\b/g) || []).length, 1)
  assert.equal(nodes(trigger, 'Button').length, 0)
  assert.match(html, /aria-haspopup="true"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-label="Notifications,/)
  assert.match(html, /button--ghost/)
  assert.match(html, /button--icon-only/)
  assert.match(html, /kk-notification-bell/)
  assert.match(html, /<svg/)
  assert.match(html, /kk-notification-count/)
})
