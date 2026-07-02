import Taro from '@tarojs/taro'

const LOGIN_KEY = 'seeFactoryLoggedIn'
const TOKEN_KEY = 'seeFactoryToken'
const REFRESH_TOKEN_KEY = 'seeFactoryRefreshToken'
const USER_KEY = 'seeFactoryUser'
const AGREEMENT_PREFIX = 'seeFactoryAgreement'
export const AUTH_CHANGE_EVENT = 'seeFactoryAuthChanged'

export function isLoggedIn() {
  return Taro.getStorageSync(LOGIN_KEY) === '1'
}

export function login() {
  Taro.setStorageSync(LOGIN_KEY, '1')
  emitAuthChanged()
}

export function saveAuth(payload = {}) {
  Taro.setStorageSync(LOGIN_KEY, '1')
  if (payload.accessToken) Taro.setStorageSync(TOKEN_KEY, payload.accessToken)
  if (payload.refreshToken) Taro.setStorageSync(REFRESH_TOKEN_KEY, payload.refreshToken)
  if (payload.user) Taro.setStorageSync(USER_KEY, payload.user)
  emitAuthChanged()
}

export function getAuthToken() {
  return Taro.getStorageSync(TOKEN_KEY)
}

export function getRefreshToken() {
  return Taro.getStorageSync(REFRESH_TOKEN_KEY)
}

export function getCurrentUser() {
  return Taro.getStorageSync(USER_KEY) || null
}

function authSnapshot() {
  return {
    loggedIn: isLoggedIn(),
    user: getCurrentUser()
  }
}

function emitAuthChanged() {
  const detail = authSnapshot()
  try {
    Taro.eventCenter?.trigger?.(AUTH_CHANGE_EVENT, detail)
  } catch (_) {}
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail }))
    } catch (_) {}
  }
}

export function subscribeAuthChange(handler) {
  const notify = (detail) => handler(detail || authSnapshot())
  const eventCenter = Taro.eventCenter
  try {
    eventCenter?.on?.(AUTH_CHANGE_EVENT, notify)
  } catch (_) {}

  let windowHandler
  if (typeof window !== 'undefined') {
    windowHandler = (event) => notify(event?.detail)
    try {
      window.addEventListener(AUTH_CHANGE_EVENT, windowHandler)
    } catch (_) {}
  }

  return () => {
    try {
      eventCenter?.off?.(AUTH_CHANGE_EVENT, notify)
    } catch (_) {}
    if (windowHandler && typeof window !== 'undefined') {
      try {
        window.removeEventListener(AUTH_CHANGE_EVENT, windowHandler)
      } catch (_) {}
    }
  }
}

function currentUserKey() {
  const user = getCurrentUser() || {}
  return user.id || user._id || user.providerUserId || 'current'
}

export function hasAcceptedAgreement(type, version) {
  if (!type || !version) return false
  return Taro.getStorageSync(`${AGREEMENT_PREFIX}:${currentUserKey()}:${type}:${version}`) === '1'
}

export function acceptAgreement(type, version) {
  if (!type || !version) return
  Taro.setStorageSync(`${AGREEMENT_PREFIX}:${currentUserKey()}:${type}:${version}`, '1')
}

export function logout() {
  Taro.removeStorageSync(LOGIN_KEY)
  Taro.removeStorageSync(TOKEN_KEY)
  Taro.removeStorageSync(REFRESH_TOKEN_KEY)
  Taro.removeStorageSync(USER_KEY)
  emitAuthChanged()
}

export function requireLogin(redirect) {
  if (isLoggedIn()) return true
  const source = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
  Taro.navigateTo({ url: `/pages/login/index${source}` })
  return false
}
