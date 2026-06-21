export const LOGIN_BRANCH = 'tma'
export const BRANCH_CLIENT_RUNTIME = 'telegram-tma'
export const TELEGRAM_SDK_URL = 'https://telegram.org/js/telegram-web-app.js?62'
export const TELEGRAM_LAUNCH_PARAMS_KEY = 'seeFactoryTgLaunchParams'

export function resolveClientRuntime({
  runtimeTarget = 'h5',
  taroEnv = '',
  hasTelegramWebApp = false
} = {}) {
  if (BRANCH_CLIENT_RUNTIME) return BRANCH_CLIENT_RUNTIME
  if (runtimeTarget === 'tma') return 'telegram-tma'
  if (hasTelegramWebApp) return 'telegram-tma'
  if (taroEnv === 'weapp') return 'wechat-miniapp'
  if (taroEnv === 'alipay') return 'alipay-miniapp'
  if (taroEnv === 'tt') return 'douyin-miniapp'
  if (taroEnv === 'qq') return 'qq-miniapp'
  return 'h5-google'
}

export function shouldLoadTelegramSdk(runtimeTarget = 'h5') {
  return BRANCH_CLIENT_RUNTIME === 'telegram-tma' || runtimeTarget === 'tma'
}

export function readTelegramLaunchParams() {
  if (typeof window === 'undefined') return ''
  if (window.__SEEFACTORY_TG_LAUNCH_PARAMS__) return window.__SEEFACTORY_TG_LAUNCH_PARAMS__

  const current = window.location.hash || window.location.search || ''
  if (window.location.hash?.includes('?')) {
    const routeParams = new URLSearchParams(window.location.hash.slice(window.location.hash.indexOf('?') + 1))
    const tgLaunch = routeParams.get('tgLaunch')
    if (tgLaunch) return tgLaunch
  }
  if (/(^|[#?&])tgWebApp(Data|Version|Platform|ThemeParams)=/.test(current)) {
    return current.charAt(0) === '#' || current.charAt(0) === '?' ? current.slice(1) : current
  }

  try {
    return window.sessionStorage.getItem(TELEGRAM_LAUNCH_PARAMS_KEY) || ''
  } catch (error) {
    return ''
  }
}

export function getTelegramInitDataFromLaunchParams() {
  const raw = readTelegramLaunchParams()
  if (!raw) return ''
  const params = new URLSearchParams(raw)
  return params.get('tgWebAppData') || ''
}

export function getTelegramUserFromInitData(initData = getTelegramInitDataFromLaunchParams()) {
  if (!initData) return {}
  try {
    const params = new URLSearchParams(initData)
    const user = params.get('user')
    return user ? JSON.parse(user) : {}
  } catch (error) {
    return {}
  }
}
