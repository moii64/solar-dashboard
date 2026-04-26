import { useState, useEffect } from 'react'
import { Link, Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'

function SunGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-yellow-400">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
    </svg>
  )
}

function MoonGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-slate-800">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z" />
    </svg>
  )
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved !== null) setDarkMode(saved === 'true')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  const navItems = [
    { label: 'Dashboard', icon: '📊', href: '/', active: true },
    { label: 'Inverters', icon: '⚡', href: '#', active: false },
    { label: 'Analytics', icon: '📈', href: '#', active: false },
    { label: 'Map', icon: '🗺️', href: '#', active: false },
    { label: 'Data Sources', icon: '📁', href: '#', active: false },
  ]

  const systemItems = [
    { label: 'Settings', icon: '⚙️', href: '#', active: false },
    { label: 'Logs', icon: '📋', href: '#', active: false },
  ]

  return (
    <div className={`force-modern flex min-h-screen ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm text-white">☀️</div>
          {!sidebarCollapsed && (
            <div>
              <div className="text-sm font-semibold text-slate-900">SolarVN</div>
              <div className="text-[11px] text-slate-500">Operations Suite</div>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div className="px-3 pb-2">
            {!sidebarCollapsed && <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Menu</div>}
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${item.active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <span className="text-base">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </a>
            ))}
          </div>

          <div className="border-t border-white/5 px-3 pt-3 mt-2">
            {!sidebarCollapsed && <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">System</div>}
            {systemItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <span className="text-base">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </a>
            ))}
          </div>
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            <span>{sidebarCollapsed ? '→' : '←'}</span>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold tracking-tight text-slate-900">Usage & Analytics</h1>
            <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-50"
              aria-label="Toggle dark / light mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-5">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
