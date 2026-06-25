const RUNTIME_TARGET = process.env.SEEFACTORY_RUNTIME_TARGET || 'h5'
let externalAuthPlugin

async function nativeBrowser() {
  if (RUNTIME_TARGET !== 'android-apk' || typeof window === 'undefined') return null

  try {
    const [{ Browser }, { Capacitor }] = await Promise.all([
      import('@capacitor/browser'),
      import('@capacitor/core')
    ])
    return Capacitor.isNativePlatform?.() ? Browser : null
  } catch (_) {
    return null
  }
}

async function nativeExternalAuth() {
  if (RUNTIME_TARGET !== 'android-apk' || typeof window === 'undefined') return null

  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform?.()) return null
    if (!externalAuthPlugin) externalAuthPlugin = registerPlugin('ExternalAuth')
    return externalAuthPlugin
  } catch (_) {
    return null
  }
}

function withTimeout(promise, ms = 2500) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('AUTH_BROWSER_OPEN_TIMEOUT')), ms)
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export async function openExternalAuthUrl(url) {
  if (!url) throw new Error('授权地址无效')

  const ExternalAuth = await nativeExternalAuth()
  if (ExternalAuth?.open) {
    try {
      await withTimeout(ExternalAuth.open({ url }))
      return
    } catch (error) {
      if (error?.message === 'AUTH_BROWSER_OPEN_TIMEOUT') throw error
    }
  }

  const Browser = await nativeBrowser()
  if (Browser) {
    await withTimeout(Browser.open({ url, presentationStyle: 'fullscreen' }))
    return
  }

  if (typeof window !== 'undefined') {
    window.location.href = url
  }
}

export async function closeExternalAuthBrowser() {
  const Browser = await nativeBrowser()
  try {
    await Browser?.close?.()
  } catch (_) {}
}
