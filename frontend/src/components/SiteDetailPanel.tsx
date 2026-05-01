import React, { lazy, Suspense } from 'react'

const Chart = lazy(() => import('../pages/ChartComponent'))

type Site = {
  id: number
  name: string
  location?: string
  latitude?: number
  longitude?: number
  device_type?: string
}

type SiteTelemetry = {
  timestamp: string
  voltage?: number
  current?: number
  power?: number
  energy_today?: number
  temperature?: number
  error_code?: string | null
  is_online?: boolean
}

type SiteHealth = 'healthy' | 'warning' | 'critical'

type StatsHistoryPoint = {
  timestamp: string
  power?: number
  energy_today?: number
  is_online?: boolean | null
}

type SiteDetailPanelProps = {
  site: Site
  latest: SiteTelemetry | null
  health: SiteHealth
  historyPoints: StatsHistoryPoint[]
  onClose: () => void
}

export default function SiteDetailPanel({
  site,
  latest,
  health,
  historyPoints,
  onClose,
}: SiteDetailPanelProps) {
  const colors = statusMeta(health)

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 z-30 overflow-y-auto border-t border-white/10 bg-slate-900/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:inset-y-0 sm:left-auto sm:w-96 sm:border-l sm:border-t-0 sm:p-6">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-white">Thông tin site: {site.name}</h3>
          <p className="mt-1 text-xs text-slate-500">Cập nhật cuối: {formatRelativeTime(latest?.timestamp)}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Đóng panel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${colors.dot}`} />
            <span className="text-sm font-medium text-slate-200">{colors.label}</span>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${latest?.is_online === false ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
            {latest?.is_online === false ? 'Offline' : 'Online'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DetailCard label="Vị trí" value={site.location || 'N/A'} />
          <DetailCard label="Thiết bị" value={site.device_type || 'N/A'} />
          <DetailCard label="Latitude" value={site.latitude?.toFixed(4) || 'N/A'} />
          <DetailCard label="Longitude" value={site.longitude?.toFixed(4) || 'N/A'} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DetailCard label="Công suất hiện tại" value={`${formatMetric(latest?.power)} W`} accent="cyan" />
          <DetailCard label="Sản lượng hôm nay" value={`${formatMetric(latest?.energy_today, 2)} kWh`} accent="amber" />
          <DetailCard label="Điện áp" value={latest?.voltage ? `${formatMetric(latest.voltage, 1)} V` : 'N/A'} />
          <DetailCard label="Dòng điện" value={latest?.current ? `${formatMetric(latest.current, 1)} A` : 'N/A'} />
          <DetailCard label="Nhiệt độ" value={latest?.temperature ? `${formatMetric(latest.temperature, 1)} °C` : 'N/A'} />
          <DetailCard label="Cập nhật cuối" value={formatDateTime(latest?.timestamp)} />
        </div>

        {latest?.error_code && <DetailCard label="Mã lỗi" value={latest.error_code} accent="rose" fullWidth />} 
      </div>

      <div className="mb-5">
        <h4 className="mb-3 text-sm font-semibold text-slate-300">Biểu đồ công suất 24h</h4>
        <div className="h-48 rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-inner shadow-black/20">
          <Suspense fallback={<ChartLoading />}>
            <Chart data={historyPoints} />
          </Suspense>
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={() => alert('Tính năng chỉnh sửa đang phát triển...')}
          className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Chỉnh sửa site
        </button>
      </div>
    </div>
  )
}

function statusMeta(health: SiteHealth) {
  return {
    healthy: { dot: 'bg-emerald-400', label: 'Vận hành tốt' },
    warning: { dot: 'bg-amber-400', label: 'Cần theo dõi' },
    critical: { dot: 'bg-rose-400', label: 'Cần xử lý' },
  }[health]
}

function formatMetric(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatDateTime(value?: string | null) {
  if (!value) return '--'
  return new Date(value).toLocaleString('vi-VN')
}

function formatRelativeTime(value?: string | null) {
  if (!value) return 'chưa có dữ liệu'
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000)
  return new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(minutes, 'minute')
}

function DetailCard({
  label,
  value,
  accent = 'slate',
  fullWidth = false,
}: {
  label: string
  value: string
  accent?: 'slate' | 'cyan' | 'amber' | 'rose'
  fullWidth?: boolean
}) {
  const accentClass = {
    slate: 'bg-slate-800/60 text-slate-300',
    cyan: 'bg-cyan-800/30 text-cyan-300',
    amber: 'bg-amber-800/30 text-amber-300',
    rose: 'bg-rose-800/30 text-rose-300',
  }[accent]

  return (
    <div className={`rounded-xl border border-white/5 p-3 ${accentClass} ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  )
}

function ChartLoading() {
  return (
    <div className="flex h-full items-center justify-center text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      Đang tải biểu đồ...
    </div>
  )
}
