export const PAYMENT_BRANCH = 'douyin'
export const PLATFORM_PAY_RUNTIMES = ['douyin-miniapp']

export function isTelegramStarsRuntime(clientRuntime) {
  return clientRuntime === 'telegram-tma'
}

export function isPlatformPaymentRuntime(clientRuntime) {
  return PLATFORM_PAY_RUNTIMES.includes(clientRuntime)
}
