const RUNTIME_TARGET = process.env.SEEFACTORY_RUNTIME_TARGET || 'h5'

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

export async function openExternalAuthUrl(url) {
  const Browser = await nativeBrowser()
  if (Browser) {
    await Browser.open({ url, presentationStyle: 'fullscreen' })
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
