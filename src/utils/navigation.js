import Taro from '@tarojs/taro'

export const HOME_PATH = '/pages/index/index'

export const TAB_PATHS = {
  home: '/pages/index/index',
  center: '/pages/create-center/index',
  gallery: '/pages/gallery/index',
  works: '/pages/works/index',
  mine: '/pages/mine/index'
}

const TAB_PATH_VALUES = new Set(Object.values(TAB_PATHS))

function normalizePath(url = HOME_PATH) {
  const nextUrl = url || HOME_PATH
  return nextUrl.startsWith('/') ? nextUrl : `/${nextUrl}`
}

function pathOnly(url = HOME_PATH) {
  return normalizePath(url).split(/[?#]/)[0]
}

export function isTabPath(url) {
  return TAB_PATH_VALUES.has(pathOnly(url))
}

function getStackDepth() {
  try {
    const pages = typeof Taro.getCurrentPages === 'function'
      ? Taro.getCurrentPages()
      : typeof getCurrentPages === 'function'
        ? getCurrentPages()
        : []
    return Array.isArray(pages) ? pages.length : 0
  } catch (_) {
    return 0
  }
}

function runNavigation(fn, fallback) {
  try {
    const result = fn()
    if (result?.catch) result.catch(fallback)
    return result
  } catch (_) {
    return fallback?.()
  }
}

export function goPage(url, options = {}) {
  const target = normalizePath(url)
  if (isTabPath(target)) return goTab(target)
  const method = options.replace ? Taro.redirectTo : Taro.navigateTo
  return runNavigation(
    () => method({ url: target }),
    () => Taro.redirectTo({ url: target })
  )
}

export function goTab(tabKeyOrPath) {
  const target = normalizePath(TAB_PATHS[tabKeyOrPath] || tabKeyOrPath || HOME_PATH)
  const tabTarget = pathOnly(target)
  if (TAB_PATH_VALUES.has(tabTarget)) {
    return runNavigation(
      () => Taro.switchTab({ url: tabTarget }),
      () => Taro.reLaunch({ url: tabTarget })
    )
  }
  return runNavigation(
    () => Taro.redirectTo({ url: target }),
    () => Taro.reLaunch({ url: target })
  )
}

export function safeBack(options = {}) {
  const fallbackUrl = normalizePath(options.fallbackUrl || HOME_PATH)
  const delta = Math.max(1, Number(options.delta || 1))

  if (getStackDepth() > delta) {
    return runNavigation(
      () => Taro.navigateBack({ delta }),
      () => goTab(fallbackUrl)
    )
  }

  return goTab(fallbackUrl)
}
