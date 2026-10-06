import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationTarget } from '../src/notifications/notificationTarget.ts'

test('request notifications open the correct inbox and switch private context to an existing expert capability', () => {
  assert.deepEqual(notificationTarget({ type: 'request:new', href: '/dashboard' }, { role: 'provider', roles: ['user', 'provider'], activeContext: 'user' }), { href: '/dashboard/provider/inbox', context: 'provider' })
  assert.deepEqual(notificationTarget({ type: 'request:status', href: '/dashboard' }, { role: 'user', roles: ['user'] }), { href: '/dashboard/user/requests', context: undefined })
})
test('company invitations use the existing expert profile and accepted invitations use company team', () => {
  assert.deepEqual(notificationTarget({ type: 'company:invitation', href: '/dashboard/provider/profile' }, { role: 'provider', roles: ['user', 'provider'], activeContext: 'user' }), { href: '/dashboard/provider/profile', context: 'provider' })
  assert.equal(notificationTarget({ type: 'company:invitation-accepted', href: '/dashboard/company/experts' }, { role: 'company', roles: ['user', 'company'], activeContext: 'user' }).context, 'company')
})
