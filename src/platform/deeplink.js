import Taro from '@tarojs/taro'
import { closeExternalAuthBrowser } from './externalAuth'

const RUNTIME_TARGET = process.env.SEEFACTORY_RUNTIME_TARGET || 'h5'
export const ANDROID_AUTH_CALLBACK_EVENT = 'seeFactory:android-auth-callback'
const PENDING_AUTH_CALLBACK_KEY = 'seeFactoryPendingAndroidAuthCallback'

const AUTH_CALLBACKS = {
  '/google/callback': 'google',
  '/telegram/callback': 'telegram',
  '/x/callback': 'x'
}

function callbackParams(parsed, provider) {
  const params = new URLSearchParams(parsed.search || '')
  params.set('authProvider', provider)
  return Object.fromEntries(params.entries())
}

function callbackRoute(callback = {}) {
  const params = new URLSearchParams()
  Object.entries(callback).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return `/pages/login/index?${params.toString()}`
}

function authCallbackFromDeepLink(parsed) {
  if (parsed.hostname !== 'auth') return null
  const provider = AUTH_CALLBACKS[parsed.pathname]
  return provider ? callbackParams(parsed, provider) : null
}

function isLoginRouteActive() {
  if (typeof window === 'undefined') return false
  const locationText = `${window.location.pathname || ''}${window.location.hash || ''}`
  return locationText.includes('/pages/login/index')
}

function storePendingAuthCallback(callback) {
  try {
    Taro.setStorageSync(PENDING_AUTH_CALLBACK_KEY, JSON.stringify({
      callback,
      receivedAt: Date.now()
    }))
  } catch (_) {}
}

export function clearPendingAndroidAuthCallback() {
  try {
    Taro.removeStorageSync(PENDING_AUTH_CALLBACK_KEY)
  } catch (_) {}
}

export function consumePendingAndroidAuthCallback(maxAgeMs = 10 * 60 * 1000) {
  let raw
  try {
    raw = Taro.getStorageSync(PENDING_AUTH_CALLBACK_KEY)
  } catch (_) {
    raw = ''
  }

  clearPendingAndroidAuthCallback()
  if (!raw) return null

  try {
    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!payload?.callback) return null
    if (payload.receivedAt && Date.now() - Number(payload.receivedAt) > maxAgeMs) return null
    return payload
  } catch (_) {
    return null
  }
}

function emitAuthCallback(callback, rawUrl) {
  if (typeof window === 'undefined' || !callback) return false
  try {
    window.dispatchEvent(new CustomEvent(ANDROID_AUTH_CALLBACK_EVENT, {
      detail: { callback, rawUrl }
    }))
    return true
  } catch (_) {
    return false
  }
}

function routeFromDeepLink(rawUrl = '') {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch (_) {
    return ''
  }

  if (parsed.protocol !== 'seefactory:') return ''

  const authCallback = authCallbackFromDeepLink(parsed)
  if (authCallback) return callbackRoute(authCallback)

  if (parsed.hostname === 'open' && parsed.pathname) {
    const path = parsed.pathname.startsWith('/pages/') ? parsed.pathname : ''
    return path ? `${path}${parsed.search || ''}` : ''
  }

  return ''
}

function navigateDeepLink(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch (_) {
    parsed = null
  }

  const authCallback = parsed?.protocol === 'seefactory:' ? authCallbackFromDeepLink(parsed) : null
  let emitted = false
  if (authCallback) {
    storePendingAuthCallback(authCallback)
    emitted = emitAuthCallback(authCallback, rawUrl)
  }

  const route = routeFromDeepLink(rawUrl)
  if (!route) return
  if (authCallback && emitted && isLoginRouteActive()) return

  Taro.navigateTo({ url: route }).catch(() => {
    Taro.redirectTo({ url: route }).catch(() => {})
  })
}

export async function initAndroidDeepLinks() {
  if (RUNTIME_TARGET !== 'android-apk' || typeof window === 'undefined') return undefined

  const [{ App }, { Capacitor }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/core')
  ])

  if (!Capacitor.isNativePlatform?.()) return undefined

  const listener = await App.addListener('appUrlOpen', ({ url }) => {
    closeExternalAuthBrowser()
    navigateDeepLink(url)
  })

  const launchUrl = await App.getLaunchUrl()
  if (launchUrl?.url) {
    closeExternalAuthBrowser()
    navigateDeepLink(launchUrl.url)
  }

  return () => {
    listener?.remove?.()
  }
}
