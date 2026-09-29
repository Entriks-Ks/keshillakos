import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeMarketplaceLink,
  getAccountMenu,
  userDisplayName,
} from '../src/utils/siteNavMenu.ts'

const labels = (items) => items.map((item) => item.label)

test('private user sees profile and dashboard only', () => {
  const menu = getAccountMenu({ role: 'user', roles: ['user'] })
  assert.deepEqual(labels(menu), ['Profili im', 'Paneli im'])
  assert.deepEqual(menu.map((item) => item.to), ['/dashboard/user/profile', '/dashboard/user'])
})

test('expert context gets offers, messages and settings', () => {
  const menu = getAccountMenu({ role: 'provider', roles: ['user', 'provider'], activeContext: 'provider' })
  assert.deepEqual(labels(menu), ['Profili im', 'Paneli im', 'Ofertat e mia', 'Mesazhet', 'Cilësimet'])
  assert.equal(menu.find((item) => item.id === 'offers').to, '/dashboard/provider/services')
})

test('company context gets company profile and team', () => {
  const menu = getAccountMenu({ role: 'company', roles: ['user', 'company'], activeContext: 'company' })
  assert.deepEqual(labels(menu), [
    'Profili i kompanisë',
    'Paneli im',
    'Ofertat e mia',
    'Ekspertët',
    'Mesazhet',
    'Cilësimet',
  ])
  assert.equal(menu.find((item) => item.id === 'team').to, '/dashboard/company/experts')
})

test('superadmin gets admin panel and settings', () => {
  const menu = getAccountMenu({ role: 'admin', roles: ['admin'] })
  assert.deepEqual(labels(menu), ['Paneli administrativ', 'Cilësimet'])
  assert.deepEqual(menu.map((item) => item.to), ['/dashboard/admin', '/dashboard/admin/settings'])
})

test('expert who switched to private context gets the private menu', () => {
  const menu = getAccountMenu({ role: 'provider', roles: ['user', 'provider'], activeContext: 'user' })
  assert.deepEqual(labels(menu), ['Profili im', 'Paneli im'])
})

test('active marketplace link follows the ofertat tab', () => {
  assert.equal(activeMarketplaceLink('/ofertat', ''), 'services')
  assert.equal(activeMarketplaceLink('/ofertat/', '?sort=rating'), 'services')
  assert.equal(activeMarketplaceLink('/ofertat', '?tab=experts&q=x'), 'experts')
  assert.equal(activeMarketplaceLink('/ofertat', '?tab=companies'), 'companies')
  assert.equal(activeMarketplaceLink('/services/abc', ''), 'services')
  assert.equal(activeMarketplaceLink('/', ''), null)
  assert.equal(activeMarketplaceLink('/rreth-nesh', '?tab=experts'), null)
})

test('display name prefers first and last name', () => {
  assert.equal(userDisplayName({ name: 'arben k', firstName: 'Arben', lastName: 'Krasniqi' }), 'Arben Krasniqi')
  assert.equal(userDisplayName({ name: 'Ledgerline' }), 'Ledgerline')
  assert.equal(userDisplayName({ name: '' }), '')
})
