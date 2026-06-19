import { useEffect } from 'react'
import './app.css'

function setCssVar(name, value) {
  if (typeof document === 'undefined' || value === undefined || value === null) return
  document.documentElement.style.setProperty(name, String(value))
}

function syncTelegramViewport(webApp) {
  setCssVar('--tg-viewport-height', webApp.viewportHeight ? `${webApp.viewportHeight}px` : '')
  setCssVar('--tg-viewport-stable-height', webApp.viewportStableHeight ? `${webApp.viewportStableHeight}px` : '')
  setCssVar('--tg-safe-area-top', webApp.safeAreaInset?.top ? `${webApp.safeAreaInset.top}px` : '0px')
  setCssVar('--tg-safe-area-bottom', webApp.safeAreaInset?.bottom ? `${webApp.safeAreaInset.bottom}px` : '0px')
  setCssVar('--tg-content-safe-area-top', webApp.contentSafeAreaInset?.top ? `${webApp.contentSafeAreaInset.top}px` : '0px')
  setCssVar('--tg-content-safe-area-bottom', webApp.contentSafeAreaInset?.bottom ? `${webApp.contentSafeAreaInset.bottom}px` : '0px')
}

function initTelegramMiniApp() {
  if (typeof window === 'undefined') return undefined
  const webApp = window.Telegram?.WebApp
  if (!webApp) return undefined

  try {
    webApp.ready?.()
    webApp.expand?.()
    webApp.setHeaderColor?.('#05070D')
    webApp.setBackgroundColor?.('#05070D')
    webApp.setBottomBarColor?.('#05070D')
    syncTelegramViewport(webApp)
  } catch (_) {}

  const handleViewport = () => syncTelegramViewport(webApp)
  const handleTheme = () => {
    try {
      webApp.setHeaderColor?.('#05070D')
      webApp.setBackgroundColor?.('#05070D')
      webApp.setBottomBarColor?.('#05070D')
    } catch (_) {}
  }

  webApp.onEvent?.('viewportChanged', handleViewport)
  webApp.onEvent?.('safeAreaChanged', handleViewport)
  webApp.onEvent?.('contentSafeAreaChanged', handleViewport)
  webApp.onEvent?.('themeChanged', handleTheme)

  return () => {
    webApp.offEvent?.('viewportChanged', handleViewport)
    webApp.offEvent?.('safeAreaChanged', handleViewport)
    webApp.offEvent?.('contentSafeAreaChanged', handleViewport)
    webApp.offEvent?.('themeChanged', handleTheme)
  }
}

export default function App({ children }) {
  useEffect(() => initTelegramMiniApp(), [])
  return children
}
