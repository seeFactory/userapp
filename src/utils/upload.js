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
  const rawMimeType = file.mimeType || file.type || file.originalFileObj?.type || ''
  return {
    key: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name,
    filePath,
    previewPath: file.thumbTempFilePath || filePath,
    size: Number(file.size || file.originalFileObj?.size || 0),
    mimeType: String(rawMimeType).includes('/') ? rawMimeType : ''
  }
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
      return (result.tempFiles || []).map((file, index) => normalizeFile({ ...file, fileType: 'image' }, 'image', index))
    }
    const result = await Taro.chooseImage({
      count: config.maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    })
    return (result.tempFiles || []).map((file, index) => normalizeFile(file, 'image', index))
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

export function uploadToOss(policy, file, onProgress) {
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
        reject(new Error('OSS 上传失败，请稍后重试'))
      },
      fail: () => reject(new Error('素材上传失败，请检查网络或上传域名配置'))
    })
    if (task?.progress) {
      task.progress((event) => onProgress(Math.max(1, Math.min(95, event.progress || 1))))
    }
  })
}
