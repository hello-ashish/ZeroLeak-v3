import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const backendTarget = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/proctoring': {
        target: backendTarget,
        ws: true,
        changeOrigin: true
      },
      '/socket.io': {
        target: backendTarget,
        ws: true,
        changeOrigin: true
      }
    }
  },
})
