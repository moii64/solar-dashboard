import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import InverterGuidePage from './pages/InverterGuidePage'

export default function App() {
  useEffect(() => {
    document.documentElement.classList.remove('design-a')
    document.documentElement.classList.add('dark')
    localStorage.setItem('darkMode', 'true')
  }, [])

  return (
    <div className="dark min-h-screen bg-dark-bg text-slate-100">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inverters-guide" element={<InverterGuidePage />} />
      </Routes>
    </div>
  )
}
