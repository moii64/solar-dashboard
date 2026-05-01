import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import axios from 'axios'
import SiteDetailPanel from '../components/SiteDetailPanel'
import InverterModelForm from '../components/InverterModelForm'
import { IconBolt, IconBattery, IconSun, IconThermometer, IconActivity, IconFilter, IconTrash, IconRefresh, IconPlus, IconArrowRight, IconCheckCircle, IconAlertTriangle, IconXCircle, IconChart, IconMap } from '../components/Icons'

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
  changeType = 'up',
  delay = 0
}: { 
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  change?: string
  changeType?: 'up' | 'down'
  delay?: number
}) {
  return (
    <div 
      className="dc-stat-card dc-card-interactive group animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="dc-stat-icon group-hover:scale-110 transition-transform duration-300">{icon}</div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded transition-all duration-300 ${changeType === 'up' ? 'bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25' : 'bg-rose-500/15 text-rose-400 group-hover:bg-rose-500/25'}`}>
            {changeType === 'up' ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
      <div className="text-3xl sm:text-4xl font-bold text-white dc-glow-text mb-1">{value}</div>
      <div className="text-sm text-slate-500">{title}</div>
      {subtitle && <div className="flex items-center gap-2 mt-2 sm:mt-3 text-xs text-slate-500">{subtitle}</div>}
    </div>
  )
}

// Design C: Site list item with enhanced animations
function SiteListItem({ 
  site, 
  latest, 
  health, 
  onClick,
  index = 0
}: { 
  site: Site
  latest: SiteTelemetry | null
  health: SiteHealth
  onClick: () => void
  index?: number
}) {
  const lastSeen = latest?.timestamp ? new Date(latest.timestamp) : null
  const isStaleSite = lastSeen ? Date.now() - lastSeen.getTime() > 5 * 60 * 1000 : true
  const lastSeenLabel = lastSeen
    ? new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(Math.round((lastSeen.getTime() - Date.now()) / 60000), 'minute')
    : 'chưa có dữ liệu'
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
  
  const healthText = {
    healthy: 'text-emerald-400',
    warning: 'text-amber-400',
    critical: 'text-rose-400',
  }
  
  const powerPercent = latest?.power ? Math.min((latest.power / 300) * 100, 100) : 0
  const efficiency = latest?.power && latest?.power > 0 ? Math.min((latest.power / 250) * 100, 100) : 0
  
  return (
    <div 
      className="site-list-item group animate-fade-in cursor-pointer"
      onClick={onClick}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className={`dc-site-avatar bg-gradient-to-br ${healthColors[health]} transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg`}>
        {site.name.substring(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white text-sm truncate group-hover:text-emerald-300 transition-colors duration-200">{site.name}</span>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${healthDot[health]} animate-pulse`}></span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs font-medium ${healthText[health]} transition-all duration-200 group-hover:scale-105 transform origin-left`}>{latest?.power ? `${latest.power} kW` : '--'}</span>
          <span className={`text-xs transition-colors ${isStaleSite ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
            {isStaleSite ? `cũ ${lastSeenLabel}` : efficiency.toFixed(1) + '%'}
          </span>
        </div>
        <div className="dc-power-bar mt-1 overflow-hidden">
          <div 
            className="dc-power-bar-fill transition-all duration-500 ease-out group-hover:shadow-[0_0_10px_rgba(52,211,153,0.3)]" 
            style={{ width: `${powerPercent}%` }}
          ></div>
        </div>
      </div>
    </div>
  )
}

// Navigation Pill Component
function NavPill({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button 
      className={`dc-nav-pill group transition-all duration-300 ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="transition-transform duration-200 group-hover:scale-110">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// Empty State Component
function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center h-full animate-fade-in ${compact ? 'py-8' : 'py-12'}`}>
      <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4`}>
        <IconSun size={compact ? 24 : 32} className="text-slate-600" />
      </div>
      <p className="text-slate-500 text-sm text-center max-w-xs">{message}</p>
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
  const [selectedHours, setSelectedHours] = useState<number>(24)
  const [filterStatus, setFilterStatus] = useState<'all' | 'healthy' | 'warning' | 'critical'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'power' | 'status'>('power')

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

  const fetchHistory = async (id: number, hours: number = selectedHours) => {
    try {
      const resp = await axios.get(`${API_BASE}/stats/history?inverter_id=${id}&hours=${hours}`)
      setHistoryPoints(resp.data as StatsHistoryPoint[])
    } catch {
      setHistoryPoints([])
    }
  }

  const [countdown, setCountdown] = useState(30)

  const refreshDashboard = async () => {
    await fetchStatsOverview()
    if (sites.length > 0) {
      await fetchLatestForSites(sites)
    }
    if (selectedSite) {
      await fetchHistory(selectedSite.id, selectedHours)
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

  // Auto-refresh polling: refresh data every 30s, update visible countdown every second.
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void refreshDashboard()
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [sites, selectedSite, selectedHours])

  useEffect(() => {
    if (selectedSite) {
      fetchHistory(selectedSite.id, selectedHours)
    }
  }, [selectedSite, selectedHours])

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

  // Filter + Sort
  const filteredAndSorted = useMemo(() => {
    let filtered = siteRows
    
    // Apply filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.health === filterStatus)
    }
    
    // Apply sort
    const sorted = [...filtered]
    if (sortBy === 'power') {
      sorted.sort((a, b) => (b.currentPower || 0) - (a.currentPower || 0))
    } else if (sortBy === 'status') {
      const healthOrder = { healthy: 0, warning: 1, critical: 2 }
      sorted.sort((a, b) => healthOrder[a.health] - healthOrder[b.health])
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.site.name.localeCompare(b.site.name))
    }
    
    return sorted
  }, [siteRows, filterStatus, sortBy])

  const healthyCount = siteRows.filter(r => r.health === 'healthy').length
  const warningCount = siteRows.filter(r => r.health === 'warning').length
  const totalPower = (statsOverview?.total_power || 0) / 1000
  const hasHistoryData = historyPoints.length > 0
  const [chartFadeTick, setChartFadeTick] = useState(0)

  // Stale data detection
  const lastUpdateTime = statsOverview?.last_updated ? new Date(statsOverview.last_updated) : null
  const isStale = lastUpdateTime ? (Date.now() - lastUpdateTime.getTime()) > 5 * 60 * 1000 : false
  const lastUpdateLabel = lastUpdateTime
    ? new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(
        Math.round((lastUpdateTime.getTime() - Date.now()) / 60000),
        'minute'
      )
    : 'chưa có dữ liệu'

  useEffect(() => {
    if (!hasHistoryData) return
    setChartFadeTick((prev) => prev + 1)
  }, [historyPoints.length, hasHistoryData])

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header - Design C Style */}
      <header className="px-3 sm:px-6 py-3 sm:py-5 border-b border-dark-border bg-dark-bg/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center sm:justify-between min-h-[56px] sm:min-h-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-emerald-500/20">
                <IconSun size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white transition-colors duration-200 group-hover:text-emerald-300">SolarVN</h1>
                <p className="text-xs text-slate-500">Control Center</p>
              </div>
            </div>
            
            <div className="hidden sm:block h-8 w-px bg-dark-border mx-2"></div>
            
            <nav className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
              <NavPill 
                icon={<IconActivity size={16} />} 
                label="Tổng quan" 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')} 
              />
              <NavPill 
                icon={<IconBolt size={16} />} 
                label="Chi tiết" 
                active={activeTab === 'details'} 
                onClick={() => setActiveTab('details')} 
              />
            </nav>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
            <div className="dc-live-badge animate-pulse">
              <span className="dot"></span>
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
            <button 
              className="h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center gap-2 px-3 text-slate-400 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all duration-300 active:scale-95"
              onClick={() => {
                void refreshDashboard()
                setCountdown(30)
              }}
              title={`Tự làm mới sau ${countdown}s`}
            >
              <IconRefresh size={18} />
              <span className="text-xs font-medium hidden sm:inline">{countdown}s</span>
            </button>
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95">
              M
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 animate-spin flex items-center justify-center shadow-glow-emerald">
                <IconSun size={24} className="text-white" />
              </div>
              <div className="text-slate-400">Đang tải dữ liệu...</div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6 pb-8">
            {/* Fleet Summary Bar */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 px-1 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-slate-300 font-medium">{statsOverview?.online_inverters || 0}<span className="text-slate-500">/{sites.length} online</span></span>
              </div>
              <div className="h-4 w-px bg-dark-border hidden sm:block" />
              <div className="flex items-center gap-2">
                <IconBolt size={14} className="text-emerald-400" />
                <span className="text-sm text-slate-300 font-medium">{totalPower.toFixed(1)} MW</span>
              </div>
              <div className="h-4 w-px bg-dark-border hidden sm:block" />
              <div className="flex items-center gap-2">
                <IconBattery size={14} className="text-purple-400" />
                <span className="text-sm text-slate-300 font-medium">{(statsOverview?.total_energy_today || 0).toFixed(1)} MWh</span>
              </div>
              <div className="h-4 w-px bg-dark-border hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sites.length > 0 ? (((statsOverview?.online_inverters || 0) / sites.length) >= 0.8 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400') : 'bg-slate-500/15 text-slate-400'}`}>
                  {sites.length > 0 ? `${Math.round(((statsOverview?.online_inverters || 0) / sites.length) * 100)}%` : '0%'} uptime
                </span>
              </div>
              {isStale && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <IconAlertTriangle size={14} className="text-amber-400" />
                  <span className="text-xs text-amber-400">Dữ liệu cũ ({lastUpdateLabel})</span>
                </div>
              )}
            </div>
            {/* Stats Grid - Mobile: 2-col compact, Desktop: 4-col */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">

              <StatCard
                icon={<IconBolt size={24} className="text-emerald-400" />}
                title="Tổng Sites"
                value={sites.length.toString()}
                subtitle={`${healthyCount} online • ${warningCount} warning`}
                change="+2 mới"
                changeType="up"
                delay={0}
              />
              <StatCard
                icon={<IconSun size={24} className="text-blue-400" />}
                title="Tổng công suất"
                value={`${totalPower.toFixed(1)} MW`}
                subtitle="so với hôm qua"
                change="+8.2%"
                changeType="up"
                delay={100}
              />
              <StatCard
                icon={<IconBattery size={24} className="text-purple-400" />}
                title="Sản lượng hôm nay"
                value={`${(statsOverview?.total_energy_today || 0).toFixed(1)} MWh`}
                subtitle="so với hôm qua"
                change="+12.5%"
                changeType="up"
                delay={200}
              />
              <StatCard
                icon={<IconActivity size={24} className="text-amber-400" />}
                title="Hiệu suất TB"
                value="96.4%"
                subtitle="so với hôm qua"
                change="+2.1%"
                changeType="up"
                delay={300}
              />
            </div>

            {/* Map + Sites Row - Improved grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Map */}
              <div className="xl:col-span-2 dc-card-interactive p-3 sm:p-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-white text-lg">Vị trí Sites</h3>
                    <span className="px-2 py-1 rounded-lg bg-slate-800/50 text-xs text-slate-400">{sites.length} địa điểm</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-slate-400">Online</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span className="text-slate-400">Warning</span>
                    </span>
                  </div>
                </div>
                <div className="map-wrapper rounded-xl overflow-hidden" style={{ height: siteRows.length > 2 ? '350px' : '280px' }}>
                  {/* Mobile: slightly shorter map */}
                  <style>{`@media(max-width:639px){.map-wrapper{height:220px !important}}`}</style>
                  <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-500"><div className="animate-spin w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center"><IconMap size={20} /></div></div>}>
                    <MapComponent 
                      siteRows={siteRows}
                      onSiteClick={(id) => setSelectedSite(sites.find(s => s.id === id) || null)}
                      selectedSiteId={selectedSite?.id || null}
                    />
                  </Suspense>
                </div>
              </div>
              
              {/* Site List - Improved */}
              <div className="dc-card-interactive animate-slide-up" style={{ animationDelay: '300ms' }}>
                <div className="p-5 border-b border-dark-border">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-white">Sites hoạt động</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{filteredAndSorted.length} sites</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="dc-input w-28 bg-dark-surface border-dark-border text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                      >
                        <option value="all">Tất cả</option>
                        <option value="healthy">Healthy</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                      <select
                        className="dc-input w-28 bg-dark-surface border-dark-border text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                      >
                        <option value="power">Công suất</option>
                        <option value="status">Trạng thái</option>
                        <option value="name">Tên</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto scrollbar-thin" style={{ maxHeight: filteredAndSorted.length <= 2 ? '200px' : '420px' }}>
                  {filteredAndSorted.length > 0 ? (
                    filteredAndSorted.map((row, index) => (
                      <SiteListItem
                        key={row.site.id}
                        site={row.site}
                        latest={row.latest}
                        health={row.health}
                        onClick={() => setSelectedSite(row.site)}
                        index={index}
                      />
                    ))
                  ) : (
                    <EmptyState compact message="Không có site nào phù hợp" />
                  )}
                </div>
                {siteRows.length <= 1 && (
                  <div className="border-t border-dark-border p-3 bg-slate-900/30 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Online</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-300">{healthyCount}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Công suất</p>
                        <p className="mt-1 text-lg font-semibold text-cyan-300">{totalPower.toFixed(1)} MW</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Gợi ý: thêm site mới để theo dõi theo cụm và hiển thị heatmap đầy đủ.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chart Section - Improved */}
            <div className="dc-card-interactive p-3 sm:p-4 animate-slide-up" style={{ animationDelay: '400ms' }}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <IconChart size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base sm:text-lg">Công suất theo thời gian thực</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isStale ? (
                        <span className="text-amber-400">⚠️ Dữ liệu cũ ({lastUpdateLabel})</span>
                      ) : (
                        <span>Cập nhật {lastUpdateLabel}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="dc-input w-36 bg-dark-surface border-dark-border text-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200"
                    value={selectedHours}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSelectedHours(val);
                    }}
                  >
                    <option value={24}>24 giờ</option>
                    <option value={168}>7 ngày</option>
                    <option value={720}>30 ngày</option>
                  </select>
                </div>
              </div>
              <div className="dc-chart-area rounded-xl" style={{ height: hasHistoryData ? '280px' : '128px' }}>
                {hasHistoryData ? (
                  <div key={chartFadeTick} className="h-full animate-fade-in">
                    <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-500"><div className="animate-pulse">Đang tải biểu đồ...</div></div>}>
                      <Chart data={historyPoints} />
                    </Suspense>
                  </div>
                ) : (
                  <div className="h-full grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 animate-fade-in">
                    <div className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/20 px-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <IconActivity size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Đang chờ dữ liệu lịch sử</p>
                        <p className="text-xs text-slate-500 mt-1">Telemetry mới sẽ tự đổ vào biểu đồ sau khi gateway gửi dữ liệu.</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col justify-center">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Realtime</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">{realtimeState === 'live' ? 'Live' : 'Standby'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
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