import Taro from '@tarojs/taro'

export const uploadLimits = {
  image: {
    label: '图片',
    maxSize: 20 * 1024 * 1024,
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    icon: 'image',
    tip: '支持 JPG / PNG / WebP，单张最大 20 MB'
  },
  video: {
    label: '视频',
    maxSize: 500 * 1024 * 1024,
    extensions: ['mp4', 'mov', 'webm', 'm4v'],
    icon: 'video',
    tip: '支持 MP4 / MOV / WebM，单个最大 500 MB'
  },
  audio: {
    label: '音频',
    maxSize: 100 * 1024 * 1024,
    extensions: ['mp3', 'wav', 'm4a', 'aac'],
    icon: 'music',
    tip: '支持 MP3 / WAV / M4A / AAC，单个最大 100 MB'
  }
}

export const videoReferenceTargets = {
  portrait: { width: 720, height: 1280, ratio: '9:16', resolution: '720x1280' },
  landscape: { width: 1280, height: 720, ratio: '16:9', resolution: '1280x720' }
}

export function videoReferenceTargetForDimensions(dimensions = {}) {
  return Number(dimensions.width || 0) > Number(dimensions.height || 0)
    ? videoReferenceTargets.landscape
    : videoReferenceTargets.portrait
}

export function formatFileSize(size = 0) {
  if (!size) return '未知大小'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(size > 10 * 1024 * 1024 ? 0 : 1)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export function getExt(input = '') {
  const clean = String(input).split('?')[0].split('#')[0]
  const name = clean.split(/[\\/]/).pop() || ''
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

const mimeTypeByExtension = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac'
}

const defaultMimeTypeByKind = {
  image: 'image/jpeg',
  video: 'video/mp4',
  audio: 'audio/mpeg',
  file: 'application/octet-stream'
}

export function inferUploadMimeType(file = {}, fallbackType = 'image') {
  const rawMimeType = String(file.mimeType || file.type || file.originalFileObj?.type || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (rawMimeType.includes('/')) return rawMimeType
  const filePath = file.tempFilePath || file.path || file.url || ''
  const name = file.name || file.originalFileObj?.name || filePath
  return mimeTypeByExtension[getExt(name || filePath)] || defaultMimeTypeByKind[fallbackType] || defaultMimeTypeByKind.file
}

function inferFileType(file, fallbackType = 'image') {
  const fileType = file.fileType || file.kind || ''
  const rawMimeType = file.mimeType || file.type || file.originalFileObj?.type || ''
  const mimeType = String(rawMimeType).includes('/') ? rawMimeType : ''
  const filePath = file.tempFilePath || file.path || ''
  const name = file.name || filePath
  const ext = getExt(name || filePath)
  if (fileType === 'image' || mimeType.startsWith('image/') || uploadLimits.image.extensions.includes(ext)) return 'image'
  if (fileType === 'video' || mimeType.startsWith('video/') || uploadLimits.video.extensions.includes(ext)) return 'video'
  if (fileType === 'audio' || mimeType.startsWith('audio/') || uploadLimits.audio.extensions.includes(ext)) return 'audio'
  return fallbackType
}

function normalizeFile(file, fallbackType, index) {
  const filePath = file.tempFilePath || file.path || file.url || ''
  const name = file.name || file.originalFileObj?.name || filePath.split(/[\\/]/).pop() || `${fallbackType}-${Date.now()}-${index}`
  const type = inferFileType(file, fallbackType)
  const width = Number(file.width || file.originalFileObj?.width || 0)
  const height = Number(file.height || file.originalFileObj?.height || 0)
  return {
    key: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name,
    filePath,
    previewPath: file.thumbTempFilePath || filePath,
    size: Number(file.size || file.originalFileObj?.size || 0),
    mimeType: inferUploadMimeType(file, type),
    width: Number.isFinite(width) && width > 0 ? Math.floor(width) : undefined,
    height: Number.isFinite(height) && height > 0 ? Math.floor(height) : undefined,
    originalFileObj: file.originalFileObj || file.originalFile || null
  }
}

function browserImageInfo(src) {
  if (typeof window === 'undefined' || !window.Image || !src) return Promise.resolve({})
  return new Promise((resolve) => {
    const image = new window.Image()
    image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height })
    image.onerror = () => resolve({})
    image.src = src
  })
}

async function withImageInfo(files) {
  return Promise.all(files.map(async (file) => {
    if (file.type !== 'image' || (file.width && file.height)) return file
    let info = {}
    if (typeof Taro.getImageInfo === 'function' && file.filePath) {
      try {
        info = await Taro.getImageInfo({ src: file.filePath })
      } catch (_) {}
    }
    if (!info.width || !info.height) info = await browserImageInfo(file.filePath || file.previewPath)
    return { ...file, width: Number(info.width) || undefined, height: Number(info.height) || undefined }
  }))
}

export function validateUploadFile(file, config, subject = '当前工具') {
  if (!file.filePath) return '素材文件读取失败，请重新选择'
  if (!config.acceptTypes.includes(file.type)) return `${subject}不支持上传${uploadLimits[file.type]?.label || '该类型'}素材`
  const limit = uploadLimits[file.type]
  const ext = getExt(file.name || file.filePath)
  if (ext && !limit.extensions.includes(ext)) return `${limit.label}格式不支持，请上传 ${limit.extensions.join(' / ')}`
  if (file.size && file.size > limit.maxSize) return `${limit.label}超过大小限制，最大 ${formatFileSize(limit.maxSize)}`
  return ''
}

export async function chooseTypedFiles(config) {
  let acceptTypes = config.acceptTypes
  if (acceptTypes.length > 1) {
    const action = await Taro.showActionSheet({ itemList: acceptTypes.map((type) => uploadLimits[type].label) })
    acceptTypes = [acceptTypes[action.tapIndex]]
  }
  const chosenType = acceptTypes[0]
  if (chosenType === 'image') {
    if (typeof Taro.chooseMedia === 'function') {
      const result = await Taro.chooseMedia({
        count: config.maxCount,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      return withImageInfo((result.tempFiles || []).map((file, index) => normalizeFile({ ...file, fileType: 'image' }, 'image', index)))
    }
    const result = await Taro.chooseImage({
      count: config.maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    })
    return withImageInfo((result.tempFiles || []).map((file, index) => normalizeFile(file, 'image', index)))
  }
  if (chosenType === 'video') {
    if (typeof Taro.chooseMedia === 'function') {
      const result = await Taro.chooseMedia({
        count: config.maxCount,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back'
      })
      return (result.tempFiles || []).map((file, index) => normalizeFile({ ...file, fileType: 'video' }, 'video', index))
    }
    if (typeof Taro.chooseVideo === 'function') {
      const result = await Taro.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back'
      })
      return [normalizeFile({ ...result, fileType: 'video' }, 'video', 0)]
    }
  }
  if (chosenType === 'audio' && typeof Taro.chooseMessageFile === 'function') {
    const result = await Taro.chooseMessageFile({
      count: config.maxCount,
      type: 'file',
      extension: uploadLimits.audio.extensions
    })
    return (result.tempFiles || []).map((file, index) => normalizeFile(file, 'audio', index))
  }
  throw new Error('当前平台暂不支持选择该类型素材')
}

async function resolveUploadBlob(file) {
  if (typeof Blob !== 'undefined' && file?.originalFileObj instanceof Blob) return file.originalFileObj
  if (file?.filePath && typeof fetch === 'function') {
    const response = await fetch(file.filePath)
    if (response.ok) return response.blob()
  }
  throw new Error('素材文件读取失败，请重新选择')
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('参考图适配失败，请重新上传')), 'image/jpeg', 0.92)
  })
}

export async function normalizeImageForVideoReference(file) {
  if (file?.type !== 'image' || process.env.TARO_ENV !== 'h5') return file
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof window === 'undefined') return file
  const sourceBlob = await resolveUploadBlob(file)
  const sourceUrl = URL.createObjectURL(sourceBlob)
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new window.Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('参考图读取失败，请重新上传'))
      element.src = sourceUrl
    })
    const sourceWidth = Number(file.width || image.naturalWidth || image.width || 0)
    const sourceHeight = Number(file.height || image.naturalHeight || image.height || 0)
    if (!sourceWidth || !sourceHeight) return file
    const target = videoReferenceTargetForDimensions({ width: sourceWidth, height: sourceHeight })
    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const context = canvas.getContext('2d')
    if (!context) return file
    const scale = Math.max(target.width / sourceWidth, target.height / sourceHeight)
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale
    context.fillStyle = '#000'
    context.fillRect(0, 0, target.width, target.height)
    context.drawImage(image, (target.width - drawWidth) / 2, (target.height - drawHeight) / 2, drawWidth, drawHeight)
    const outputBlob = await canvasToBlob(canvas)
    const outputUrl = URL.createObjectURL(outputBlob)
    return {
      ...file,
      name: String(file.name || `video-reference-${Date.now()}.jpg`).replace(/\.[a-z0-9]{2,8}$/i, '.jpg'),
      filePath: outputUrl,
      previewPath: outputUrl,
      size: outputBlob.size,
      mimeType: 'image/jpeg',
      width: target.width,
      height: target.height,
      targetRatio: target.ratio,
      targetResolution: target.resolution,
      videoReferenceNormalized: true,
      originalFileObj: outputBlob
    }
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function uploadViaSignedPut(policy, file, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const blob = await resolveUploadBlob(file)
      const xhr = new XMLHttpRequest()
      xhr.open(policy.httpMethod || 'PUT', policy.uploadUrl, true)
      Object.entries(policy.headers || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') xhr.setRequestHeader(key, String(value))
      })
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.max(1, Math.min(95, Math.round((event.loaded / event.total) * 100))))
      }
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300
        ? resolve({ statusCode: xhr.status, data: xhr.responseText })
        : reject(new Error(uploadFailureMessage({ statusCode: xhr.status, data: xhr.responseText })))
      xhr.onerror = () => reject(new Error(uploadFailureMessage({ errMsg: 'uploadFile:fail network error' })))
      xhr.send(blob)
    } catch (error) {
      reject(error)
    }
  })
}

export function uploadFailureMessage(input = {}) {
  const statusCode = Number(input.statusCode || input.status || 0)
  const rawData = typeof input.data === 'string' ? input.data : ''
  const detail = `${input.errMsg || input.message || ''} ${rawData}`.toLowerCase()
  if (detail.includes('domain list') || detail.includes('url not in domain')) {
    return '上传域名未加入小程序 uploadFile 合法域名，请联系管理员更新白名单'
  }
  if (detail.includes('timeout')) return '素材上传超时，请检查网络后重试'
  if (detail.includes('abort') || detail.includes('cancel')) return '素材上传已取消'
  if (statusCode === 413 || detail.includes('entitytoolarge')) return '素材超过上传大小限制，请压缩后重试'
  if (statusCode === 401 || statusCode === 403 || detail.includes('accessdenied') || detail.includes('signature')) {
    return '上传凭证校验失败，请重新选择素材后重试'
  }
  if (statusCode > 0) return `OSS 上传失败（HTTP ${statusCode}），请稍后重试`
  return '素材上传失败，请检查网络后重试'
}

export function uploadToOss(policy, file, onProgress) {
  if (policy?.uploadMode === 'signed-put') return uploadViaSignedPut(policy, file, onProgress)
  return new Promise((resolve, reject) => {
    const task = Taro.uploadFile({
      url: policy.uploadUrl,
      filePath: file.filePath,
      name: 'file',
      formData: policy.fields,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res)
          return
        }
        reject(new Error(uploadFailureMessage(res)))
      },
      fail: (error) => reject(new Error(uploadFailureMessage(error)))
    })
    if (task?.progress) {
      task.progress((event) => onProgress?.(Math.max(1, Math.min(95, event.progress || 1))))
    }
  })
}
