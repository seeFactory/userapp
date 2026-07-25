import Taro from '@tarojs/taro'

const ALBUM_SCOPE = 'scope.writePhotosAlbum'

export { buildMediaDownloadCandidates } from './mediaDownloadPolicy'

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function callTaroApi(api, options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof api !== 'function') {
      reject(new Error('当前平台不支持此操作'))
      return
    }
    api({ ...options, success: resolve, fail: reject })
  })
}

function rawErrorMessage(error) {
  return String(error?.errMsg || error?.message || '')
}

function downloadError(error) {
  const message = rawErrorMessage(error)
  if (/domain list|url not in domain list|合法域名/i.test(message)) {
    return new Error('图片下载域名未加入微信小程序白名单')
  }
  if (/timeout/i.test(message)) return new Error('图片下载超时，请检查网络后重试')
  if (/HTTP\s*403|statusCode[:=]?\s*403/i.test(message)) return new Error('图片下载地址已失效，请重新打开作品后重试')
  return new Error(message ? `图片下载失败：${message}` : '图片下载失败，请稍后重试')
}

async function downloadOne(url) {
  try {
    const response = await callTaroApi(Taro.downloadFile, { url })
    if (response?.statusCode >= 200 && response.statusCode < 300 && response.tempFilePath) {
      return response.tempFilePath
    }
    throw new Error(`HTTP ${response?.statusCode || 'unknown'}`)
  } catch (error) {
    throw downloadError(error)
  }
}

export async function downloadMediaTempFile(candidates) {
  const urls = unique(Array.isArray(candidates) ? candidates : [candidates])
  let lastError = null
  for (const url of urls) {
    try {
      return await downloadOne(url)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('图片下载地址为空')
}

async function getAlbumPermission() {
  if (typeof Taro.getSetting !== 'function') return undefined
  const settings = await callTaroApi(Taro.getSetting)
  return settings?.authSetting?.[ALBUM_SCOPE]
}

async function recoverAlbumPermission() {
  if (typeof Taro.openSetting !== 'function') {
    throw new Error('请在微信系统设置中允许保存图片到相册')
  }
  const modal = await callTaroApi(Taro.showModal, {
    title: '需要相册权限',
    content: '请在设置中允许保存图片到相册。',
    confirmText: '去设置'
  })
  if (!modal?.confirm) throw new Error('未获得保存到相册权限')
  const settings = await callTaroApi(Taro.openSetting)
  if (settings?.authSetting?.[ALBUM_SCOPE] !== true) {
    throw new Error('未获得保存到相册权限')
  }
}

async function saveOnce(filePath, mediaKind) {
  const api = mediaKind === 'video' ? Taro.saveVideoToPhotosAlbum : Taro.saveImageToPhotosAlbum
  if (typeof api !== 'function') {
    throw new Error(mediaKind === 'video' ? '当前平台暂不支持保存视频' : '当前平台暂不支持保存图片')
  }
  try {
    await callTaroApi(api, { filePath })
  } catch (error) {
    const wrapped = new Error(rawErrorMessage(error) || '保存到相册失败')
    wrapped.originalError = error
    throw wrapped
  }
}

export async function saveMediaToAlbum(filePath, mediaKind) {
  if (await getAlbumPermission() === false) await recoverAlbumPermission()

  try {
    await saveOnce(filePath, mediaKind)
  } catch (error) {
    const message = rawErrorMessage(error.originalError || error)
    if (/privacy|隐私/i.test(message)) {
      throw new Error('微信小程序相册隐私权限尚未配置，请联系管理员')
    }
    if (/auth deny|authorize|permission|writePhotosAlbum|deny/i.test(message)) {
      await recoverAlbumPermission()
      await saveOnce(filePath, mediaKind)
      return
    }
    throw new Error(message ? `保存到相册失败：${message}` : '保存到相册失败，请稍后重试')
  }
}
