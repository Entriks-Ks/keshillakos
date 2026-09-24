import { Calculator, CalendarCheck, Scale } from 'lucide-react'

const pills = [
  { icon: Scale, label: 'Shërbime juridike' },
  { icon: Calculator, label: 'Kontabilitet dhe biznes' },
  { icon: CalendarCheck, label: 'Cakto takim' },
]

export default function AuthShowcase() {
  return (
    <aside className="login-visual" aria-hidden="true">
      <div className="login-scene">
        <svg className="login-scene-art" viewBox="0 0 320 420" fill="none">
          <path d="M-10 150 70 92l48 46 62-78 54 62 58-40 48 28v310H-10V150z" fill="#8eaaef" />
          <path d="M-10 210 58 168l70 34 46-52 78 40 42-28 46 22v236H-10V210z" fill="#3554d4" />
          <path d="M-10 286 64 248l82 22 40-36 70 28 44-18 40 16v160H-10V286z" fill="#050a44" />
        </svg>
        <ul className="login-pills">
          {pills.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.label}>
                <span>
                  <Icon size={16} strokeWidth={2} />
                </span>
                {item.label}
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
