import type { ExtensionField } from '../api/catalog'
import { catalogOptionLabel, type CatalogOption } from '../api/catalog'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

/** Category fields with translated copy (services.fields.<key>.label / .hint). */
const LABELLED_FIELDS = new Set([
  'licenseNumber',
  'serviceTypeDetail',
  'documentsNote',
  'deadlineNote',
  'audience',
  'offerType',
  'regulatoryNotice',
  'coachingDisclaimer',
  'coachingDisclaimerAccepted',
])

const HINTED_FIELDS = new Set([
  'licenseNumber',
  'serviceTypeDetail',
  'documentsNote',
  'deadlineNote',
  'audience',
  'offerType',
  'regulatoryNotice',
  'coachingDisclaimerAccepted',
])

/** Universal form owns these; do not render them as category extras. */
export const UNIVERSAL_EXTENSION_KEYS = new Set([
  'deliveryModes',
  'supportLanguages',
  'crossBorder',
  'portfolioUrl',
  'references',
  'experience',
  'availabilityMode',
  'priceTo',
  'photos',
  'languageFrom',
  'languageTo',
  'certifiedTranslation',
])

/** Translated label for a category field; resolved at call time in the active UI language. */
export function fieldLabel(field: ExtensionField) {
  if (LABELLED_FIELDS.has(field.key)) return i18n.t(`services.fields.${field.key}.label`)
  return field.key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function fieldHint(field: ExtensionField) {
  return HINTED_FIELDS.has(field.key) ? i18n.t(`services.fields.${field.key}.hint`) : undefined
}

export function optionLabel(value: string, options: CatalogOption[], language: 'sq' | 'en') {
  const match = options.find((item) => (item.group === 'language' ? item.name.sq === value : item.slug === value || item.slug.replace(/-/g, '_') === value))
  return match ? catalogOptionLabel(match, language) : value
}

export function categorySpecificFields(fields: ExtensionField[] = []) {
  return fields.filter((field) => !UNIVERSAL_EXTENSION_KEYS.has(field.key))
}

function RequirementBadge({ required }: { required?: boolean }) {
  const { t } = useTranslation()
  if (required) {
    return (
      <span className="service-field-badge is-required">
        {t('services.required')}
      </span>
    )
  }
  return (
    <span className="service-field-badge is-optional">
      {t('services.optional')}
    </span>
  )
}

export default function ExtensionFieldsForm({
  fields,
  values,
  onChange,
  language = 'sq',
  catalogOptions = [],
}: {
  fields: ExtensionField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  language?: 'sq' | 'en'
  catalogOptions?: CatalogOption[]
}) {
  const { t } = useTranslation()
  const visible = categorySpecificFields(fields)
  if (!visible.length) return null

  return (
    <>
      {visible.map((field) => {
        const label = fieldLabel(field)
        const hint = fieldHint(field)
        const value = values[field.key]
        const allowed = field.allowedValues ?? []
        const isRequired = Boolean(field.required || field.mustBeTrue)

        if (field.type === 'boolean') {
          return (
            <label key={field.key} className="full check-row">
              <input
                type="checkbox"
                checked={Boolean(value)}
                required={isRequired}
                onChange={(e) => onChange(field.key, e.target.checked)}
              />
              <span className="service-field-label">
                <span>{label}</span>
                <RequirementBadge required={isRequired} />
              </span>
            </label>
          )
        }

        if (field.type === 'stringArray' && allowed.length) {
          const selected = Array.isArray(value) ? value.map(String) : []
          return (
            <fieldset key={field.key} className="full checkbox-fieldset">
              <legend>
                <span className="service-field-label">
                  <span>{label}</span>
                  <RequirementBadge required={isRequired} />
                </span>
              </legend>
              {hint ? <p className="service-field-hint">{hint}</p> : null}
              <div className="service-option-grid">
                {allowed.map((option) => (
                  <label key={option} className="check-row service-option-chip">
                    <input
                      type="checkbox"
                      checked={selected.includes(option)}
                      onChange={() => {
                        const next = selected.includes(option)
                          ? selected.filter((item) => item !== option)
                          : [...selected, option]
                        onChange(field.key, next)
                      }}
                    />
                    {optionLabel(option, catalogOptions, language)}
                  </label>
                ))}
              </div>
            </fieldset>
          )
        }

        if (field.type === 'string' && allowed.length) {
          return (
            <label key={field.key}>
              <span className="service-field-label">
                <span>{label}</span>
                <RequirementBadge required={isRequired} />
              </span>
              <select
                value={typeof value === 'string' ? value : ''}
                required={isRequired}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                {!isRequired ? (
                  <option value="">{t('services.choose')}</option>
                ) : null}
                {allowed.map((option) => (
                  <option key={option} value={option}>
                    {optionLabel(option, catalogOptions, language)}
                  </option>
                ))}
              </select>
              {hint ? <p className="service-field-hint">{hint}</p> : null}
            </label>
          )
        }

        if (field.type === 'number') {
          return (
            <label key={field.key}>
              <span className="service-field-label">
                <span>{label}</span>
                <RequirementBadge required={isRequired} />
              </span>
              <input
                type="number"
                min={0}
                required={isRequired}
                value={value == null || value === '' ? '' : String(value)}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  onChange(field.key, raw === '' ? undefined : Number(raw))
                }}
              />
              {hint ? <p className="service-field-hint">{hint}</p> : null}
            </label>
          )
        }

        const textValue = typeof value === 'string' ? value : value == null ? '' : String(value)
        const multiline = field.key.toLowerCase().includes('note')
          || field.key.toLowerCase().includes('disclaimer')
          || textValue.length > 80
        return (
          <label key={field.key} className={multiline ? 'full' : undefined}>
            <span className="service-field-label">
              <span>{label}</span>
              <RequirementBadge required={isRequired} />
            </span>
            {multiline ? (
              <textarea
                value={textValue}
                rows={3}
                required={isRequired}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            ) : (
              <input
                value={textValue}
                required={isRequired}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
            {hint ? <p className="service-field-hint">{hint}</p> : null}
          </label>
        )
      })}
    </>
  )
}
