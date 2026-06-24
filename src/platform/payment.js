export const PAYMENT_BRANCH = 'apk'
export const PLATFORM_PAY_RUNTIMES = []

export function isTelegramStarsRuntime(clientRuntime) {
  return clientRuntime === 'telegram-tma'
}

export function isPlatformPaymentRuntime(clientRuntime) {
  return PLATFORM_PAY_RUNTIMES.includes(clientRuntime)
}
