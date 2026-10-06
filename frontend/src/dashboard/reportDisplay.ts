import { REQUEST_STATUS } from './requestDisplay'
export const REPORT_LABELS = { reviewing: 'Në shqyrtim', resolved: 'E zgjidhur', rejected: 'E refuzuar' }
export function reportRequestStatus(status: string) { return REQUEST_STATUS[status as keyof typeof REQUEST_STATUS]?.label || (status === 'cancelled' ? 'Anuluar' : 'E hapur') }
export function reportDate(value: string) { return new Date(value).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' }) }

export function reportListDate(value: string) { return new Date(value).toLocaleDateString('sq-AL', { dateStyle: 'medium' }) }
