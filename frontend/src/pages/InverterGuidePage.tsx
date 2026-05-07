import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { IconSearch, IconArrowLeft, IconBook, IconSettings, IconServer, IconWifi, IconKey, IconCheck } from '../components/Icons'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api'

type InverterCatalogEntry = {
  id: string
  brand: string
  model: string
  power_kw: number
  protocol: string
  default_port?: number | null
  mqtt_topic_pattern?: string | null
  api_endpoint?: string | null
  setup_steps: string[]
  notes?: string | null
}

export default function InverterGuidePage() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<InverterCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterProtocol, setFilterProtocol] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<InverterCatalogEntry | null>(null)

  const uniqueBrands = Array.from(new Set(catalog.map((e) => e.brand))).sort()
  const uniqueProtocols = Array.from(new Set(catalog.map((e) => e.protocol))).sort()

  const filtered = catalog.filter((entry) => {
    const searchLower = search.toLowerCase()
    const matchesSearch = !search || entry.brand.toLowerCase().includes(searchLower) || entry.model.toLowerCase().includes(searchLower)
    const matchesBrand = !filterBrand || entry.brand === filterBrand
    const matchesProtocol = !filterProtocol || entry.protocol === filterProtocol
    return matchesSearch && matchesBrand && matchesProtocol
  })

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const resp = await axios.get(`${API_BASE}/inverters/catalog`)
        setCatalog(resp.data as InverterCatalogEntry[])
      } catch (err) {
        console.error('Failed to fetch inverter catalog:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCatalog()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <IconArrowLeft size={20} />
              <span className="text-sm">Quay lại Dashboard</span>
            </button>
            <h1 className="text-lg font-semibold">Hướng dẫn Setup Inverter</h1>
            <div className="w-24" /> {/* Spacer */}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <IconSearch size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm theo tên hãng hoặc model (ví dụ: GoodWe, Huawei, SDT G2)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
              />
            </div>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
            >
              <option value="">Tất cả hãng</option>
              {uniqueBrands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
            <select
              value={filterProtocol}
              onChange={(e) => setFilterProtocol(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
            >
              <option value="">Tất cả protocol</option>
              {uniqueProtocols.map((proto) => (
                <option key={proto} value={proto}>
                  {proto}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <IconBook size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Không tìm thấy inverter phù hợp với tiêu chí tìm kiếm.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white text-lg">{entry.brand}</h3>
                    <p className="text-sm text-slate-400 mt-1">{entry.model}</p>
                  </div>
                  <span className="rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-400/20 px-3 py-1 text-xs">
                    {entry.power_kw} kW
                  </span>
                </div>
                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <IconServer size={14} />
                    <span>{entry.protocol}</span>
                  </div>
                  {entry.default_port && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <IconSettings size={14} />
                      <span>Port: {entry.default_port}</span>
                    </div>
                  )}
                  {entry.mqtt_topic_pattern && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <IconWifi size={14} />
                      <span className="truncate">{entry.mqtt_topic_pattern}</span>
                    </div>
                  )}
                  {entry.api_endpoint && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <IconKey size={14} />
                      <span className="truncate">API: {entry.api_endpoint}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Setup Guide Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedEntry.brand} - {selectedEntry.model}</h2>
                  <p className="text-sm text-slate-400 mt-1">Công suất: {selectedEntry.power_kw} kW • Protocol: {selectedEntry.protocol}</p>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <IconArrowLeft size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Technical Details */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <IconSettings size={18} className="text-cyan-400" />
                  Thông số kỹ thuật
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Protocol:</span>
                    <span className="ml-2 text-white">{selectedEntry.protocol}</span>
                  </div>
                  {selectedEntry.default_port && (
                    <div>
                      <span className="text-slate-500">Port mặc định:</span>
                      <span className="ml-2 text-white">{selectedEntry.default_port}</span>
                    </div>
                  )}
                  {selectedEntry.mqtt_topic_pattern && (
                    <div className="col-span-2">
                      <span className="text-slate-500">MQTT Topic:</span>
                      <span className="ml-2 text-white font-mono text-xs">{selectedEntry.mqtt_topic_pattern}</span>
                    </div>
                  )}
                  {selectedEntry.api_endpoint && (
                    <div className="col-span-2">
                      <span className="text-slate-500">API Endpoint:</span>
                      <span className="ml-2 text-white font-mono text-xs">{selectedEntry.api_endpoint}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Setup Steps */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                  <IconBook size={18} className="text-emerald-400" />
                  Các bước setup cơ bản
                </h3>
                <ol className="space-y-3">
                  {selectedEntry.setup_steps.map((step, index) => (
                    <li key={index} className="flex gap-3 text-sm text-slate-300">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-400/20 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="flex-1">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Notes */}
              {selectedEntry.notes && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
                  <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                    <IconKey size={18} className="text-amber-400" />
                    Lưu ý quan trọng
                  </h3>
                  <p className="text-sm text-amber-200/90">{selectedEntry.notes}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedEntry(null)
                  navigate('/')
                }}
                className="w-full rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 py-3 font-medium hover:bg-cyan-500/20 transition-all"
              >
                Đã hiểu, quay lại Dashboard để thêm inverter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
