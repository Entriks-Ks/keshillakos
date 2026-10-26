import assert from 'node:assert/strict'
import test from 'node:test'
import { chatWithAssistant } from '../src/services/aiChatService'

test('AI chat returns helpful fallback guidance for business registration in Kosovo', async () => {
  const result = await chatWithAssistant([
    { role: 'user', content: 'Si të hap një biznes në Kosovë (Sh.p.k.)?' },
  ])

  assert.ok(result.reply.includes('ARBK'), 'Reply should mention ARBK')
  assert.ok(result.reply.includes('Sh.p.k.'), 'Reply should mention Sh.p.k.')
  assert.ok(Array.isArray(result.suggestedActions), 'Suggested actions should be an array')
  assert.ok(result.suggestedActions.length > 0, 'Should have suggested actions')
  assert.ok(Array.isArray(result.recommendedEntities), 'Recommended entities should be an array')
})

test('AI chat returns tax information for Kosovo when queried about ATK/TVSH', async () => {
  const result = await chatWithAssistant([
    { role: 'user', content: 'Cilat janë normat e TVSH-së dhe taksave në ATK?' },
  ])

  assert.ok(result.reply.includes('18%') || result.reply.includes('TVSH'), 'Reply should mention TVSH')
  assert.ok(result.suggestedActions.length > 0, 'Should have suggested actions')
})

test('AI chat handles general greeting warmly', async () => {
  const result = await chatWithAssistant([
    { role: 'user', content: 'Përshëndetje! Çfarë bën ti?' },
  ])

  assert.ok(result.reply.includes('Këshilla AI') || result.reply.includes('KeshillaKos'), 'Reply should identify as Këshilla AI')
  assert.ok(result.suggestedActions.length > 0, 'Should propose options')
})
