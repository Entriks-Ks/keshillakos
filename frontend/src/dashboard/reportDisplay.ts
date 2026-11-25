import i18n, { dateLocale } from '../i18n'
import { REQUEST_STATUS } from './requestDisplay'

/** Translation keys; translate at render time. */
export const REPORT_LABELS = { reviewing: 'admin.reports.status.reviewing', resolved: 'admin.reports.status.resolved', rejected: 'admin.reports.status.rejected' }
export function reportRequestStatus(status: string) { return i18n.t(REQUEST_STATUS[status as keyof typeof REQUEST_STATUS]?.label || (status === 'cancelled' ? 'status.cancelled' : 'status.open')) }
export function reportDate(value: string) { return new Date(value).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' }) }

export function reportListDate(value: string) { return new Date(value).toLocaleDateString(dateLocale(), { dateStyle: 'medium' }) }

/** The report API sends Albanian role labels; map them to the active UI language. */
const REPORT_ROLE_KEYS: Record<string, string> = { Kompani: 'role.company', Ekspert: 'role.expert', 'Përdorues': 'role.user' }
export function reportRoleLabel(role: string) { return REPORT_ROLE_KEYS[role] ? i18n.t(REPORT_ROLE_KEYS[role]) : role }
