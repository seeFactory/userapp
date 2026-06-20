export const PAYMENT_BRANCH = 'wechat'
export const PLATFORM_PAY_RUNTIMES = ['wechat-miniapp']

export function isTelegramStarsRuntime(clientRuntime) {
  return clientRuntime === 'telegram-tma'
}

export function isPlatformPaymentRuntime(clientRuntime) {
  return PLATFORM_PAY_RUNTIMES.includes(clientRuntime)
}
