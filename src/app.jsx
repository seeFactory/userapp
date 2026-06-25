import { useEffect } from 'react'
import { shouldLoadTelegramSdk, telegramSdkUrl } from './platform/login'
import { initAndroidDeepLinks } from './platform/deeplink'
import './app.css'

const RUNTIME_TARGET = process.env.SEEFACTORY_RUNTIME_TARGET || 'h5'
const TELEGRAM_SDK_TIMEOUT = 5000

function setCssVar(name, value) {
  if (typeof document === 'undefined' || value === undefined || value === null) return
  document.documentElement.style.setProperty(name, String(value))
}

function isTelegramTarget() {
  return shouldLoadTelegramSdk(RUNTIME_TARGET)
}

function loadTelegramSdk() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(false)
  if (window.Telegram?.WebApp) return Promise.resolve(true)
  const sdkUrl = telegramSdkUrl(RUNTIME_TARGET)
  if (!sdkUrl) return Promise.resolve(false)

  const existing = document.querySelector(`script[src="${sdkUrl}"]`)
  if (existing) {
    return new Promise((resolve) => {
      let settled = false
      const finish = (loaded) => {
        if (settled) return
        settled = true
        resolve(loaded)
      }
      existing.addEventListener('load', () => finish(true), { once: true })
      existing.addEventListener('error', () => finish(false), { once: true })
      setTimeout(() => finish(Boolean(window.Telegram?.WebApp)), TELEGRAM_SDK_TIMEOUT)
    })
  }

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = sdkUrl
    script.async = true
    let settled = false
    const finish = (loaded) => {
      if (settled) return
      settled = true
      resolve(loaded)
    }
    script.onload = () => finish(true)
    script.onerror = () => finish(false)
    setTimeout(() => finish(Boolean(window.Telegram?.WebApp)), TELEGRAM_SDK_TIMEOUT)
    document.head.appendChild(script)
  })
}

function postTelegramEvent(eventType, eventData = {}) {
  if (typeof window === 'undefined') return
  const payload = JSON.stringify(eventData)

  try {
    window.TelegramWebviewProxy?.postEvent?.(eventType, false, payload)
  } catch (_) {}

  try {
    window.external?.notify?.(JSON.stringify({ eventType, eventData }))
  } catch (_) {}

  try {
    window.parent?.postMessage?.(JSON.stringify({ eventType, eventData }), '*')
  } catch (_) {}
}

function initTelegramMiniAppFallback() {
  if (typeof window === 'undefined' || !isTelegramTarget()) return
  postTelegramEvent('web_app_ready')
  postTelegramEvent('web_app_expand')
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
  if (!isTelegramTarget()) return undefined
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
  useEffect(() => {
    let cleanup
    let disposed = false

    initAndroidDeepLinks().then((nextCleanup) => {
      if (disposed) {
        nextCleanup?.()
        return
      }
      cleanup = nextCleanup
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    let cleanup
    let disposed = false

    if (!isTelegramTarget()) return undefined

    loadTelegramSdk().then(() => {
      if (disposed) return
      cleanup = initTelegramMiniApp()
      if (!cleanup) initTelegramMiniAppFallback()
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  return children
}
