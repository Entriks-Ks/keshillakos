import type { ExtensionField } from '../api/catalog'
import { catalogOptionLabel, type CatalogOption } from '../api/catalog'

const FIELD_LABELS: Record<string, { sq: string; en: string }> = {
  licenseNumber: { sq: 'Licencë / Verifikim', en: 'License / Verification' },
  serviceTypeDetail: { sq: 'Lloji i shërbimit', en: 'Service type' },
  documentsNote: { sq: 'Dokumentet', en: 'Documents' },
  deadlineNote: { sq: 'Afatet', en: 'Deadlines' },
  audience: { sq: 'Audienca', en: 'Audience' },
  offerType: { sq: 'Lloji i ofertës', en: 'Offer type' },
  regulatoryNotice: { sq: 'Njoftim rregullator', en: 'Regulatory notice' },
  coachingDisclaimer: { sq: 'Kufizimi i coaching', en: 'Coaching boundary' },
  coachingDisclaimerAccepted: { sq: 'Pranoj kufizimin e coaching', en: 'Accept coaching boundary' },
}

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

function fieldLabel(field: ExtensionField, language: 'sq' | 'en') {
  const mapped = FIELD_LABELS[field.key]
  if (mapped) return mapped[language] || mapped.sq
  return field.key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function optionLabel(value: string, options: CatalogOption[], language: 'sq' | 'en') {
  const match = options.find((item) => (item.group === 'language' ? item.name.sq === value : item.slug === value || item.slug.replace(/-/g, '_') === value))
  return match ? catalogOptionLabel(match, language) : value
}

export function categorySpecificFields(fields: ExtensionField[] = []) {
  return fields.filter((field) => !UNIVERSAL_EXTENSION_KEYS.has(field.key))
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
  const visible = categorySpecificFields(fields)
  if (!visible.length) return null

  return (
    <>
      <h3 className="full service-form-section-title">
        {language === 'en' ? 'Category-specific details' : 'Detaje sipas kategorisë'}
      </h3>
      {visible.map((field) => {
        const label = fieldLabel(field, language)
        const value = values[field.key]
        const allowed = field.allowedValues ?? []

        if (field.type === 'boolean') {
          return (
            <label key={field.key} className="full check-row">
              <input
                type="checkbox"
                checked={Boolean(value)}
                required={field.required || field.mustBeTrue}
                onChange={(e) => onChange(field.key, e.target.checked)}
              />
              {label}
            </label>
          )
        }

        if (field.type === 'stringArray' && allowed.length) {
          const selected = Array.isArray(value) ? value.map(String) : []
          return (
            <fieldset key={field.key} className="full checkbox-fieldset">
              <legend>{label}</legend>
              {allowed.map((option) => (
                <label key={option} className="check-row">
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
            </fieldset>
          )
        }

        if (field.type === 'string' && allowed.length) {
          return (
            <label key={field.key}>
              {label}
              <select
                value={typeof value === 'string' ? value : ''}
                required={field.required}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                {allowed.map((option) => (
                  <option key={option} value={option}>
                    {optionLabel(option, catalogOptions, language)}
                  </option>
                ))}
              </select>
            </label>
          )
        }

        if (field.type === 'number') {
          return (
            <label key={field.key}>
              {label}
              <input
                type="number"
                min={0}
                required={field.required}
                value={value == null || value === '' ? '' : String(value)}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  onChange(field.key, raw === '' ? undefined : Number(raw))
                }}
              />
            </label>
          )
        }

        const textValue = typeof value === 'string' ? value : value == null ? '' : String(value)
        const multiline = field.key.toLowerCase().includes('note')
          || field.key.toLowerCase().includes('disclaimer')
          || textValue.length > 80
        return (
          <label key={field.key} className={multiline ? 'full' : undefined}>
            {label}
            {multiline ? (
              <textarea
                value={textValue}
                rows={3}
                required={field.required}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            ) : (
              <input
                value={textValue}
                required={field.required}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
          </label>
        )
      })}
    </>
  )
}
