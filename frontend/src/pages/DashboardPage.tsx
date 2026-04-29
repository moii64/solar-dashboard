import React, { useEffect, useState } from 'react'
import axios from 'axios'

// Types
type Site = {
  id: number
  name: string
  location?: string
  latitude?: number
  longitude?: number
  device_type?: string
  status: string
  latest?: SiteTelemetry | null
}

type SiteTelemetry = {
  power?: number
  energy_today?: number
  temperature?: number
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api'

// Site Card Component (Design A style)
function SiteCard({ site, index = 0 }: { site: any; index?: number }) {
  const statusClass = site.status === 'online' 
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
    : 'bg-amber-50 text-amber-700 border border-amber-200'
  
  return (
    <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] border border-gray-200 animate-fade-in cursor-pointer" style={{ animationDelay: `${index * 100}ms` }}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{site.name}</h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClass}`}>
              {site.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{site.location || 'No location'} • {site.device_type || 'Generic'}</p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${site.status === 'online' ? 'text-emerald-600' : 'text-amber-600'}`}>
            {site.latest?.power ? `${site.latest.power} kW` : '--'}
          </div>
          <div className="text-[10px] text-gray-500">Công suất</div>
        </div>
      </div>
      {/* Details row */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
        <div>
          <div className="text-xs text-gray-500">Sản lượng hôm nay</div>
          <div className="text-sm font-medium text-gray-900">{site.latest?.energy_today ? `${site.latest.energy_today.toFixed(1)} kWh` : '--'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Nhiệt độ</div>
          <div className="text-sm font-medium text-gray-900">{site.latest?.temperature ? `${site.latest.temperature}°C` : '--'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Hiệu suất</div>
          <div className="text-sm font-medium text-emerald-600">
            {site.latest?.power ? `${Math.min((site.latest.power / 250) * 100, 100).toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('home')

  // Fetch sites
  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await axios.get(`${API_BASE}/inverters`)
        const sitesData = resp.data as Site[]
        
        // Fetch latest for each site
        const withLatest = await Promise.all(
          sitesData.map(async (site) => {
            try {
              const latest = await axios.get(`${API_BASE}/inverters/${site.id}/latest`)
              return { ...site, latest: latest.data as SiteTelemetry }
            } catch {
              return { ...site, latest: null }
            }
          })
        )
        setSites(withLatest)
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch sites', err)
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const onlineCount = sites.filter(s => s.status === 'online').length
  const totalPower = sites.reduce((sum, s) => sum + (s.latest?.power || 0), 0)
  const totalEnergy = sites.reduce((sum, s) => sum + (s.latest?.energy_today || 0), 0)

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">SolarVN</h1>
            <p className="text-xs text-gray-500">Control Center</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-medium text-emerald-700">Live</span>
            </div>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{sites.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Sites</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-emerald-600">{onlineCount}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Online</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{(totalPower / 1000).toFixed(1)}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">MW</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-amber-600">{totalEnergy.toFixed(1)}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">MWh</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center animate-spin">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="text-gray-500">Đang tải...</div>
            </div>
          </div>
        ) : (
          <>
            {/* Map Section - Simple iframe placeholder */}
            <div className="mb-6">
              <div className="h-[240px] w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
                {sites.length > 0 ? (
                  <iframe 
                    title="Map"
                    width="100%" 
                    height="100%" 
                    frameBorder="0"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${(sites[0].longitude || 106.6) - 1}%2C${(sites[0].latitude || 10.8) - 1}%2C${(sites[0].longitude || 106.6) + 1}%2C${(sites[0].latitude || 10.8) + 1}&layer=mapnik`}
                    style={{ filter: 'grayscale(100%)' }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">Chưa có dữ liệu bản đồ</div>
                )}
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-500">{sites.length} địa điểm trên toàn quốc</span>
                <button className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                  Xem bản đồ lớn
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

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
              
              {sites.map((site, index) => (
                <SiteCard key={site.id} site={site} index={index} />
              ))}
            </section>
          </>
        )}
      </main>

      {/* FAB */}
      <button className="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 z-[90] active:scale-95 transition-transform">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 px-0 py-3 z-100">
        <div className="flex justify-around">
          <button 
            className={`flex flex-col items-center gap-1 ${activeNav === 'home' ? 'text-emerald-600' : 'text-gray-500'}`}
            onClick={() => setActiveNav('home')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[11px] font-medium">Tổng quan</span>
          </button>
          <button 
            className={`flex flex-col items-center gap-1 ${activeNav === 'map' ? 'text-emerald-600' : 'text-gray-500'}`}
            onClick={() => setActiveNav('map')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-[11px] font-medium">Bản đồ</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-[11px] font-medium">Biểu đồ</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[11px] font-medium">Cài đặt</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
