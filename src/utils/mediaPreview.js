export function isImageUrl(url = '') {
  return /^(data|blob):image\//i.test(String(url))
    || /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(String(url))
}

export function resolveMediaPreviewUrl({ mediaKind, mediaUrl = '', previewUrl = '', coverUrl = '' }) {
  const rawPreviewUrl = previewUrl || coverUrl || (mediaKind === 'image' ? mediaUrl : '')
  if (!rawPreviewUrl) return ''
  if (mediaKind !== 'video') return rawPreviewUrl
  return rawPreviewUrl !== mediaUrl || isImageUrl(rawPreviewUrl) ? rawPreviewUrl : ''
}

export function buildImagePreviewUrls({ mediaKind, mediaUrl = '', resultUrls = [], imageUrl = '', coverUrl = '', previewUrl = '' }) {
  if (mediaKind !== 'image') return []
  return Array.from(new Set([
    mediaUrl,
    ...(Array.isArray(resultUrls) ? resultUrls : []),
    imageUrl,
    previewUrl,
    coverUrl
  ].map((value) => String(value || '').trim()).filter(Boolean)))
}
