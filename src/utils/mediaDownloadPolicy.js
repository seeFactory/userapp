const DEFAULT_WEAPP_DOWNLOAD_ORIGINS = 'https://sf-oss.sidcloud.cn'

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function httpsOrigin(value) {
  const match = String(value || '').trim().match(/^(https:\/\/[^/?#]+)(?:[/?#]|$)/i)
  return match ? match[1].toLowerCase() : ''
}

export function getWeappDownloadOrigins() {
  const configured = process.env.SEEFACTORY_WEAPP_DOWNLOAD_ORIGINS || DEFAULT_WEAPP_DOWNLOAD_ORIGINS
  return unique(String(configured).split(',').map(httpsOrigin))
}

export function isAllowedWeappDownloadUrl(url) {
  const origin = httpsOrigin(url)
  return Boolean(origin && getWeappDownloadOrigins().includes(origin))
}

export function buildMediaDownloadCandidates(downloadUrl, work = {}, runtime = process.env.TARO_ENV) {
  const candidates = unique([
    downloadUrl,
    work.mediaUrl,
    ...(Array.isArray(work.resultUrls) ? work.resultUrls : []),
    work.image,
    work.coverUrl
  ].map((value) => String(value || '').trim()))

  if (runtime !== 'weapp') return candidates

  const allowed = candidates.filter(isAllowedWeappDownloadUrl)
  if (!allowed.length) {
    throw new Error('图片下载地址不在微信小程序白名单内，请联系管理员')
  }
  return allowed
}
