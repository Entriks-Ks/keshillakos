import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanProfileRows } from '../src/utils/profileRows.ts'

const when = { month: 1, year: 2024 }
const work = (position, organization, description = '') => ({ position, organization, description, from: when, to: when, current: false })
const edu = (institution, degree, fieldOfStudy) => ({ institution, degree, fieldOfStudy, from: when, to: when, current: false })
const cert = (name, issuer, credentialUrl = '') => ({ name, issuer, year: 2024, credentialUrl })

test('blank placeholder rows are dropped instead of being sent', () => {
  const result = cleanProfileRows({ workExperience: [work('', '')], education: [edu(' ', '', '')], certifications: [cert('', '')] })
  assert.deepEqual(result.workExperience, [])
  assert.deepEqual(result.education, [])
  assert.deepEqual(result.certifications, [])
  assert.equal(result.problem, null)
})

test('complete rows are kept and trimmed', () => {
  const result = cleanProfileRows({ workExperience: [work(' Avokat ', ' Zyra X ')], education: [edu('UP', 'Bachelor', 'Drejtësi')], certifications: [cert('OAK', ' Oda ')] })
  assert.equal(result.workExperience[0].position, 'Avokat')
  assert.equal(result.workExperience[0].organization, 'Zyra X')
  assert.equal(result.certifications[0].issuer, 'Oda')
  assert.equal(result.problem, null)
})

test('the first partly filled row is reported with its original position', () => {
  const result = cleanProfileRows({
    workExperience: [work('Avokat', 'Zyra X')],
    education: [edu('', '', ''), edu('UP', '', 'Drejtësi')],
    certifications: [cert('OAK', '')],
  })
  assert.deepEqual(result.problem, { section: 'education', index: 1 })
})

test('a description alone still counts as an incomplete experience row', () => {
  assert.deepEqual(cleanProfileRows({ workExperience: [work('', '', 'Punova si praktikant')], education: [], certifications: [] }).problem, { section: 'experience', index: 0 })
})
