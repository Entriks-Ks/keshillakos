import type { ExtensionField } from '../api/catalog'
import { catalogOptionLabel, type CatalogOption } from '../api/catalog'

const FIELD_LABELS: Record<string, { sq: string; en: string }> = {
  licenseNumber: { sq: 'Numri i licencës / verifikimit', en: 'License / verification number' },
  serviceTypeDetail: { sq: 'Lloji i detajuar i shërbimit', en: 'Detailed service type' },
  documentsNote: { sq: 'Dokumentet që nevojiten', en: 'Documents needed' },
  deadlineNote: { sq: 'Afatet tipike', en: 'Typical deadlines' },
  audience: { sq: 'Për kë është shërbimi', en: 'Who the service is for' },
  offerType: { sq: 'Lloji i ofertës', en: 'Offer type' },
  regulatoryNotice: { sq: 'Njoftim rregullator', en: 'Regulatory notice' },
  coachingDisclaimer: { sq: 'Kufizimi i coaching', en: 'Coaching boundary' },
  coachingDisclaimerAccepted: { sq: 'Pranoj kufizimin e coaching', en: 'Accept coaching boundary' },
}

const FIELD_HINTS: Record<string, { sq: string; en: string }> = {
  licenseNumber: {
    sq: 'Vendos numrin e licencës ose referencën e verifikimit nëse e ke.',
    en: 'Enter your license number or verification reference if you have one.',
  },
  serviceTypeDetail: {
    sq: 'Specifiko nëntipin, p.sh. konsultim, përfaqësim, audit.',
    en: 'Specify the subtype, e.g. consultation, representation, audit.',
  },
  documentsNote: {
    sq: 'Çfarë duhet të sjellë klienti (ID, kontrata, fatura, etj.).',
    en: 'What the client should bring (ID, contracts, invoices, etc.).',
  },
  deadlineNote: {
    sq: 'Sa kohë zgjat zakonisht puna dhe kur pret përgjigje.',
    en: 'How long the work usually takes and when to expect a reply.',
  },
  audience: {
    sq: 'Individë, kompani, ose të dyja.',
    en: 'Individuals, companies, or both.',
  },
  offerType: {
    sq: 'Paketë, projekt, ose shërbim i thjeshtë.',
    en: 'Package, project, or simple service.',
  },
  regulatoryNotice: {
    sq: 'Nëse ka kufizime ligjore që klienti duhet t’i dijë.',
    en: 'Any legal limits the client should know about.',
  },
  coachingDisclaimerAccepted: {
    sq: 'Duhet të pranohet përpara publikimit të shërbimit të coaching.',
    en: 'Must be accepted before publishing a coaching service.',
  },
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

function fieldHint(field: ExtensionField, language: 'sq' | 'en') {
  const mapped = FIELD_HINTS[field.key]
  return mapped ? mapped[language] || mapped.sq : undefined
}

function optionLabel(value: string, options: CatalogOption[], language: 'sq' | 'en') {
  const match = options.find((item) => (item.group === 'language' ? item.name.sq === value : item.slug === value || item.slug.replace(/-/g, '_') === value))
  return match ? catalogOptionLabel(match, language) : value
}

export function categorySpecificFields(fields: ExtensionField[] = []) {
  return fields.filter((field) => !UNIVERSAL_EXTENSION_KEYS.has(field.key))
}

function RequirementBadge({
  required,
  language,
}: {
  required?: boolean
  language: 'sq' | 'en'
}) {
  if (required) {
    return (
      <span className="service-field-badge is-required">
        {language === 'en' ? 'Required' : 'E detyrueshme'}
      </span>
    )
  }
  return (
    <span className="service-field-badge is-optional">
      {language === 'en' ? 'Optional' : 'Opsionale'}
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
  const visible = categorySpecificFields(fields)
  if (!visible.length) return null

  return (
    <>
      {visible.map((field) => {
        const label = fieldLabel(field, language)
        const hint = fieldHint(field, language)
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
                <RequirementBadge required={isRequired} language={language} />
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
                  <RequirementBadge required={isRequired} language={language} />
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
                <RequirementBadge required={isRequired} language={language} />
              </span>
              <select
                value={typeof value === 'string' ? value : ''}
                required={isRequired}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                {!isRequired ? (
                  <option value="">{language === 'en' ? 'Choose…' : 'Zgjidh…'}</option>
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
                <RequirementBadge required={isRequired} language={language} />
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
              <RequirementBadge required={isRequired} language={language} />
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
