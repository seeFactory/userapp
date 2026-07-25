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
  return false
}

export function useMiniappShare(options = {}) {
  const enabled = options.enabled !== false
  const timelineEnabled = enabled && options.timelineEnabled !== false
  return {
    enabled,
    path: buildMiniappSharePath(options.path || DEFAULT_PATH, options.query),
    query: buildMiniappShareQuery(options.query),
    timelineEnabled
  }
}
