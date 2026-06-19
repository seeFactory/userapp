import Taro from '@tarojs/taro'

const LOGIN_KEY = 'seeFactoryLoggedIn'
const TOKEN_KEY = 'seeFactoryToken'
const REFRESH_TOKEN_KEY = 'seeFactoryRefreshToken'
const USER_KEY = 'seeFactoryUser'

export function isLoggedIn() {
  return Taro.getStorageSync(LOGIN_KEY) === '1'
}

export function login() {
  Taro.setStorageSync(LOGIN_KEY, '1')
}

export function saveAuth(payload = {}) {
  Taro.setStorageSync(LOGIN_KEY, '1')
  if (payload.accessToken) Taro.setStorageSync(TOKEN_KEY, payload.accessToken)
  if (payload.refreshToken) Taro.setStorageSync(REFRESH_TOKEN_KEY, payload.refreshToken)
  if (payload.user) Taro.setStorageSync(USER_KEY, payload.user)
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

export function logout() {
  Taro.removeStorageSync(LOGIN_KEY)
  Taro.removeStorageSync(TOKEN_KEY)
  Taro.removeStorageSync(REFRESH_TOKEN_KEY)
  Taro.removeStorageSync(USER_KEY)
}

export function requireLogin(redirect) {
  if (isLoggedIn()) return true
  const source = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
  Taro.navigateTo({ url: `/pages/login/index${source}` })
  return false
}
