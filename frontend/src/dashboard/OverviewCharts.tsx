type ChartSlice = {
  label: string
  value: number
  color: string
}

const CHART_COLORS = {
  navy: '#050a44',
  accent: '#0a21c0',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  muted: '#94a3b8',
  soft: '#c7cbd6',
}

export const OVERVIEW_CHART_COLORS = CHART_COLORS

function ChartPanel({
  title,
  subtitle,
  emptyText,
  children,
}: {
  title: string
  subtitle?: string
  emptyText?: string
  children?: React.ReactNode
}) {
  return (
    <div className="dash-chart-card">
      <div className="dash-chart-card-head">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children ?? (emptyText ? <p className="dash-chart-empty">{emptyText}</p> : null)}
    </div>
  )
}

export function OverviewBarChart({
  title,
  subtitle,
  items,
  emptyText = 'Nuk ka të dhëna ende.',
}: {
  title: string
  subtitle?: string
  items: ChartSlice[]
  emptyText?: string
}) {
  const max = Math.max(...items.map((item) => item.value), 1)
  const hasData = items.some((item) => item.value > 0)

  return (
    <ChartPanel title={title} subtitle={subtitle} emptyText={!hasData ? emptyText : undefined}>
      {hasData ? (
        <div className="dash-bar-chart" role="img" aria-label={title}>
          {items.map((item, index) => {
            const height = Math.max((item.value / max) * 100, item.value > 0 ? 10 : 0)
            return (
              <div key={item.label} className="dash-bar-col">
                <div className="dash-bar-track">
                  <div
                    className="dash-bar-fill"
                    style={{
                      height: `${height}%`,
                      background: item.color,
                      animationDelay: `${index * 60}ms`,
                    }}
                    title={`${item.label}: ${item.value}`}
                  />
                </div>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            )
          })}
        </div>
      ) : null}
    </ChartPanel>
  )
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

export function OverviewDonutChart({
  title,
  subtitle,
  items,
  centerLabel,
  emptyText = 'Nuk ka të dhëna ende.',
}: {
  title: string
  subtitle?: string
  items: ChartSlice[]
  centerLabel?: string
  emptyText?: string
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const hasData = total > 0
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const radius = 66
  const stroke = 22

  let angle = 0
  const arcs =
    total > 0
      ? items
          .filter((item) => item.value > 0)
          .map((item) => {
            const sweep = (item.value / total) * 360
            const start = angle
            const end = angle + sweep
            angle = end
            if (sweep >= 359.99) {
              return {
                ...item,
                d: `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius}`,
              }
            }
            return {
              ...item,
              d: describeArc(cx, cy, radius, start, end),
            }
          })
      : []

  return (
    <ChartPanel title={title} subtitle={subtitle} emptyText={!hasData ? emptyText : undefined}>
      {hasData ? (
        <div className="dash-donut-wrap">
          <svg
            className="dash-donut-svg"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={title}
          >
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="color-mix(in srgb, var(--border) 80%, transparent)"
              strokeWidth={stroke}
            />
            {arcs.map((arc) => (
              <path
                key={arc.label}
                d={arc.d}
                fill="none"
                stroke={arc.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
                className="dash-donut-arc"
              />
            ))}
            <text x={cx} y={cy - 6} textAnchor="middle" className="dash-donut-total">
              {total}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" className="dash-donut-center-label">
              {centerLabel || 'Gjithsej'}
            </text>
          </svg>
          <ul className="dash-donut-legend">
            {items.map((item) => (
              <li key={item.label}>
                <span style={{ background: item.color }} aria-hidden />
                <em>{item.label}</em>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ChartPanel>
  )
}

export type OverviewChartsData = {
  bar?: {
    title: string
    subtitle?: string
    items: ChartSlice[]
    emptyText?: string
  }
  donut?: {
    title: string
    subtitle?: string
    items: ChartSlice[]
    centerLabel?: string
    emptyText?: string
  }
}

export function OverviewCharts({
  data,
  loading,
}: {
  data?: OverviewChartsData | null
  loading?: boolean
}) {
  if (loading && !data) {
    return (
      <div className="dash-charts-grid is-loading" aria-busy="true">
        <div className="dash-chart-card is-skeleton" />
        <div className="dash-chart-card is-skeleton" />
      </div>
    )
  }

  if (!data || (!data.bar && !data.donut)) return null

  return (
    <div className="dash-charts-grid">
      {data.bar ? (
        <OverviewBarChart
          title={data.bar.title}
          subtitle={data.bar.subtitle}
          items={data.bar.items}
          emptyText={data.bar.emptyText}
        />
      ) : null}
      {data.donut ? (
        <OverviewDonutChart
          title={data.donut.title}
          subtitle={data.donut.subtitle}
          items={data.donut.items}
          centerLabel={data.donut.centerLabel}
          emptyText={data.donut.emptyText}
        />
      ) : null}
    </div>
  )
}

export function requestStatusSlices(
  counts: Partial<Record<string, number>>,
): ChartSlice[] {
  return [
    { label: 'Në pritje', value: counts.pending || 0, color: CHART_COLORS.warning },
    { label: 'Pranuara', value: counts.accepted || 0, color: CHART_COLORS.success },
    { label: 'Përfunduar', value: counts.completed || 0, color: CHART_COLORS.accent },
    { label: 'Refuzuar', value: counts.rejected || 0, color: CHART_COLORS.danger },
  ]
}

export function countByStatus<T extends { status: string }>(items: T[]) {
  return items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
}
