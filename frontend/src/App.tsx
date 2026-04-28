import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Design C - Dark Theme (always dark)
  useEffect(() => {
    document.documentElement.classList.add('dark')
    localStorage.setItem('darkMode', 'true')
  }, [])

  return (
    <div className="dark min-h-screen bg-dark-bg text-slate-100">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    </div>
  )
}