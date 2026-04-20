import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const setAppHeight = () => {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
}

setAppHeight()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
window.addEventListener('resize', setAppHeight)
window.visualViewport?.addEventListener('resize', setAppHeight)

// Register service worker — required for Android WebAPK-style installation
// (opens without URL bar, like a native app). Safe to skip silently if not supported.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => registration.update())
      .catch(() => {
        // SW registration failure is non-fatal — app still works normally
      })
  })
}
