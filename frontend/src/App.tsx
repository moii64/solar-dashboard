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
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-8rem] h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute right-[-8rem] top-[-3rem] h-[25rem] w-[25rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-[-11rem] left-[20%] h-[24rem] w-[24rem] rounded-full bg-emerald-500/18 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[12%] h-[20rem] w-[20rem] rounded-full bg-violet-500/14 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-400/35 to-violet-500/20 text-lg shadow-lg shadow-cyan-500/20">
              ☀️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-white">Solar Việt Nam Control Center</h1>
                <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-violet-200">
                  Live Operations
                </span>
              </div>
              <p className="text-sm text-slate-300/90">Realtime portfolio dashboard cho hệ thống điện mặt trời đa khu vực</p>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
            >
              Dashboard
            </Link>
            <div className="hidden rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 md:block">
              Realtime Active
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="rounded-full border border-white/15 bg-white/10 p-2 transition hover:bg-white/15"
              aria-label="Toggle dark / light mode"
            >
              {darkMode ? <SunGlyph /> : <MoonGlyph />}
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </main>
    </div>
  )
}
