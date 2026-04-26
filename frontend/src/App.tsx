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
  const [darkMode, setDarkMode] = useState<boolean>(true)
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
    <div className={`flex min-h-screen ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-slate-900/95 backdrop-blur transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/10 text-sm">☀️</div>
          {!sidebarCollapsed && (
            <div>
              <div className="text-sm font-semibold text-white">SolarVN</div>
              <div className="text-[10px] text-slate-400">Control Center</div>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div className="px-3 pb-2">
            {!sidebarCollapsed && <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Menu</div>}
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${item.active ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-300/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                <span className="text-base">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </a>
            ))}
          </div>

          <div className="border-t border-white/5 px-3 pt-3 mt-2">
            {!sidebarCollapsed && <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">System</div>}
            {systemItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
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
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-slate-300 transition hover:bg-white/10"
          >
            <span>{sidebarCollapsed ? '→' : '←'}</span>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-56'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-slate-900/80 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold tracking-tight">Usage & Analytics</h1>
            <span className="rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="rounded-lg border border-white/15 bg-white/5 p-2 transition hover:bg-white/10"
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
