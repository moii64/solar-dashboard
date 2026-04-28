import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import axios from 'axios'
import SiteDetailPanel from '../components/SiteDetailPanel'
import InverterModelForm from '../components/InverterModelForm'
import { IconBolt, IconBattery, IconSun, IconThermometer, IconActivity, IconFilter, IconTrash, IconRefresh, IconPlus, IconArrowRight, IconCheckCircle, IconAlertTriangle, IconXCircle } from '../components/Icons'

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

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api'

// Design C: Card component with glow effect
function StatCard({ 
  icon, 
  title, 
  value, 
  subtitle, 
  change, 
  changeType = 'up' 
}: { 
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  change?: string
  changeType?: 'up' | 'down'
}) {
  return (
    <div className="dc-stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className="dc-stat-icon">{icon}</div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded ${changeType === 'up' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
            {changeType === 'up' ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
      <div className="text-4xl font-bold text-white dc-glow-text mb-1">{value}</div>
      <div className="text-sm text-slate-500">{title}</div>
      {subtitle && <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">{subtitle}</div>}
    </div>
  )
}

// Design C: Site list item
function SiteListItem({ 
  site, 
  latest, 
  health, 
  onClick 
}: { 
  site: Site
  latest: SiteTelemetry | null
  health: SiteHealth
  onClick: () => void
}) {
  const healthColors = {
    healthy: 'from-emerald-400 to-cyan-500',
    warning: 'from-amber-400 to-orange-500',
    critical: 'from-rose-400 to-red-500',
  }
  
  const healthDot = {
    healthy: 'bg-emerald-400',
    warning: 'bg-amber-400',
    critical: 'bg-rose-400',
  }
  
  const powerPercent = latest?.power ? Math.min((latest.power / 300) * 100, 100) : 0
  const efficiency = latest?.power && latest?.power > 0 ? Math.min((latest.power / 250) * 100, 100) : 0
  
  return (
    <div className="site-list-item" onClick={onClick}>
      <div className={`dc-site-avatar bg-gradient-to-br ${healthColors[health]}`}>
        {site.name.substring(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white text-sm truncate">{site.name}</span>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${healthDot[health]}`}></span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-emerald-400 font-medium">{latest?.power ? `${latest.power} kW` : '--'}</span>
          <span className="text-xs text-slate-500">{efficiency.toFixed(1)}%</span>
        </div>
        <div className="dc-power-bar mt-1">
          <div className="dc-power-bar-fill" style={{ width: `${powerPercent}%` }}></div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [statsOverview, setStatsOverview] = useState<StatsOverview | null>(null)
  const [latestBySite, setLatestBySite] = useState<Record<number, SiteTelemetry>>({})
  const [historyPoints, setHistoryPoints] = useState<StatsHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview')
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const selectedSiteIdRef = useRef<number | null>(null)

  // Helper functions
  const deriveRegion = (site: Site) => {
    if (site.latitude !== undefined && site.latitude !== null) {
      if (site.latitude >= 16) return 'Miền Bắc'
      if (site.latitude >= 12) return 'Miền Trung'
      return 'Miền Nam'
    }
    return 'Miền Nam'
  }

  const getSiteHealth = (site: Site, latest: SiteTelemetry | null): SiteHealth => {
    if (!latest) return site.status === 'online' ? 'warning' : 'critical'
    if (!latest.is_online) return 'critical'
    if ((latest.power || 0) < 800) return 'warning'
    return 'healthy'
  }

  // Fetch data
  const fetchSites = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/inverters`)
      setSites(resp.data as Site[])
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch sites', err)
      setLoading(false)
    }
  }

  const fetchStatsOverview = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/stats/overview`)
      setStatsOverview(resp.data as StatsOverview)
    } catch {
      setStatsOverview(null)
    }
  }

  const fetchLatestForSites = async (sitesToUpdate: Site[]) => {
    const responses = await Promise.all(
      sitesToUpdate.map(async (site) => {
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
  }

  const fetchHistory = async (id: number) => {
    try {
      const resp = await axios.get(`${API_BASE}/stats/history?inverter_id=${id}`)
      setHistoryPoints(resp.data as StatsHistoryPoint[])
    } catch {
      setHistoryPoints([])
    }
  }

  useEffect(() => {
    fetchSites()
    fetchStatsOverview()
  }, [])

  useEffect(() => {
    if (sites.length > 0) {
      fetchLatestForSites(sites)
    }
  }, [sites])

  useEffect(() => {
    if (selectedSite) {
      fetchHistory(selectedSite.id)
    }
  }, [selectedSite])

  // Compute site rows
  const siteRows = useMemo(() => {
    return sites.map((site) => {
      const latest = latestBySite[site.id] ?? null
      const region = deriveRegion(site)
      const cluster = site.device_type ? `${site.device_type.toUpperCase()} Cluster` : 'Portfolio Cluster'
      const health = getSiteHealth(site, latest)
      const currentPower = latest?.power ?? 0
      const energyToday = latest?.energy_today ?? 0
      const temperature = latest?.temperature ?? null
      return { site, latest, region, cluster, health, currentPower, energyToday, temperature }
    })
  }, [sites, latestBySite])

  const healthyCount = siteRows.filter(r => r.health === 'healthy').length
  const warningCount = siteRows.filter(r => r.health === 'warning').length

  return (
    <div className="min-h-screen">
      {/* Header - Design C Style */}
      <header className="px-6 py-5 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <IconSun size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">SolarVN</h1>
                <p className="text-xs text-slate-500">Control Center</p>
              </div>
            </div>
            
            <div className="h-8 w-px bg-dark-border mx-2"></div>
            
            <nav className="flex items-center gap-2">
              <button 
                className={`dc-nav-pill ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <IconActivity size={16} />
                Tổng quan
              </button>
              <button 
                className={`dc-nav-pill ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                <IconBolt size={16} />
                Chi tiết
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="dc-live-badge">
              <span className="dot"></span>
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
            <button className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition" onClick={() => fetchStatsOverview()}>
              <IconRefresh size={20} />
            </button>
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
              M
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Đang tải...</div>
          </div>
        ) : (
          <>
            {/* Stats Grid - Design C */}
            <div className="grid grid-cols-4 gap-5 mb-6">
              <StatCard
                icon={<IconBolt size={24} className="text-emerald-400" />}
                title="Tổng Sites"
                value={sites.length.toString()}
                subtitle={`${healthyCount} online • ${warningCount} warning`}
                change="+2 mới"
                changeType="up"
              />
              <StatCard
                icon={<IconSun size={24} className="text-blue-400" />}
                title="Tổng công suất"
                value={`${((statsOverview?.total_power || 0) / 1000).toFixed(1)} MW`}
                subtitle="so với hôm qua"
                change="+8.2%"
                changeType="up"
              />
              <StatCard
                icon={<IconBattery size={24} className="text-purple-400" />}
                title="Sản lượng hôm nay"
                value={`${(statsOverview?.total_energy_today || 0).toFixed(1)} MWh`}
                subtitle="so với hôm qua"
                change="+12.5%"
                changeType="up"
              />
              <StatCard
                icon={<IconActivity size={24} className="text-amber-400" />}
                title="Hiệu suất TB"
                value="96.4%"
                subtitle="so với hôm qua"
                change="+2.1%"
                changeType="up"
              />
            </div>

            {/* Map + Sites Row */}
            <div className="grid grid-cols-3 gap-5 mb-6">
              {/* Map */}
              <div className="col-span-2">
                <div className="dc-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">Vị trí Sites</h3>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="text-slate-400">Online</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="text-slate-400">Warning</span>
                      </span>
                    </div>
                  </div>
                  <div className="map-wrapper" style={{ height: '300px' }}>
                    <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-500">Loading map...</div>}>
                      <MapComponent 
                        siteRows={siteRows}
                        onSiteClick={(id) => setSelectedSite(sites.find(s => s.id === id) || null)}
                        selectedSiteId={selectedSite?.id || null}
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
              
              {/* Site List */}
              <div className="dc-card">
                <div className="p-4 border-b border-dark-border">
                  <h3 className="font-semibold text-white">Sites hoạt động</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {siteRows.map((row) => (
                    <SiteListItem
                      key={row.site.id}
                      site={row.site}
                      latest={row.latest}
                      health={row.health}
                      onClick={() => setSelectedSite(row.site)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="dc-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">Công suất theo thời gian thực</h3>
                  <p className="text-xs text-slate-500 mt-1">Cập nhật mỗi 15 giây</p>
                </div>
                <select className="dc-input w-32">
                  <option>24 giờ</option>
                  <option>7 ngày</option>
                  <option>30 ngày</option>
                </select>
              </div>
              <div className="dc-chart-area" style={{ height: '250px' }}>
                <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-500">Loading chart...</div>}>
                  <Chart data={historyPoints} />
                </Suspense>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Site Detail Modal */}
      {selectedSite && (
        <SiteDetailPanel
          site={selectedSite}
          latest={latestBySite[selectedSite.id] ?? null}
          health={getSiteHealth(selectedSite, latestBySite[selectedSite.id] ?? null)}
          historyPoints={historyPoints}
          onClose={() => setSelectedSite(null)}
        />
      )}
    </div>
  )
}
