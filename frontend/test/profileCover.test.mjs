import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_COVER_VARIANTS, defaultCoverGlow, defaultCoverVariant } from '../src/components/coverVariants.ts'

test('an account always gets the same default cover', () => {
  const uid = '25jnxxPJwyVb3Qe7kLm9'
  const first = defaultCoverVariant(uid)
  for (let i = 0; i < 5; i += 1) assert.equal(defaultCoverVariant(uid), first)
  assert.ok(Number.isInteger(first) && first >= 0 && first < DEFAULT_COVER_VARIANTS)
})

test('accounts are spread across every default cover instead of sharing one', () => {
  const used = new Map()
  for (let i = 0; i < 600; i += 1) {
    const variant = defaultCoverVariant(`uid-${i}-${(i * 7919).toString(36)}`)
    used.set(variant, (used.get(variant) ?? 0) + 1)
  }
  assert.equal(used.size, DEFAULT_COVER_VARIANTS, 'every design is used')
  for (const count of used.values()) assert.ok(count > 50, `no design is starved (got ${count} of 600)`)
})

test('an empty seed still resolves to a valid design', () => {
  const variant = defaultCoverVariant('')
  assert.ok(variant >= 0 && variant < DEFAULT_COVER_VARIANTS)
})

test('the glow and angle are fixed per account and tell same-design accounts apart', () => {
  assert.deepEqual(defaultCoverGlow('account-a'), defaultCoverGlow('account-a'))
  const looks = new Set()
  for (let i = 0; i < 200; i += 1) {
    const glow = defaultCoverGlow(`uid-${i}`)
    assert.ok(glow.x >= 8 && glow.x <= 92 && glow.angle >= 95 && glow.angle < 265)
    looks.add(`${defaultCoverVariant(`uid-${i}`)}:${glow.angle}`)
  }
  assert.ok(looks.size > 180, `almost every account gets its own look (${looks.size} of 200)`)
})
