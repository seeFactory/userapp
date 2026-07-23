export function previewImagesFullscreen({ current }) {
  if (!current || typeof window === 'undefined') return
  window.open(current, '_blank', 'noopener,noreferrer')
}
