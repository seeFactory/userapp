export const LOGIN_BRANCH = 'tma'
export const BRANCH_CLIENT_RUNTIME = 'telegram-tma'
export const TELEGRAM_SDK_URL = 'https://telegram.org/js/telegram-web-app.js?62'

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
