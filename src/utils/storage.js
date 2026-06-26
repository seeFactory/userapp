import Taro from '@tarojs/taro'

const LOGIN_KEY = 'seeFactoryLoggedIn'
const TOKEN_KEY = 'seeFactoryToken'
const REFRESH_TOKEN_KEY = 'seeFactoryRefreshToken'
const USER_KEY = 'seeFactoryUser'
const AGREEMENT_PREFIX = 'seeFactoryAgreement'
export const AUTH_CHANGED_EVENT = 'seeFactory:auth-changed'

export function isLoggedIn() {
  return Taro.getStorageSync(LOGIN_KEY) === '1'
}

export function login() {
  Taro.setStorageSync(LOGIN_KEY, '1')
  emitAuthChanged({ loggedIn: true, reason: 'login' })
}

export function saveAuth(payload = {}) {
  Taro.setStorageSync(LOGIN_KEY, '1')
  if (payload.accessToken) Taro.setStorageSync(TOKEN_KEY, payload.accessToken)
  if (payload.refreshToken) Taro.setStorageSync(REFRESH_TOKEN_KEY, payload.refreshToken)
  if (payload.user) Taro.setStorageSync(USER_KEY, payload.user)
  emitAuthChanged({ loggedIn: true, user: payload.user || getCurrentUser(), reason: 'login' })
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

function emitAuthChanged(detail = {}) {
  const payload = {
    loggedIn: detail.loggedIn ?? isLoggedIn(),
    user: detail.user !== undefined ? detail.user : getCurrentUser(),
    reason: detail.reason || 'auth',
    changedAt: Date.now()
  }
  try {
    Taro.eventCenter?.trigger?.(AUTH_CHANGED_EVENT, payload)
  } catch (_) {}
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: payload }))
    } catch (_) {}
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
  emitAuthChanged({ loggedIn: false, user: null, reason: 'logout' })
}

export function requireLogin(redirect) {
  if (isLoggedIn()) return true
  const source = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
  Taro.navigateTo({ url: `/pages/login/index${source}` })
  return false
}
