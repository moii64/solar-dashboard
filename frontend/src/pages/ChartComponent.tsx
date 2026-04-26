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

export default function ChartComponent({ data }: ChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-slate-400">
        Chưa có dữ liệu lịch sử cho site này
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 360 }}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          stroke="#64748b"
        />
        <YAxis stroke="#64748b" />
        <Tooltip
          contentStyle={{ background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(148,163,184,0.2)' }}
          labelFormatter={(label) => new Date(label as string).toLocaleString('vi-VN')}
          formatter={(value: number) => [`${formatMetric(value)} W`, 'Power']}
        />
        <Line
          type="monotone"
          dataKey="power"
          stroke="#22d3ee"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5, fill: '#22d3ee' }}
        />
      </LineChart>
    </div>
  )
}