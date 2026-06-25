import Taro from '@tarojs/taro'
import { closeExternalAuthBrowser } from './externalAuth'

const RUNTIME_TARGET = process.env.SEEFACTORY_RUNTIME_TARGET || 'h5'

const AUTH_CALLBACKS = {
  '/google/callback': 'google',
  '/telegram/callback': 'telegram',
  '/x/callback': 'x'
}

function callbackRoute(parsed, provider) {
  const params = new URLSearchParams(parsed.search || '')
  params.set('authProvider', provider)
  return `/pages/login/index?${params.toString()}`
}

function routeFromDeepLink(rawUrl = '') {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch (_) {
    return ''
  }

  if (parsed.protocol !== 'seefactory:') return ''

  if (parsed.hostname === 'auth' && AUTH_CALLBACKS[parsed.pathname]) {
    return callbackRoute(parsed, AUTH_CALLBACKS[parsed.pathname])
  }

  if (parsed.hostname === 'open' && parsed.pathname) {
    const path = parsed.pathname.startsWith('/pages/') ? parsed.pathname : ''
    return path ? `${path}${parsed.search || ''}` : ''
  }

  return ''
}

function navigateDeepLink(rawUrl) {
  const route = routeFromDeepLink(rawUrl)
  if (!route) return

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
