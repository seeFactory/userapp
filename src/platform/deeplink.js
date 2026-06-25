import Taro from '@tarojs/taro'

const RUNTIME_TARGET = process.env.SEEFACTORY_RUNTIME_TARGET || 'h5'

function routeFromDeepLink(rawUrl = '') {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch (_) {
    return ''
  }

  if (parsed.protocol !== 'seefactory:') return ''

  if (parsed.hostname === 'auth' && parsed.pathname === '/x/callback') {
    return `/pages/login/index${parsed.search || ''}`
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
    navigateDeepLink(url)
  })

  const launchUrl = await App.getLaunchUrl()
  if (launchUrl?.url) {
    navigateDeepLink(launchUrl.url)
  }

  return () => {
    listener?.remove?.()
  }
}
