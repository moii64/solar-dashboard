import React, { lazy, Suspense, useState } from 'react'
import axios from 'axios'

const Chart = lazy(() => import('../pages/ChartComponent'))

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api'

type Site = {
  id: number
  name: string
  location?: string
  latitude?: number
  longitude?: number
  device_type?: string
  alert_temp_max?: number
  alert_power_min?: number
  alert_offline_mins?: number
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
  onUpdate?: () => void
}

export default function SiteDetailPanel({
  site,
  latest,
  health,
  historyPoints,
  onClose,
  onUpdate,
}: SiteDetailPanelProps) {
  const colors = statusMeta(health)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: site.name,
    location: site.location || '',
    latitude: site.latitude?.toString() || '',
    longitude: site.longitude?.toString() || '',
    device_type: site.device_type || '',
    alert_temp_max: site.alert_temp_max?.toString() || '70',
    alert_power_min: site.alert_power_min?.toString() || '0',
    alert_offline_mins: site.alert_offline_mins?.toString() || '5',
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await axios.put(`${API_BASE}/inverters/${site.id}`, {
        name: formData.name,
        location: formData.location,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        device_type: formData.device_type,
        alert_temp_max: formData.alert_temp_max ? parseFloat(formData.alert_temp_max) : undefined,
        alert_power_min: formData.alert_power_min ? parseFloat(formData.alert_power_min) : undefined,
        alert_offline_mins: formData.alert_offline_mins ? parseInt(formData.alert_offline_mins, 10) : undefined,
      })
      setIsEditing(false)
      onUpdate?.()
    } catch (error) {
      console.error('Failed to update site:', error)
      alert('Lỗi khi cập nhật thông tin site')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30">
      <button
        type="button"
        aria-label="Đóng chi tiết site"
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        className="absolute inset-x-0 bottom-0 top-12 overflow-y-auto border-t border-white/10 bg-slate-900/95 p-5 sm:p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:inset-y-0 sm:left-auto sm:w-96 sm:border-l sm:border-t-0 rounded-t-2xl sm:rounded-none touch-pan-y-mobile"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-white pr-2 truncate">Thông tin site: {site.name}</h3>
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
          {isEditing ? (
            <>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tên site</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Vị trí</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Loại thiết bị</label>
                  <select
                    value={formData.device_type}
                    onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                  >
                    <option value="">-- Chọn loại --</option>
                    <option value="huawei">Huawei</option>
                    <option value="sungrow">Sungrow</option>
                    <option value="goodwe">GoodWe</option>
                    <option value="sma">SMA</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>

                <div className="pt-2">
                  <h4 className="text-sm font-medium text-white mb-2">Ngưỡng cảnh báo tùy chỉnh</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nhiệt max (°C)</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.alert_temp_max}
                        onChange={(e) => setFormData({ ...formData, alert_temp_max: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Power min (kW)</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.alert_power_min}
                        onChange={(e) => setFormData({ ...formData, alert_power_min: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Offline max (phút)</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.alert_offline_mins}
                        onChange={(e) => setFormData({ ...formData, alert_offline_mins: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setFormData({
                      name: site.name,
                      location: site.location || '',
                      latitude: site.latitude?.toString() || '',
                      longitude: site.longitude?.toString() || '',
                      device_type: site.device_type || '',
                      alert_temp_max: site.alert_temp_max?.toString() || '70',
                      alert_power_min: site.alert_power_min?.toString() || '0',
                      alert_offline_mins: site.alert_offline_mins?.toString() || '5',
                    })
                  }}
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50"
                >
                  Hủy
                </button>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {!isEditing && (
          <div className="mb-5">
            <h4 className="mb-3 text-sm font-semibold text-slate-300">Biểu đồ công suất 24h</h4>
            <div className="h-48 rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-inner shadow-black/20">
              <Suspense fallback={<ChartLoading />}>
                <Chart data={historyPoints} />
              </Suspense>
            </div>
          </div>
        )}

        <div className="mt-auto">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Chỉnh sửa site
            </button>
          )}
        </div>
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
