import type { ProviderComparisonItem } from '../../api/providers'
import type { MarketplaceProvider } from '../../api/providerProfiles'
import { dateLocale } from '../../i18n/index.ts'
import { providerPath } from '../../utils/publicPaths'

/** One identity colour per compared lawyer, shared by every view on the compare page. */
export const LAWYER_COLORS = ['#2563eb', '#0ea5e9', '#1e3a8a']

/** Which lawyer leads each "highlight differences" category (empty string = nobody). */
export type CompareAdvantages = Partial<
  Record<'bestRatingUid' | 'bestExpUid' | 'lowestPriceUid' | 'earliestSlotUid', string>
>

type Translate = (key: string, params?: Record<string, string | number>) => string

export function formatDateLocale(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(dateLocale(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function minServicePrice(item: ProviderComparisonItem): number | null {
  const prices = item.services
    .map((s) => s.priceFrom)
    .filter((p): p is number => typeof p === 'number' && p > 0)
  return prices.length ? Math.min(...prices) : null
}

/** Profile languages, or an empty list when none are published (render a translated fallback). */
export function publishedLanguages(item: ProviderComparisonItem): string[] {
  if (item.profile?.languages?.length) return item.profile.languages
  if (item.provider.languages?.length) return item.provider.languages
  return []
}

export function lawyerHasOnline(item: ProviderComparisonItem): boolean {
  const modes = item.profile?.modes || item.provider.skills || []
  return modes.includes('online') || item.services.some((s) => s.details?.deliveryModes?.includes('online'))
}

export function isVerifiedLawyer(item: ProviderComparisonItem): boolean {
  return Boolean(
    item.profile?.verification?.qualification === 'verified' ||
      item.profile?.verification?.identity === 'verified',
  )
}

export function profileUrlFor(item: ProviderComparisonItem): string {
  return providerPath(
    item.profile || ({ uid: item.uid, name: item.provider.name, providerType: 'individual' } as MarketplaceProvider),
  )
}

export function firstName(item: ProviderComparisonItem): string {
  return item.provider.name.split(' ')[0] || item.provider.name
}

/** Intake defaults sent with every booking request started from the compare page. */
export function intakeFor(item: ProviderComparisonItem, t: Translate) {
  return {
    need: item.provider.headline || t('compareUi.intakeNeed', { name: item.provider.name }),
    location: item.provider.location || 'Online',
    language: 'Albanian' as const,
    urgency: 'flexible' as const,
    contact: 'chat' as const,
  }
}

export function sortedOpenSlots(item: ProviderComparisonItem) {
  return [...item.openSlots].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}
