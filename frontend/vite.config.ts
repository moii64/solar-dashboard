import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          'vendor-react': ['react', 'react-dom'],
          // Router
          'vendor-router': ['react-router-dom'],
          // State management
          'vendor-query': ['@tanstack/react-query'],
          // Charting - large, lazy loaded
          'vendor-charts': ['recharts'],
          // Mapping - lazy loaded with MapComponent
          'vendor-maplibre': ['maplibre-gl'],
          'vendor-deck': ['@deck.gl/core', '@deck.gl/react', '@deck.gl/layers'],
          // Utilities
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'socket.io-client', 'suncalc', 'axios'],
        },
      },
    },
    // Deck.gl is large but isolated behind the lazy map route/component.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})