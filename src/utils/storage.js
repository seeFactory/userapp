import Taro from '@tarojs/taro'
import { seedWorks } from '../data/mock'

const LOGIN_KEY = 'seeFactoryLoggedIn'
const WORKS_KEY = 'seeFactoryWorks'

export function isLoggedIn() {
  return Taro.getStorageSync(LOGIN_KEY) === '1'
}

export function login() {
  Taro.setStorageSync(LOGIN_KEY, '1')
}

export function logout() {
  Taro.removeStorageSync(LOGIN_KEY)
}

export function getWorks() {
  const cached = Taro.getStorageSync(WORKS_KEY)
  if (cached && Array.isArray(cached)) {
    return cached
  }
  Taro.setStorageSync(WORKS_KEY, seedWorks)
  return seedWorks
}

export function saveWorks(works) {
  Taro.setStorageSync(WORKS_KEY, works)
}

export function addWork(work) {
  const works = getWorks()
  const next = [work, ...works]
  saveWorks(next)
  return next
}

export function clearFailedWorks() {
  const next = getWorks().filter((item) => item.status !== 'failed')
  saveWorks(next)
  return next
}

export function removeWork(id) {
  const next = getWorks().filter((item) => item.id !== id)
  saveWorks(next)
  return next
}

export function requireLogin(redirect) {
  if (isLoggedIn()) return true
  const source = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
  Taro.navigateTo({ url: `/pages/login/index${source}` })
  return false
}
