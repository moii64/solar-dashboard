import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import axios from 'axios'
import SiteDetailPanel from '../components/SiteDetailPanel'
import InverterModelForm from '../components/InverterModelForm'

const Chart = lazy(() => import('./ChartComponent'))
const MapComponent = lazy(() => import('./MapComponent'))

type Site = {
  id: number
  name: string
  location?: string
  latitude?: number
  longitude?: number
  ip_address?: string
  device_type?: string
  status: string
  created_at: string
}

type SiteTelemetry = {
  id: number
  inverter_id: number
  timestamp: string
  voltage?: number
  current?: number
  power?: number
  energy_today?: number
  temperature?: number
  error_code?: string | null
  is_online?: boolean
}

type StatsOverview = {
  total_inverters: number
  online_inverters: number
  offline_inverters: number
  total_power: number
  total_energy_today: number
  last_updated?: string | null
}

type StatsHistoryPoint = {
  timestamp: string
  inverter_id?: number | null
  power?: number
  energy_today?: number
  is_online?: boolean | null
}

type WeatherObservation = {
  id: number
  source_name: string
  station_id?: string | null
  station_name?: string | null
  observed_at: string
  latitude?: number | null
  longitude?: number | null
  solar_radiation?: number | null
  temperature?: number | null
  wind_speed?: number | null
  pressure?: number | null
  raw_payload?: string | null
}

type SourceSyncLog = {
  id: number
  source_name: string
  sync_type: string
  status: string
  started_at: string
  finished_at?: string | null
  records_processed: number
  message?: string | null
}

type SourceConnector = {
  source_name: string
  auth_requirements: Record<string, string>
  implementation_status: string
}

type TelemetryMessage = {
  type: 'telemetry'
  reading: SiteTelemetry
  stats_overview?: StatsOverview
}

type FormData = {
  name: string
  location: string
  latitude: string
  longitude: string
  ip_address: string
  device_type: string
}

type RealtimeState = 'connecting' | 'live' | 'offline'
type SiteHealth = 'healthy' | 'warning' | 'critical'

type SiteRow = {
  site: Site
  latest: SiteTelemetry | null
  region: string
  cluster: string
  health: SiteHealth
  currentPower: number
  energyToday: number
  temperature: number | null
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api'
const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined)
  || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/inverters`

function OverviewMetric({
  label,
  value,
  hint,
  accent = 'emerald',
}: {
  label: string
  value: string
  hint: string
  accent?: 'emerald' | 'cyan' | 'amber' | 'violet'
}) {
  const accentClass = {
    emerald: 'from-emerald-400/20 to-emerald-500/5 text-emerald-300',
    cyan: 'from-cyan-400/20 to-cyan-500/5 text-cyan-300',
    amber: 'from-amber-400/20 to-amber-500/5 text-amber-300',
    violet: 'from-violet-400/20 to-violet-500/5 text-violet-300',
  }[accent]

  return (
    <div className={`rounded-3xl border border-white/10 bg-gradient-to-br ${accentClass} p-5 shadow-lg shadow-black/10`}>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{hint}</div>
    </div>
  )
}

function SectionCard({ title, eyebrow, description, children }: { title: string; eyebrow: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/10 backdrop-blur">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
          <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function formatMetric(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatSyncTime(value?: string | null) {
  if (!value) return '--:--:--'
  return new Date(value).toLocaleTimeString('vi-VN')
}

function formatDateTime(value?: string | null) {
  if (!value) return '--'
  return new Date(value).toLocaleString('vi-VN')
}

function deriveRegion(site: Site) {
  if (site.latitude !== undefined && site.latitude !== null) {
    if (site.latitude >= 16) return 'Miền Bắc'
    if (site.latitude >= 12) return 'Miền Trung'
    return 'Miền Nam'
  }

  const haystack = `${site.name} ${site.location || ''}`.toLowerCase()
  if (/(ha noi|hanoi|hai phong|quang ninh|thai binh|bac ninh)/.test(haystack)) return 'Miền Bắc'
  if (/(da nang|danang|hue|quang nam|quang ngai|nha trang)/.test(haystack)) return 'Miền Trung'
  return 'Miền Nam'
}

function deriveCluster(site: Site) {
  const location = site.location?.replace(/[_|]/g, '-')?.trim()
  if (location) {
    const parts = location.split('-').map((item) => item.trim()).filter(Boolean)
    if (parts.length > 1) return parts[parts.length - 1]
    return location
  }

  if (site.device_type) return `${site.device_type.toUpperCase()} Cluster`
  return 'Portfolio Cluster'
}

function getSiteHealth(site: Site, latest: SiteTelemetry | null): SiteHealth {
  if (!latest) return site.status === 'online' ? 'warning' : 'critical'
  if (!latest.is_online) return 'critical'
  if ((latest.power || 0) < 800) return 'warning'
  return 'healthy'
}

function statusMeta(health: SiteHealth) {
  return {
    healthy: {
      dot: 'bg-emerald-400',
      pill: 'bg-emerald-400/10 text-emerald-300',
      border: 'border-emerald-400/30',
      label: 'Vận hành tốt',
    },
    warning: {
      dot: 'bg-amber-400',
      pill: 'bg-amber-400/10 text-amber-300',
      border: 'border-amber-400/30',
      label: 'Cần theo dõi',
    },
    critical: {
      dot: 'bg-rose-400',
      pill: 'bg-rose-400/10 text-rose-300',
      border: 'border-rose-400/30',
      label: 'Cần xử lý',
    },
  }[health]
}

export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [historyPoints, setHistoryPoints] = useState<StatsHistoryPoint[]>([])
  const [statsOverview, setStatsOverview] = useState<StatsOverview | null>(null)
  const [latestBySite, setLatestBySite] = useState<Record<number, SiteTelemetry>>({})
  const [weatherObservations, setWeatherObservations] = useState<WeatherObservation[]>([])
  const [sourceSyncLogs, setSourceSyncLogs] = useState<SourceSyncLog[]>([])
  const [sourceConnectors, setSourceConnectors] = useState<SourceConnector[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSourceTools, setShowSourceTools] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting')
  const [importLoading, setImportLoading] = useState(false)
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [clusterFilter, setClusterFilter] = useState<string>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | SiteHealth>('all')
  const [formData, setFormData] = useState<FormData>({
    name: '',
    location: '',
    latitude: '',
    longitude: '',
    ip_address: '',
    device_type: 'generic',
  })
  const [importForm, setImportForm] = useState({
    source_url: '',
    file_path: '',
    limit: '200',
  })
  const selectedSiteIdRef = useRef<number | null>(null)

  useEffect(() => {
    selectedSiteIdRef.current = selectedSite?.id ?? null
  }, [selectedSite])

  const fetchStatsOverview = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/stats/overview`)
      const nextOverview = resp.data as StatsOverview
      setStatsOverview(nextOverview)
      if (nextOverview.last_updated) setLastUpdated(nextOverview.last_updated)
    } catch {
      setStatsOverview(null)
    }
  }

  const fetchLatestForSites = async (nextSites: Site[]) => {
    const responses = await Promise.all(
      nextSites.map(async (site) => {
        try {
          const resp = await axios.get(`${API_BASE}/inverters/${site.id}/latest`)
          return resp.data as SiteTelemetry
        } catch {
          return null
        }
      }),
    )

    const nextLatest: Record<number, SiteTelemetry> = {}
    responses.forEach((reading) => {
      if (reading) nextLatest[reading.inverter_id] = reading
    })
    setLatestBySite(nextLatest)

    const activeId = selectedSiteIdRef.current
    if (activeId && nextLatest[activeId]?.timestamp) setLastUpdated(nextLatest[activeId].timestamp)
  }

  const fetchSites = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/inverters`)
      const nextSites = resp.data as Site[]
      setSites(nextSites)

      if (!selectedSiteIdRef.current && nextSites.length > 0) {
        setSelectedSite(nextSites[0])
      } else if (selectedSiteIdRef.current) {
        const stillExists = nextSites.find((site) => site.id === selectedSiteIdRef.current)
        setSelectedSite(stillExists ?? nextSites[0] ?? null)
      }

      await fetchLatestForSites(nextSites)
      setError(null)
      setLoading(false)
    } catch (e: any) {
      setError(e?.message ?? 'Lỗi tải danh mục site')
      setLoading(false)
    }
  }

  const fetchSiteHistory = async (siteId: number) => {
    try {
      const resp = await axios.get(`${API_BASE}/stats/history`, {
        params: { inverter_id: siteId, hours: 24, limit: 48 },
      })
      setHistoryPoints((resp.data?.points ?? []) as StatsHistoryPoint[])
    } catch {
      setHistoryPoints([])
    }
  }

  const fetchSourceData = async () => {
    try {
      const [weatherResp, syncResp, connectorsResp] = await Promise.all([
        axios.get(`${API_BASE}/weather/observations`, { params: { limit: 6 } }),
        axios.get(`${API_BASE}/sources/sync-logs`, { params: { limit: 6 } }),
        axios.get(`${API_BASE}/sources/connectors`),
      ])

      setWeatherObservations((weatherResp.data ?? []) as WeatherObservation[])
      setSourceSyncLogs((syncResp.data ?? []) as SourceSyncLog[])
      setSourceConnectors((connectorsResp.data ?? []) as SourceConnector[])
    } catch {
      setWeatherObservations([])
      setSourceSyncLogs([])
      setSourceConnectors([])
    }
  }

  const handleImportEnergyData = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importForm.source_url.trim() && !importForm.file_path.trim()) {
      setImportFeedback('Nhập URL hoặc file path để import.')
      return
    }

    if (importForm.source_url.trim() && importForm.file_path.trim()) {
      setImportFeedback('Chỉ dùng một nguồn mỗi lần: URL hoặc file path.')
      return
    }

    setImportLoading(true)
    setImportFeedback(null)

    try {
      const resp = await axios.post(`${API_BASE}/imports/energydata`, {
        source_url: importForm.source_url.trim() || undefined,
        file_path: importForm.file_path.trim() || undefined,
        limit: Number.parseInt(importForm.limit, 10) || 200,
      })

      await fetchSourceData()
      const summary = resp.data as { records_processed?: number; loaded_from?: string }
      setImportFeedback(`Import xong ${summary.records_processed ?? 0} dòng từ ${summary.loaded_from ?? 'nguồn đã chọn'}.`)
    } catch (e: any) {
      setImportFeedback(e?.response?.data?.detail ?? e?.message ?? 'Import thất bại')
    } finally {
      setImportLoading(false)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      await Promise.all([fetchSites(), fetchStatsOverview(), fetchSourceData()])
    }
    bootstrap()
  }, [])

  useEffect(() => {
    if (!selectedSite) return

    const refreshSelected = async () => {
      await Promise.all([fetchSiteHistory(selectedSite.id), fetchStatsOverview(), fetchSourceData()])
    }

    refreshSelected()

    const intervalId = window.setInterval(() => {
      refreshSelected()
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [selectedSite])

  useEffect(() => {
    let closedByApp = false
    let reconnectTimer: number | undefined
    let socket: WebSocket | null = null

    const connect = () => {
      setRealtimeState('connecting')
      socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        setRealtimeState('live')
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as TelemetryMessage
          if (message.type !== 'telemetry' || !message.reading) return

          const reading = message.reading
          setLastUpdated(reading.timestamp)
          setLatestBySite((prev) => ({ ...prev, [reading.inverter_id]: reading }))
          if (message.stats_overview) setStatsOverview(message.stats_overview)

          setSites((prev) => prev.map((site) => (
            site.id === reading.inverter_id
              ? { ...site, status: reading.is_online ? 'online' : 'offline' }
              : site
          )))

          if (selectedSiteIdRef.current === reading.inverter_id) {
            setHistoryPoints((prev) => {
              const nextPoint: StatsHistoryPoint = {
                timestamp: reading.timestamp,
                inverter_id: reading.inverter_id,
                power: reading.power,
                energy_today: reading.energy_today,
                is_online: reading.is_online,
              }
              return [...prev, nextPoint]
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .slice(-48)
            })
          }
        } catch {
          // ignore malformed payloads
        }
      }

      socket.onclose = () => {
        if (closedByApp) return
        setRealtimeState('offline')
        reconnectTimer = window.setTimeout(connect, 3000)
      }

      socket.onerror = () => {
        socket?.close()
      }
    }

    connect()

    return () => {
      closedByApp = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [])

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post(`${API_BASE}/inverters`, {
        ...formData,
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
      })
      setShowAddForm(false)
      setFormData({
        name: '',
        location: '',
        latitude: '',
        longitude: '',
        ip_address: '',
        device_type: 'generic',
      })
      await Promise.all([fetchSites(), fetchStatsOverview()])
    } catch (e: any) {
      alert(`Lỗi thêm site: ${e?.message ?? 'Unknown error'}`)
    }
  }

  const handleDeleteSite = async (siteId: number) => {
    if (!confirm('Xoá site này?')) return
    try {
      await axios.delete(`${API_BASE}/inverters/${siteId}`)
      if (selectedSite?.id === siteId) {
        setSelectedSite(null)
        setHistoryPoints([])
      }
      await Promise.all([fetchSites(), fetchStatsOverview()])
    } catch {
      alert('Xoá thất bại')
    }
  }

  const siteRows = useMemo<SiteRow[]>(() => (
    sites.map((site) => {
      const latest = latestBySite[site.id] ?? null
      return {
        site,
        latest,
        region: deriveRegion(site),
        cluster: deriveCluster(site),
        health: getSiteHealth(site, latest),
        currentPower: latest?.power ?? 0,
        energyToday: latest?.energy_today ?? 0,
        temperature: latest?.temperature ?? null,
      }
    })
  ), [sites, latestBySite])

  const availableRegions = useMemo(
    () => Array.from(new Set(siteRows.map((row) => row.region))).sort(),
    [siteRows],
  )

  const availableClusters = useMemo(
    () => Array.from(new Set(siteRows.map((row) => row.cluster))).sort(),
    [siteRows],
  )

  const filteredSiteRows = useMemo(() => (
    siteRows.filter((row) => {
      if (regionFilter !== 'all' && row.region !== regionFilter) return false
      if (clusterFilter !== 'all' && row.cluster !== clusterFilter) return false
      if (healthFilter !== 'all' && row.health !== healthFilter) return false
      return true
    })
  ), [siteRows, regionFilter, clusterFilter, healthFilter])

  const selectedLatest = selectedSite ? latestBySite[selectedSite.id] ?? null : null

  const regionalMetrics = useMemo(() => {
    const grouped = new Map<string, { region: string; sites: number; online: number; totalPower: number; totalEnergy: number }>()

    filteredSiteRows.forEach((row) => {
      const current = grouped.get(row.region) || {
        region: row.region,
        sites: 0,
        online: 0,
        totalPower: 0,
        totalEnergy: 0,
      }
      current.sites += 1
      current.online += row.health === 'critical' ? 0 : 1
      current.totalPower += row.currentPower
      current.totalEnergy += row.energyToday
      grouped.set(row.region, current)
    })

    return Array.from(grouped.values()).sort((a, b) => b.totalPower - a.totalPower)
  }, [filteredSiteRows])

  const clusterRanking = useMemo(() => {
    const grouped = new Map<string, { cluster: string; sites: number; totalPower: number; avgEnergy: number; onlineShare: number }>()

    filteredSiteRows.forEach((row) => {
      const current = grouped.get(row.cluster) || {
        cluster: row.cluster,
        sites: 0,
        totalPower: 0,
        avgEnergy: 0,
        onlineShare: 0,
      }
      current.sites += 1
      current.totalPower += row.currentPower
      current.avgEnergy += row.energyToday
      current.onlineShare += row.health === 'critical' ? 0 : 1
      grouped.set(row.cluster, current)
    })

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        avgEnergy: item.sites ? item.avgEnergy / item.sites : 0,
        onlineShare: item.sites ? Math.round((item.onlineShare / item.sites) * 100) : 0,
      }))
      .sort((a, b) => (b.totalPower + b.avgEnergy * 100) - (a.totalPower + a.avgEnergy * 100))
  }, [filteredSiteRows])

  const watchlist = useMemo(() => (
    [...filteredSiteRows]
      .filter((row) => row.health !== 'healthy')
      .sort((a, b) => a.currentPower - b.currentPower)
      .slice(0, 4)
  ), [filteredSiteRows])

  const topSites = useMemo(() => (
    [...filteredSiteRows]
      .sort((a, b) => (b.currentPower + b.energyToday * 100) - (a.currentPower + a.energyToday * 100))
      .slice(0, 5)
  ), [filteredSiteRows])

  const mapSites = useMemo(() => {
    const withCoords = filteredSiteRows.filter((row) => row.site.latitude !== undefined && row.site.longitude !== undefined)
    const latitudes = withCoords.map((row) => row.site.latitude as number)
    const longitudes = withCoords.map((row) => row.site.longitude as number)
    const minLat = latitudes.length ? Math.min(...latitudes) : 8
    const maxLat = latitudes.length ? Math.max(...latitudes) : 23
    const minLng = longitudes.length ? Math.min(...longitudes) : 102
    const maxLng = longitudes.length ? Math.max(...longitudes) : 110

    return filteredSiteRows.map((row, index) => {
      let x = 18 + (index % 3) * 24
      let y = 20 + Math.floor(index / 3) * 18

      if (row.site.latitude !== undefined && row.site.longitude !== undefined && maxLat !== minLat && maxLng !== minLng) {
        x = 12 + (((row.site.longitude as number) - minLng) / (maxLng - minLng)) * 72
        y = 78 - (((row.site.latitude as number) - minLat) / (maxLat - minLat)) * 58
      }

      return { ...row, x, y }
    })
  }, [filteredSiteRows])

  const overview = useMemo(() => {
    const totalSites = filteredSiteRows.length
    const healthySites = filteredSiteRows.filter((row) => row.health === 'healthy').length
    const watchSites = filteredSiteRows.filter((row) => row.health === 'warning').length
    const criticalSites = filteredSiteRows.filter((row) => row.health === 'critical').length
    const totalPower = filteredSiteRows.reduce((sum, row) => sum + row.currentPower, 0)
    const totalEnergy = filteredSiteRows.reduce((sum, row) => sum + row.energyToday, 0)
    const bestRegion = regionalMetrics[0]?.region ?? 'Chưa có dữ liệu'
    const healthScore = totalSites ? Math.round(((healthySites + watchSites * 0.5) / totalSites) * 100) : 0

    return {
      totalSites,
      healthySites,
      watchSites,
      criticalSites,
      totalPower,
      totalEnergy,
      bestRegion,
      healthScore,
    }
  }, [regionalMetrics, filteredSiteRows])

  const latestSourceSync = sourceSyncLogs[0] ?? null
  const latestWeather = weatherObservations[0] ?? null
  const connectorReadiness = useMemo(
    () => sourceConnectors.filter((connector) => connector.implementation_status === 'stub').length,
    [sourceConnectors],
  )

  const chartData = useMemo(
    () => [...historyPoints].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [historyPoints],
  )

  if (loading) {
    return <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-slate-300">Đang tải control center...</div>
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">{error}</div>
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
              <span className={`h-2 w-2 rounded-full ${realtimeState === 'live' ? 'bg-emerald-400' : realtimeState === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'}`} />
              multi-site solar control center
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Điều hành toàn bộ danh mục điện mặt trời trên một bản đồ duy nhất.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
              Không còn dừng ở từng inverter riêng lẻ. Màn hình này đẩy trọng tâm lên tầng điều hành danh mục site: nhìn theo khu vực, theo cụm dự án, theo mức độ ưu tiên và ra quyết định nhanh hơn.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="btn-primary"
                onClick={() => Promise.all([fetchSites(), fetchStatsOverview(), fetchSourceData(), selectedSite ? fetchSiteHistory(selectedSite.id) : Promise.resolve()])}
              >
                Làm mới control center
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowAddForm((value) => !value)}
              >
                {showAddForm ? 'Đóng form thêm site' : 'Thêm site mới'}
              </button>
              <button
                className="btn-success"
                onClick={() => setShowSourceTools((value) => !value)}
              >
                {showSourceTools ? 'Ẩn data sources' : 'Mở data sources'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Khu vực dẫn đầu</div>
              <div className="mt-3 text-xl font-semibold text-white">{overview.bestRegion}</div>
              <div className="mt-2 text-sm text-slate-400">Dẫn đầu theo công suất hiện tại toàn danh mục</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Realtime fabric</div>
              <div className="mt-3 text-xl font-semibold text-white">{realtimeState === 'live' ? 'LIVE' : realtimeState === 'connecting' ? 'Đang nối' : 'Mất kết nối'}</div>
              <div className="mt-2 text-sm text-slate-400">Cập nhật gần nhất {formatSyncTime(lastUpdated)}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Điểm sức khoẻ danh mục</div>
              <div className="mt-3 text-xl font-semibold text-white">{overview.healthScore}%</div>
              <div className="mt-2 text-sm text-slate-400">{overview.healthySites} site tốt • {overview.criticalSites} site cần xử lý</div>
            </div>
          </div>
        </div>
      </section>

      <InverterModelForm />

      {showAddForm && (
        <form onSubmit={handleAddSite} className="glass-panel grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
          <input className="input-control" placeholder="Tên site *" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          <input className="input-control" placeholder="Vị trí / tỉnh thành" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
          <input className="input-control" placeholder="Latitude" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} />
          <input className="input-control" placeholder="Longitude" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} />
          <input className="input-control" placeholder="IP collector / gateway" value={formData.ip_address} onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })} />
          <select className="input-control" value={formData.device_type} onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}>
            <option value="generic">Generic</option>
            <option value="solaredge">SolarEdge</option>
            <option value="sungrow">Sungrow</option>
            <option value="goodwe">GoodWe</option>
          </select>
          <div className="flex gap-2 md:col-span-2">
            <button className="btn-primary">Lưu site</button>
            <button type="button" className="btn-ghost" onClick={() => setShowAddForm(false)}>Huỷ</button>
          </div>
        </form>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric label="Tổng site" value={String(overview.totalSites)} hint={`${overview.healthySites} site vận hành tốt`} accent="emerald" />
        <OverviewMetric label="Công suất toàn danh mục" value={`${formatMetric(overview.totalPower)} W`} hint="Tổng công suất tức thời toàn mạng" accent="cyan" />
        <OverviewMetric label="Sản lượng hôm nay" value={`${formatMetric(overview.totalEnergy, 2)} kWh`} hint="Tổng sản lượng theo dữ liệu live mới nhất" accent="amber" />
        <OverviewMetric label="Site cần chú ý" value={String(overview.watchSites + overview.criticalSites)} hint={`${overview.criticalSites} site mức ưu tiên cao`} accent="violet" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          eyebrow="Tổng quan vận hành"
          title="Bản đồ & Tình trạng site"
          description="Theo dõi trạng thái các site trên bản đồ, lọc theo khu vực, cụm dự án và sức khỏe để có cái nhìn tổng quát."
        >
          <div className="h-[50vh]">
            <Suspense
              fallback={(
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-slate-400">
                  Đang tải bản đồ...
                </div>
              )}
            >
              <MapComponent siteRows={filteredSiteRows} onSiteClick={(siteId) => {
                const matched = filteredSiteRows.find((row) => row.site.id === siteId)?.site ?? null
                setSelectedSite(matched)
              }} selectedSiteId={selectedSite?.id || null} />
            </Suspense>
          </div>
        </SectionCard>

        {selectedSite && (
          <SiteDetailPanel
            site={selectedSite}
            latest={selectedLatest}
            health={getSiteHealth(selectedSite, selectedLatest)}
            historyPoints={chartData}
            onClose={() => setSelectedSite(null)}
          />
        )}
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <SectionCard
          eyebrow="top sites"
          title="Bảng điều hành đa site"
          description="Tổng hợp theo site để đội điều hành nhìn thấy trạng thái, khu vực và sản lượng trong một bảng duy nhất."
        >
          <div className="space-y-3">
            {topSites.map((row) => {
              const meta = statusMeta(row.health)
              const active = selectedSite?.id === row.site.id
              return (
                <button
                  key={row.site.id}
                  type="button"
                  onClick={() => setSelectedSite(row.site)}
                  className={`w-full rounded-3xl border p-4 text-left transition ${active ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                        <div className="font-medium text-white">{row.site.name}</div>
                      </div>
                      <div className="mt-1 text-sm text-slate-400">{row.region} • {row.cluster}</div>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs ${meta.pill}`}>{meta.label}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-950/70 p-3">
                      <div className="text-slate-500">Power</div>
                      <div className="mt-1 font-semibold text-white">{formatMetric(row.currentPower)} W</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/70 p-3">
                      <div className="text-slate-500">Energy</div>
                      <div className="mt-1 font-semibold text-white">{formatMetric(row.energyToday, 2)} kWh</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/70 p-3">
                      <div className="text-slate-500">Temp</div>
                      <div className="mt-1 font-semibold text-white">{row.temperature !== null ? `${formatMetric(row.temperature, 1)} °C` : '--'}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            eyebrow="cluster ranking"
            title="Xếp hạng hiệu quả theo cụm dự án"
            description="Nhìn top cụm nào đang kéo công suất và cụm nào cần can thiệp sớm."
          >
            <div className="space-y-3">
              {clusterRanking.slice(0, 5).map((cluster, index) => (
                <div key={cluster.cluster} className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-sm font-semibold text-cyan-300">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-white">{cluster.cluster}</div>
                      <div className="text-sm text-slate-400">{cluster.sites} site • online share {cluster.onlineShare}%</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">{formatMetric(cluster.totalPower)} W</div>
                    <div className="text-sm text-slate-400">{formatMetric(cluster.avgEnergy, 2)} kWh/site</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="watchlist"
            title="Site cần ưu tiên xử lý"
            description="Danh sách ngắn để đội vận hành nhìn vào là biết nên làm gì tiếp theo."
          >
            <div className="space-y-3">
              {watchlist.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">Chưa có site nào vượt ngưỡng cảnh báo.</div>
              ) : watchlist.map((row) => {
                const meta = statusMeta(row.health)
                return (
                  <button key={row.site.id} type="button" onClick={() => setSelectedSite(row.site)} className={`w-full rounded-3xl border ${meta.border} bg-white/5 p-4 text-left transition hover:bg-white/10`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                          <div className="font-medium text-white">{row.site.name}</div>
                        </div>
                        <div className="mt-1 text-sm text-slate-400">{row.region} • {row.cluster}</div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs ${meta.pill}`}>{meta.label}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                      <span>{formatMetric(row.currentPower)} W</span>
                      <span>{formatMetric(row.energyToday, 2)} kWh hôm nay</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </SectionCard>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <SectionCard
          eyebrow="data sources"
          title="Nguồn dữ liệu thật & importer"
          description="Ưu tiên đưa dữ liệu nền vào hệ thống trước, rồi mới nối credential portal cho telemetry thật theo vendor."
        >
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Import status</div>
                <div className="mt-2 text-2xl font-semibold text-white">{latestSourceSync?.status === 'success' ? 'READY' : latestSourceSync?.status === 'failed' ? 'FAILED' : 'IDLE'}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {latestSourceSync ? `${latestSourceSync.records_processed} dòng • ${formatDateTime(latestSourceSync.finished_at || latestSourceSync.started_at)}` : 'Chưa có phiên import nào'}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Weather feed mới nhất</div>
                <div className="mt-2 text-xl font-semibold text-white">{latestWeather?.station_name || 'Chưa có dữ liệu'}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {latestWeather ? `${formatMetric(latestWeather.solar_radiation, 1)} W/m² • ${formatMetric(latestWeather.temperature, 1)} °C` : 'Import EnergyData để nạp lớp dữ liệu nền'}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Connector backlog</div>
                <div className="mt-2 text-xl font-semibold text-white">{sourceConnectors.length}</div>
                <div className="mt-2 text-sm text-slate-400">{connectorReadiness} connector skeleton đang chờ credential / API access thật</div>
              </div>
            </div>

            <div className="space-y-3">
              {showSourceTools && (
                <form onSubmit={handleImportEnergyData} className="rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                  <div className="text-sm font-medium text-white">Import EnergyData ngay từ dashboard</div>
                  <div className="mt-1 text-sm text-slate-400">Dùng URL thật là tiện nhất. File path vẫn hỗ trợ cho backend/container khi cần nạp dữ liệu cục bộ.</div>
                  <div className="mt-4 space-y-3">
                    <input
                      className="input-control w-full"
                      placeholder="URL CSV/ZIP extract của EnergyData"
                      value={importForm.source_url}
                      onChange={(e) => setImportForm((prev) => ({ ...prev, source_url: e.target.value }))}
                    />

                    <input
                      className="input-control w-full"
                      placeholder="File path nội bộ backend (advanced)"
                      value={importForm.file_path}
                      onChange={(e) => setImportForm((prev) => ({ ...prev, file_path: e.target.value }))}
                    />
                    <div className="flex flex-col gap-3 md:flex-row">
                      <input
                        className="input-control md:w-40"
                        placeholder="Limit"
                        value={importForm.limit}
                        onChange={(e) => setImportForm((prev) => ({ ...prev, limit: e.target.value }))}
                      />
                      <button
                        type="submit"
                        disabled={importLoading}
                        className="btn-success disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {importLoading ? 'Đang import...' : 'Chạy importer'}
                      </button>
                    </div>
                    {importFeedback ? <div className="text-sm text-emerald-200">{importFeedback}</div> : null}
                  </div>
                </form>
              )}

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Connector roadmap</div>
                    <div className="mt-1 text-sm text-slate-400">Chuẩn hoá đường nối trước khi gắn credential thật</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {sourceConnectors.map((connector) => (
                    <div key={connector.source_name} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-white">{connector.source_name}</div>
                        <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">{connector.implementation_status}</div>
                      </div>
                      <div className="mt-2 text-sm text-slate-400">{connector.auth_requirements.required}</div>
                      <div className="mt-2 text-xs text-cyan-300">{connector.auth_requirements.portal}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="weather pulse"
          title="Lớp dữ liệu nền thời tiết / bức xạ"
          description="Dùng để làm map context, baseline estimation và chuẩn bị cho model dữ liệu thật theo vùng."
        >
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              {weatherObservations.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">Chưa có weather observation. Mở Data Sources để chạy import EnergyData.</div>
              ) : weatherObservations.map((item) => (
                <div key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.station_name || item.station_id || 'Unnamed station'}</div>
                      <div className="mt-1 text-sm text-slate-400">{formatDateTime(item.observed_at)} • {item.source_name}</div>
                    </div>
                    <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                      {formatMetric(item.solar_radiation, 1)} W/m²
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div className="rounded-2xl bg-slate-950/70 p-3">
                      <div className="text-slate-500">Temp</div>
                      <div className="mt-1 font-semibold text-white">{formatMetric(item.temperature, 1)} °C</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/70 p-3">
                      <div className="text-slate-500">Wind</div>
                      <div className="mt-1 font-semibold text-white">{formatMetric(item.wind_speed, 1)} m/s</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/70 p-3">
                      <div className="text-slate-500">Pressure</div>
                      <div className="mt-1 font-semibold text-white">{formatMetric(item.pressure, 1)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/70 p-3">
                      <div className="text-slate-500">Coords</div>
                      <div className="mt-1 font-semibold text-white">{item.latitude !== null && item.longitude !== null && item.latitude !== undefined && item.longitude !== undefined ? `${formatMetric(item.latitude, 2)}, ${formatMetric(item.longitude, 2)}` : '--'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sync logs</div>
                <div className="mt-3 space-y-3">
                  {sourceSyncLogs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">Chưa có sync log.</div>
                  ) : sourceSyncLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-white">{log.source_name}</div>
                        <div className={`rounded-full px-3 py-1 text-xs ${log.status === 'success' ? 'bg-emerald-400/10 text-emerald-300' : log.status === 'failed' ? 'bg-rose-400/10 text-rose-300' : 'bg-amber-400/10 text-amber-300'}`}>
                          {log.status}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-slate-400">{log.records_processed} dòng • {formatDateTime(log.finished_at || log.started_at)}</div>
                      <div className="mt-2 text-xs text-slate-500">{log.message || 'Không có message'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="portfolio filters"
        title="Bộ lọc điều hành"
        description="Lọc nhanh theo khu vực, cụm dự án và mức độ ưu tiên để tập trung đúng nhóm site."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="input-control"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="all">Tất cả khu vực</option>
            {availableRegions.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>

          <select
            className="input-control"
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
          >
            <option value="all">Tất cả cụm</option>
            {availableClusters.map((cluster) => (
              <option key={cluster} value={cluster}>{cluster}</option>
            ))}
          </select>

          <select
            className="input-control"
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value as 'all' | SiteHealth)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="healthy">Vận hành tốt</option>
            <option value="warning">Cần theo dõi</option>
            <option value="critical">Cần xử lý</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="operations table"
        title="Bảng điều hành toàn mạng"
        description="Phiên bản gọn để nhìn toàn bộ site theo vùng, trạng thái và công suất hiện tại trên cùng một màn hình."
      >
        <div className="table-shell overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-3 font-medium">Site</th>
                <th className="px-3 py-3 font-medium">Khu vực</th>
                <th className="px-3 py-3 font-medium">Cụm</th>
                <th className="px-3 py-3 font-medium">Trạng thái</th>
                <th className="px-3 py-3 font-medium">Power</th>
                <th className="px-3 py-3 font-medium">Energy today</th>
                <th className="px-3 py-3 font-medium">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSiteRows.map((row) => {
                const meta = statusMeta(row.health)
                return (
                  <tr key={row.site.id} className="transition hover:bg-cyan-400/[0.08]">
                    <td className="px-3 py-4">
                      <button type="button" className="text-left" onClick={() => setSelectedSite(row.site)}>
                        <div className="font-medium text-white">{row.site.name}</div>
                        <div className="text-slate-400">{row.site.location || 'Chưa có vị trí'}</div>
                      </button>
                    </td>
                    <td className="px-3 py-4 text-slate-300">{row.region}</td>
                    <td className="px-3 py-4 text-slate-300">{row.cluster}</td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs ${meta.pill}`}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-4 text-white">{formatMetric(row.currentPower)} W</td>
                    <td className="px-3 py-4 text-white">{formatMetric(row.energyToday, 2)} kWh</td>
                    <td className="px-3 py-4">
                      <button type="button" onClick={() => handleDeleteSite(row.site.id)} className="rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-400/20">
                        Xoá
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
