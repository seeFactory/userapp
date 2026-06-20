export const PAYMENT_BRANCH = 'qq'
export const PLATFORM_PAY_RUNTIMES = ['qq-miniapp']

export function isTelegramStarsRuntime(clientRuntime) {
  return clientRuntime === 'telegram-tma'
}

export function isPlatformPaymentRuntime(clientRuntime) {
  return PLATFORM_PAY_RUNTIMES.includes(clientRuntime)
}
