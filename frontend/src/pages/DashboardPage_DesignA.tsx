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

// Design A: Modern Minimal Card Component
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
      className="card metric-card group animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${changeType === 'up' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {changeType === 'up' ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
      <div className="metric-value text-emerald-600 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{title}</div>
      {subtitle && <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">{subtitle}</div>}
    </div>
  )
}

// Design A: Site List Item
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
  const healthColors = {
    healthy: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    critical: 'bg-rose-50 text-rose-700 border border-rose-200',
  }
  
  const healthText = {
    healthy: 'text-emerald-600',
    warning: 'text-amber-600',
    critical: 'text-rose-600',
  }
  
  const powerPercent = latest?.power ? Math.min((latest.power / 300) * 100, 100) : 0
  
  return (
    <div 
      className="card site-card group animate-fade-in cursor-pointer"
      onClick={onClick}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{site.name}</h3>
            <span className={`status-badge ${healthColors[health]}`}>
              {health === 'healthy' ? 'Online' : health === 'warning' ? 'Warning' : 'Critical'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{site.location || 'No location'} • {site.device_type || 'Generic'}</p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${healthText[health]}`}>{latest?.power ? `${latest.power} kW` : '--'}</div>
          <div className="text-[10px] text-gray-500">Công suất</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
        <div>
          <div className="text-xs text-gray-500">Sản lượng hôm nay</div>
          <div className="text-sm font-medium text-gray-900">{latest?.energy_today ? `${latest.energy_today.toFixed(1)} kWh` : '--'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Nhiệt độ</div>
          <div className="text-sm font-medium text-gray-900">{latest?.temperature ? `${latest.temperature}°C` : '--'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Hiệu suất</div>
          <div className="text-sm font-medium text-emerald-600">{powerPercent.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}

// Design A: Bottom Navigation Item
function BottomNavItem({ 
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
      className={`bottom-nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// Empty State Component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <IconSun size={32} className="text-gray-400" />
      </div>
      <p className="text-gray-500 text-sm">{message}</p>
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
  const totalPower = (statsOverview?.total_power || 0) / 1000

  return (
    <div className="design-a min-h-screen bg-[#FAFAFA] pb-20">
      {/* App Header */}
      <header className="app-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">SolarVN</h1>
            <p className="text-xs text-gray-500">Control Center</p>
          </div>
          <div className="flex items-center gap-3">
            <div id="live-indicator" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-medium text-emerald-700">Live</span>
            </div>
            <button 
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              onClick={() => fetchStatsOverview()}
            >
              <IconRefresh size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{sites.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Sites</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-emerald-600">{healthyCount}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Online</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{totalPower.toFixed(1)}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">MW</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-amber-600">{statsOverview?.total_energy_today ? statsOverview.total_energy_today.toFixed(1) : '0.0'}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">MWh</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center animate-spin">
                <IconSun size={24} className="text-emerald-600" />
              </div>
              <div className="text-gray-500">Đang tải dữ liệu...</div>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <StatCard
                icon={<IconBolt size={24} className="text-emerald-600" />}
                title="Tổng Sites"
                value={sites.length.toString()}
                subtitle={`${healthyCount} online • ${warningCount} warning`}
                change="+2 mới"
                changeType="up"
                delay={0}
              />
              <StatCard
                icon={<IconSun size={24} className="text-blue-600" />}
                title="Tổng công suất"
                value={`${totalPower.toFixed(1)} MW`}
                subtitle="so với hôm qua"
                change="+8.2%"
                changeType="up"
                delay={100}
              />
              <StatCard
                icon={<IconBattery size={24} className="text-purple-600" />}
                title="Sản lượng hôm nay"
                value={`${(statsOverview?.total_energy_today || 0).toFixed(1)} MWh`}
                subtitle="so với hôm qua"
                change="+12.5%"
                changeType="up"
                delay={200}
              />
              <StatCard
                icon={<IconActivity size={24} className="text-amber-600" />}
                title="Hiệu suất TB"
                value="96.4%"
                subtitle="so với hôm qua"
                change="+2.1%"
                changeType="up"
                delay={300}
              />
            </div>

            {/* Map Section */}
            <div className="mb-6">
              <div className="map-container" id="map-a">
                <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500"><div className="animate-spin w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><IconMap size={20} className="text-emerald-600" /></div></div>}>
                  <MapComponent 
                    siteRows={siteRows}
                    onSiteClick={(id) => setSelectedSite(sites.find(s => s.id === id) || null)}
                    selectedSiteId={selectedSite?.id || null}
                  />
                </Suspense>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-500">{sites.length} địa điểm trên toàn quốc</span>
                <button className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                  Xem bản đồ lớn
                  <IconArrowRight size={12} />
                </button>
              </div>
            </section>

            {/* Site List */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Danh sách Site</h2>
                <select className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600">
                  <option>Tất cả khu vực</option>
                  <option>Miền Bắc</option>
                  <option>Miền Trung</option>
                  <option>Miền Nam</option>
                </select>
              </div>
              
              {siteRows.length > 0 ? (
                siteRows.map((row, index) => (
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
                <EmptyState message="Chưa có site nào hoạt động" />
              )}
            </section>
          </>
        )}
      </main>

      {/* FAB */}
      <button className="fab">
        <IconPlus size={24} />
      </button>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="flex justify-around">
          <BottomNavItem 
            icon={<IconActivity size={24} />}
            label="Tổng quan"
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <BottomNavItem 
            icon={<IconMap size={24} />}
            label="Bản đồ"
            active={activeTab === 'details'}
            onClick={() => setActiveTab('details')}
          />
          <BottomNavItem 
            icon={<IconChart size={24} />}
            label="Biểu đồ"
            active={false}
            onClick={() => {}}
          />
          <BottomNavItem 
            icon={<IconFilter size={24} />}
            label="Cài đặt"
            active={false}
            onClick={() => {}}
          />
        </div>
      </nav>
    </div>
  )
}