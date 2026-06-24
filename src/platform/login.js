export const LOGIN_BRANCH = 'apk'
export const BRANCH_CLIENT_RUNTIME = 'h5-google'

export function isTelegramRuntimeTarget(runtimeTarget = 'h5') {
  return runtimeTarget === 'tma' || runtimeTarget === 'telegram-tma'
}

export function resolveClientRuntime({
  runtimeTarget = 'h5',
  taroEnv = '',
  hasTelegramWebApp = false
} = {}) {
  if (BRANCH_CLIENT_RUNTIME) return BRANCH_CLIENT_RUNTIME
  if (isTelegramRuntimeTarget(runtimeTarget)) return 'telegram-tma'
  if (hasTelegramWebApp) return 'telegram-tma'
  if (taroEnv === 'weapp') return 'wechat-miniapp'
  if (taroEnv === 'alipay') return 'alipay-miniapp'
  if (taroEnv === 'tt') return 'douyin-miniapp'
  if (taroEnv === 'qq') return 'qq-miniapp'
  return 'h5-google'
}

export function shouldLoadTelegramSdk(runtimeTarget = 'h5') {
  return BRANCH_CLIENT_RUNTIME === 'telegram-tma' || isTelegramRuntimeTarget(runtimeTarget)
}

export function telegramSdkUrl(runtimeTarget = 'h5') {
  return ''
}
