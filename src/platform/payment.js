export const PAYMENT_BRANCH = 'alipay'
export const PLATFORM_PAY_RUNTIMES = ['alipay-miniapp']

export function isTelegramStarsRuntime(clientRuntime) {
  return clientRuntime === 'telegram-tma'
}

export function isPlatformPaymentRuntime(clientRuntime) {
  return PLATFORM_PAY_RUNTIMES.includes(clientRuntime)
}
