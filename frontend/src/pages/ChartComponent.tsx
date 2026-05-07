import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ChartProps = {
  data: Array<{
    timestamp: string
    power?: number | null
    energy_today?: number | null
    is_online?: boolean | null
  }>
}

function formatMetric(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

// Backend stores power in Watts; auto-scale to kW / MW for display.
function formatPower(watts?: number | null): string {
  if (watts === undefined || watts === null || Number.isNaN(watts)) return '--'
  if (Math.abs(watts) >= 1_000_000) return `${(watts / 1_000_000).toFixed(2)} MW`
  if (Math.abs(watts) >= 1_000) return `${(watts / 1_000).toFixed(2)} kW`
  return `${watts.toFixed(0)} W`
}

function SmartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload || {}
  const isOnline = point.is_online !== false

  return (
    <div className="min-w-[190px] rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-2 text-xs text-slate-400">{new Date(label as string).toLocaleString('vi-VN')}</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">Công suất</span>
          <span className="font-semibold text-cyan-300">{formatPower(point.power)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">Sản lượng</span>
          <span className="font-semibold text-amber-300">{formatMetric(point.energy_today, 2)} kWh</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">Trạng thái</span>
          <span className={`text-xs font-semibold ${isOnline ? 'text-emerald-300' : 'text-rose-300'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ChartComponent({ data }: ChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="relative flex h-full items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-slate-400">
        <div className="absolute inset-x-6 bottom-8 top-8 opacity-55">
          <div className="dc-skeleton h-full rounded-2xl" />
        </div>
        <div className="relative z-10 rounded-xl border border-white/10 bg-slate-950/55 px-4 py-2 text-center text-sm backdrop-blur-sm">
          Chưa có dữ liệu lịch sử cho site này
        </div>
      </div>
    )
  }

  // Backend reports power in W. Pick a Y-axis scale that matches the data range
  // so a 5 kW inverter shows as "5" with a "kW" unit label rather than "5000" raw watts.
  const peakPower = data.reduce((max, p) => Math.max(max, p.power ?? 0), 0)
  const yScale = peakPower >= 1_000_000 ? { divisor: 1_000_000, unit: 'MW' }
    : peakPower >= 1_000 ? { divisor: 1_000, unit: 'kW' }
    : { divisor: 1, unit: 'W' }

  const formatYTick = (value: number) => {
    const scaled = value / yScale.divisor
    if (yScale.divisor === 1) return scaled.toFixed(0)
    return scaled.toFixed(scaled < 10 ? 2 : 1)
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          stroke="#64748b"
        />
        <YAxis
          stroke="#64748b"
          tickFormatter={formatYTick}
          label={{
            value: `Công suất (${yScale.unit})`,
            angle: -90,
            position: 'insideLeft',
            style: { textAnchor: 'middle', fill: '#94a3b8', fontSize: 11 },
            offset: 10,
          }}
        />
        <Tooltip content={<SmartTooltip />} />
        <Line
          type="monotone"
          dataKey="power"
          stroke="#22d3ee"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5, fill: '#22d3ee' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
