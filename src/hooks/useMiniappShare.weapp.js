import { useEffect } from 'react'
import Taro from '@tarojs/taro'

const DEFAULT_TITLE = 'seeFactory AI 创作工厂'
const DEFAULT_PATH = '/pages/index/index'

function normalizedPath(path) {
  const value = String(path || DEFAULT_PATH).trim().split(/[?#]/)[0]
  if (!value) return DEFAULT_PATH
  return value.startsWith('/') ? value : `/${value}`
}

export function buildMiniappShareQuery(query = {}) {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

export function buildMiniappSharePath(path, query = {}) {
  const basePath = normalizedPath(path)
  const queryText = buildMiniappShareQuery(query)
  return queryText ? `${basePath}?${queryText}` : basePath
}

export function isWechatMiniappRuntime() {
  return true
}

function shareTitle(value) {
  return String(value || DEFAULT_TITLE).trim().slice(0, 64) || DEFAULT_TITLE
}

function optionalImage(imageUrl) {
  const value = String(imageUrl || '').trim()
  return value ? { imageUrl: value } : {}
}

export function useMiniappShare(options = {}) {
  const enabled = options.enabled !== false
  const timelineEnabled = enabled && options.timelineEnabled !== false
  const title = shareTitle(options.title)
  const timelineTitle = shareTitle(options.timelineTitle || options.title)
  const path = buildMiniappSharePath(options.path || DEFAULT_PATH, options.query)
  const query = buildMiniappShareQuery(options.query)
  const image = optionalImage(options.imageUrl)

  Taro.useShareAppMessage(() => ({
    title: enabled ? title : DEFAULT_TITLE,
    path: enabled ? path : DEFAULT_PATH,
    ...image
  }))

  Taro.useShareTimeline(() => ({
    title: timelineEnabled ? timelineTitle : DEFAULT_TITLE,
    query: timelineEnabled ? query : '',
    ...image
  }))

  useEffect(() => {
    const callMenu = (method, payload) => {
      try {
        method?.(payload)?.catch?.(() => undefined)
      } catch (_) {}
    }
    if (!enabled) {
      callMenu(Taro.hideShareMenu, { menus: ['shareAppMessage', 'shareTimeline'] })
      return undefined
    }

    const menus = timelineEnabled ? ['shareAppMessage', 'shareTimeline'] : ['shareAppMessage']
    callMenu(Taro.showShareMenu, { menus })
    if (!timelineEnabled) {
      callMenu(Taro.hideShareMenu, { menus: ['shareTimeline'] })
    }
    return undefined
  }, [enabled, timelineEnabled])

  return { enabled, path, query, timelineEnabled }
}

