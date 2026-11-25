import type { CertificationEntry, EducationEntry, WorkExperienceEntry } from '../api/providerProfiles'

export type ProfileRowsProblem = { section: 'experience' | 'education' | 'certifications'; index: number }

type Rows = {
  workExperience: WorkExperienceEntry[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
}

const filled = (value?: string) => Boolean(value?.trim())

/**
 * Prepares career rows for saving. The editor adds a blank row when a section is
 * opened; blank rows are dropped, text is trimmed, and the first row that is only
 * partly filled is reported (the API rejects empty required fields).
 */
export function cleanProfileRows(rows: Rows): Rows & { problem: ProfileRowsProblem | null } {
  let problem: ProfileRowsProblem | null = null
  const report = (section: ProfileRowsProblem['section'], index: number) => { problem ??= { section, index } }

  const workExperience = rows.workExperience
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => filled(row.position) || filled(row.organization) || filled(row.description))
    .map(({ row, index }) => {
      if (!filled(row.position) || !filled(row.organization)) report('experience', index)
      return { ...row, position: row.position.trim(), organization: row.organization.trim(), description: row.description?.trim() }
    })

  const education = rows.education
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => filled(row.institution) || filled(row.degree) || filled(row.fieldOfStudy))
    .map(({ row, index }) => {
      if (!filled(row.institution) || !filled(row.degree) || !filled(row.fieldOfStudy)) report('education', index)
      return { ...row, institution: row.institution.trim(), degree: row.degree.trim(), fieldOfStudy: row.fieldOfStudy.trim() }
    })

  const certifications = rows.certifications
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => filled(row.name) || filled(row.issuer) || filled(row.credentialUrl))
    .map(({ row, index }) => {
      if (!filled(row.name) || !filled(row.issuer)) report('certifications', index)
      return { ...row, name: row.name.trim(), issuer: row.issuer.trim(), credentialUrl: row.credentialUrl?.trim() }
    })

  return { workExperience, education, certifications, problem }
}
