import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeMarketplaceLink,
  getAccountMenu,
  marketplaceLink,
  userDisplayName,
} from '../src/utils/siteNavMenu.ts'

const labels = (items) => items.map((item) => item.label)

test('private user sees profile and dashboard only', () => {
  const menu = getAccountMenu({ role: 'user', roles: ['user'] })
  assert.deepEqual(labels(menu), ['menu.myProfile', 'menu.myDashboard'])
  assert.deepEqual(menu.map((item) => item.to), ['/dashboard/user/profile', '/dashboard/user'])
})

test('expert context gets offers, messages and settings', () => {
  const menu = getAccountMenu({ role: 'provider', roles: ['user', 'provider'], activeContext: 'provider' })
  assert.deepEqual(labels(menu), ['menu.myProfile', 'menu.myDashboard', 'menu.myOffers', 'menu.messages', 'menu.settings'])
  assert.equal(menu.find((item) => item.id === 'offers').to, '/dashboard/provider/services')
})

test('company context gets company profile and team', () => {
  const menu = getAccountMenu({ role: 'company', roles: ['user', 'company'], activeContext: 'company' })
  assert.deepEqual(labels(menu), [
    'menu.companyProfile',
    'menu.myDashboard',
    'menu.myOffers',
    'menu.experts',
    'menu.messages',
    'menu.settings',
  ])
  assert.equal(menu.find((item) => item.id === 'team').to, '/dashboard/company/experts')
})

test('superadmin gets admin panel and settings', () => {
  const menu = getAccountMenu({ role: 'admin', roles: ['admin'] })
  assert.deepEqual(labels(menu), ['menu.adminDashboard', 'menu.settings'])
  assert.deepEqual(menu.map((item) => item.to), ['/dashboard/admin', '/dashboard/admin/settings'])
})

test('expert who switched to private context gets the private menu', () => {
  const menu = getAccountMenu({ role: 'provider', roles: ['user', 'provider'], activeContext: 'user' })
  assert.deepEqual(labels(menu), ['menu.myProfile', 'menu.myDashboard'])
})

test('active marketplace link follows the localised marketplace path', () => {
  assert.equal(activeMarketplaceLink('/sherbime'), 'services')
  assert.equal(activeMarketplaceLink('/sherbime/'), 'services')
  assert.equal(activeMarketplaceLink('/en/experts'), 'experts')
  assert.equal(activeMarketplaceLink('/de/unternehmen'), 'companies')
  assert.equal(activeMarketplaceLink('/kompani'), 'companies')
  assert.equal(activeMarketplaceLink('/de/dienstleistungen/beratung-abc123'), 'services')
  assert.equal(activeMarketplaceLink('/'), null)
  assert.equal(activeMarketplaceLink('/rreth-nesh'), null)
  assert.equal(activeMarketplaceLink('/dashboard/user'), null)
})

test('marketplace links expose i18n keys and localised paths', () => {
  assert.equal(marketplaceLink('services').label, 'offers.services')
  assert.equal(marketplaceLink('experts').label, 'offers.experts')
  assert.equal(marketplaceLink('companies').label, 'offers.companies')
  assert.equal(marketplaceLink('companies', 'sq').to, '/kompani')
  assert.equal(marketplaceLink('experts', 'en').to, '/en/experts')
  assert.equal(marketplaceLink('services', 'de').to, '/de/dienstleistungen')
})

test('display name prefers first and last name', () => {
  assert.equal(userDisplayName({ name: 'arben k', firstName: 'Arben', lastName: 'Krasniqi' }), 'Arben Krasniqi')
  assert.equal(userDisplayName({ name: 'Ledgerline' }), 'Ledgerline')
  assert.equal(userDisplayName({ name: '' }), '')
})
