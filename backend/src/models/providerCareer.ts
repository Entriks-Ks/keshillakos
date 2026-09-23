export type MonthYear = {
  month: number
  year: number
}

export type WorkExperienceEntry = {
  position: string
  organization: string
  from: MonthYear
  to?: MonthYear
  current: boolean
  description?: string
}

export type EducationEntry = {
  institution: string
  degree: string
  fieldOfStudy: string
  from: MonthYear
  to?: MonthYear
  current: boolean
}

export type CertificationEntry = {
  name: string
  issuer: string
  year: number
  credentialUrl?: string
}

const monthYearSchema = {
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true, min: 1950, max: 2100 },
}

export const workExperienceEntrySchema = {
  position: { type: String, required: true, trim: true, maxlength: 160 },
  organization: { type: String, required: true, trim: true, maxlength: 160 },
  from: { type: monthYearSchema, required: true },
  to: { type: monthYearSchema, required: false },
  current: { type: Boolean, default: false },
  description: { type: String, trim: true, maxlength: 2000 },
}

export const educationEntrySchema = {
  institution: { type: String, required: true, trim: true, maxlength: 160 },
  degree: { type: String, required: true, trim: true, maxlength: 160 },
  fieldOfStudy: { type: String, required: true, trim: true, maxlength: 160 },
  from: { type: monthYearSchema, required: true },
  to: { type: monthYearSchema, required: false },
  current: { type: Boolean, default: false },
}

export const certificationEntrySchema = {
  name: { type: String, required: true, trim: true, maxlength: 160 },
  issuer: { type: String, required: true, trim: true, maxlength: 160 },
  year: { type: Number, required: true, min: 1950, max: 2100 },
  credentialUrl: { type: String, trim: true, maxlength: 500 },
}

function isMonthYear(value: unknown): value is MonthYear {
  if (!value || typeof value !== 'object') return false
  const entry = value as MonthYear
  return Number.isInteger(entry.month) && entry.month >= 1 && entry.month <= 12
    && Number.isInteger(entry.year) && entry.year >= 1950 && entry.year <= 2100
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function assertPeriod(from: MonthYear, to: MonthYear | undefined, current: boolean, label: string) {
  if (current) return
  if (!to) throw new Error(`${label}: zgjidh datën e përfundimit ose shëno si aktuale`)
  const fromValue = from.year * 12 + from.month
  const toValue = to.year * 12 + to.month
  if (toValue < fromValue) throw new Error(`${label}: data e përfundimit nuk mund të jetë para fillimit`)
}

export function normalizeWorkExperience(input: unknown): WorkExperienceEntry[] {
  if (input === undefined) return []
  if (!Array.isArray(input)) throw new Error('Përvoja e punës nuk është e vlefshme')
  return input.slice(0, 30).map((raw, index) => {
    const row = (raw || {}) as Record<string, unknown>
    const position = cleanText(row.position, 160)
    const organization = cleanText(row.organization, 160)
    if (!position || !organization) throw new Error(`Përvoja #${index + 1}: pozita dhe kompania janë të detyrueshme`)
    if (!isMonthYear(row.from)) throw new Error(`Përvoja #${index + 1}: data e fillimit nuk është e vlefshme`)
    const current = Boolean(row.current)
    const to = current ? undefined : (isMonthYear(row.to) ? row.to : undefined)
    assertPeriod(row.from, to, current, `Përvoja #${index + 1}`)
    const description = cleanText(row.description, 2000) || undefined
    return { position, organization, from: row.from, to, current, description }
  })
}

export function normalizeEducation(input: unknown): EducationEntry[] {
  if (input === undefined) return []
  if (!Array.isArray(input)) throw new Error('Arsimi nuk është i vlefshëm')
  return input.slice(0, 20).map((raw, index) => {
    const row = (raw || {}) as Record<string, unknown>
    const institution = cleanText(row.institution, 160)
    const degree = cleanText(row.degree, 160)
    const fieldOfStudy = cleanText(row.fieldOfStudy, 160)
    if (!institution || !degree || !fieldOfStudy) {
      throw new Error(`Arsimi #${index + 1}: institucioni, diploma dhe fusha janë të detyrueshme`)
    }
    if (!isMonthYear(row.from)) throw new Error(`Arsimi #${index + 1}: data e fillimit nuk është e vlefshme`)
    const current = Boolean(row.current)
    const to = current ? undefined : (isMonthYear(row.to) ? row.to : undefined)
    assertPeriod(row.from, to, current, `Arsimi #${index + 1}`)
    return { institution, degree, fieldOfStudy, from: row.from, to, current }
  })
}

function normalizeCredentialUrl(value: unknown, index: number) {
  const raw = cleanText(value, 500)
  if (!raw) return undefined
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Certifikimi #${index + 1}: URL e kredencialit nuk është e vlefshme`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Certifikimi #${index + 1}: URL duhet të fillojë me http:// ose https://`)
  }
  return url.toString()
}

export function normalizeCertifications(input: unknown): CertificationEntry[] {
  if (input === undefined) return []
  if (!Array.isArray(input)) throw new Error('Certifikimet nuk janë të vlefshme')
  const currentYear = new Date().getFullYear()
  return input.slice(0, 30).map((raw, index) => {
    const row = (raw || {}) as Record<string, unknown>
    const name = cleanText(row.name, 160)
    const issuer = cleanText(row.issuer, 160)
    const year = Number(row.year)
    if (!name || !issuer) {
      throw new Error(`Certifikimi #${index + 1}: emri dhe institucioni janë të detyrueshme`)
    }
    if (!Number.isInteger(year) || year < 1950 || year > currentYear + 1) {
      throw new Error(`Certifikimi #${index + 1}: viti nuk është i vlefshëm`)
    }
    return {
      name,
      issuer,
      year,
      credentialUrl: normalizeCredentialUrl(row.credentialUrl, index),
    }
  })
}
