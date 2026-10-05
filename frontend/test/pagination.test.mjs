import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paginationPages } from '../src/utils/pagination.ts'

test('page controls expose both endpoints with ellipses for distant pages', () => {
  assert.deepEqual(paginationPages(1, 30), [1, 2, 'ellipsis', 30])
  assert.deepEqual(paginationPages(15, 30), [1, 'ellipsis', 14, 15, 16, 'ellipsis', 30])
  assert.deepEqual(paginationPages(30, 30), [1, 'ellipsis', 29, 30])
})
test('short page ranges omit ellipses and retain nearby navigation', () => {
  assert.deepEqual(paginationPages(2, 4), [1, 2, 3, 4])
  assert.deepEqual(paginationPages(1, 1), [1])
  assert.deepEqual(paginationPages(1, 0), [])
})
