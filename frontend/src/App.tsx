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

  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved !== null) setDarkMode(saved === 'true')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:22px_22px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-lg">
              ☀️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-white md:text-lg">SolarVN Control Center</h1>
                <span className="rounded-md border border-violet-300/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                  Live Ops
                </span>
              </div>
              <p className="text-xs text-slate-300/90 md:text-sm">Dashboard giám sát và điều hành danh mục inverter</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 md:gap-3">
            <Link
              to="/"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
            >
              Dashboard
            </Link>
            <div className="hidden rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 md:block">
              Realtime Active
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="rounded-lg border border-white/15 bg-white/10 p-2 transition hover:bg-white/15"
              aria-label="Toggle dark / light mode"
            >
              {darkMode ? <SunGlyph /> : <MoonGlyph />}
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1440px] px-4 py-5 md:px-6 md:py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </main>
    </div>
  )
}
