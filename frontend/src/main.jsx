import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { setupAxiosCaching } from './utils/apiCache.js'

// Initialize transparent dual-layer client API caching
setupAxiosCaching();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
