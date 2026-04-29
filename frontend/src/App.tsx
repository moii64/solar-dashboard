import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import './styles/design-a.css'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Design A - Light Theme (Modern Minimal App)
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('design-a')
    localStorage.setItem('darkMode', 'false')
  }, [])

  return (
    <div className="design-a min-h-screen bg-[#FAFAFA]">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    </div>
  )
}