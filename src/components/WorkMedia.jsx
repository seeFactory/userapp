import { useEffect, useState } from 'react'
import { View, Text, Image, Video } from '@tarojs/components'
import AppIcon from './AppIcon'
import { inferWorkMediaKind } from '../services/api'
import { resolveMediaPreviewUrl } from '../utils/mediaPreview'

const fallbackCover = 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=900&q=80'
const firstFrameCache = new Map()
const FRAME_CAPTURE_TIMEOUT = 8000

function resolveMedia(item = {}, fallbackUrl = fallbackCover) {
  const resultUrl = item.resultUrls?.[0] || ''
  const mediaUrl = item.mediaUrl || resultUrl || item.image || item.coverUrl || ''
  const mediaKind = item.mediaKind || inferWorkMediaKind(item, mediaUrl)
  const previewUrl = resolveMediaPreviewUrl({
    mediaKind,
    mediaUrl,
    previewUrl: item.previewUrl,
    coverUrl: item.coverUrl
  })
  const imageUrl = previewUrl || (!mediaUrl || mediaKind !== 'video' ? fallbackUrl : '')
  return { mediaUrl, mediaKind, previewUrl, imageUrl }
}

function captureVideoFrame(mediaUrl) {
  return new Promise((resolve) => {
    if (!mediaUrl || process.env.TARO_ENV !== 'h5' || typeof document === 'undefined') {
      resolve('')
      return
    }
    const video = document.createElement('video')
    let settled = false
    const finish = (value = '') => {
      if (settled) return
      settled = true
      try {
        video.pause()
        video.removeAttribute('src')
        video.load()
      } catch (_) {}
      resolve(value)
    }
    const timer = setTimeout(() => finish(''), FRAME_CAPTURE_TIMEOUT)
    const complete = (value = '') => {
      clearTimeout(timer)
      finish(value)
    }
    const drawFrame = () => {
      try {
        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
        const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) return complete('')
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        complete(canvas.toDataURL('image/jpeg', 0.82))
      } catch (_) {
        complete('')
      }
    }
    const seekToFirstFrame = () => {
      try {
        if (Number.isFinite(video.duration) && video.duration > 0.12 && video.currentTime < 0.04) {
          video.currentTime = 0.08
          return
        }
      } catch (_) {}
      drawFrame()
    }
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.addEventListener('loadedmetadata', seekToFirstFrame, { once: true })
    video.addEventListener('loadeddata', drawFrame)
    video.addEventListener('canplay', drawFrame)
    video.addEventListener('seeked', drawFrame)
    video.addEventListener('error', () => complete(''), { once: true })
    video.src = mediaUrl
    try {
      video.load()
      setTimeout(drawFrame, 600)
      setTimeout(drawFrame, 1800)
    } catch (_) {
      complete('')
    }
  })
}

function useVideoFirstFrame(mediaUrl, enabled) {
  const [frameUrl, setFrameUrl] = useState('')
  useEffect(() => {
    let canceled = false
    if (!enabled || !mediaUrl) {
      setFrameUrl('')
      return () => { canceled = true }
    }
    const cached = firstFrameCache.get(mediaUrl)
    if (cached) {
      setFrameUrl(cached)
      return () => { canceled = true }
    }
    captureVideoFrame(mediaUrl).then((value) => {
      if (value) firstFrameCache.set(mediaUrl, value)
      if (!canceled) setFrameUrl(value || '')
    })
    return () => { canceled = true }
  }, [mediaUrl, enabled])
  return frameUrl
}

export default function WorkMedia({
  item,
  className = 'work-image',
  fallbackUrl = fallbackCover,
  controls = false,
  autoplay = true,
  loop = false,
  muted = true,
  showBadge = true,
  objectFit = 'cover'
}) {
  const [playing, setPlaying] = useState(false)
  const { mediaUrl, mediaKind, previewUrl, imageUrl } = resolveMedia(item, fallbackUrl)
  const isVideo = mediaKind === 'video' && mediaUrl
  const firstFrameUrl = useVideoFirstFrame(mediaUrl, isVideo && !previewUrl)
  const videoPreviewUrl = previewUrl || firstFrameUrl
  const isInteractive = Boolean(isVideo && controls)
  const isPlaying = Boolean(isInteractive && playing)
  const coverMode = objectFit === 'contain' ? 'aspectFit' : 'aspectFill'

  useEffect(() => setPlaying(false), [mediaUrl])

  useEffect(() => {
    if (!isPlaying || !isVideo || process.env.TARO_ENV !== 'h5' || typeof document === 'undefined') return undefined
    let canceled = false
    const playMountedVideo = () => {
      if (canceled) return
      const videos = Array.from(document.querySelectorAll('.work-media-frame.playing .work-media-video video'))
      const video = videos.find((item) => (item.currentSrc || item.src || '') === mediaUrl) || videos[0]
      if (!video?.play) return
      video.muted = Boolean(muted)
      video.playsInline = true
      video.play().catch(() => {})
    }
    const timers = [setTimeout(playMountedVideo, 0), setTimeout(playMountedVideo, 320)]
    return () => {
      canceled = true
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [isPlaying, isVideo, mediaUrl, muted])

  const playVideo = (event) => {
    if (!isInteractive || isPlaying) return
    event?.stopPropagation?.()
    setPlaying(true)
  }

  return (
    <View
      className={`${className} work-media-frame ${isInteractive ? 'interactive-media-frame' : ''} ${isPlaying ? 'playing' : 'previewing'} ${isVideo ? 'video-media-frame' : 'image-media-frame'}`}
      onClick={isInteractive && !isPlaying ? playVideo : undefined}
    >
      {isVideo ? (
        isPlaying ? (
          <Video
            className='work-media-element work-media-video'
            src={mediaUrl}
            poster={videoPreviewUrl}
            controls
            autoplay={autoplay}
            loop={loop}
            muted={muted}
            playsInline
            objectFit={objectFit}
            showCenterPlayBtn
            showPlayBtn
            showFullscreenBtn
            enableProgressGesture
          />
        ) : videoPreviewUrl ? (
          <Image className='work-media-element work-media-cover' src={videoPreviewUrl} mode={coverMode} />
        ) : (
          <Video
            className='work-media-element work-media-video work-media-preview-video'
            src={mediaUrl}
            controls={false}
            autoplay={false}
            loop={false}
            muted
            playsInline
            preload='auto'
            objectFit={objectFit}
            showCenterPlayBtn={false}
            showPlayBtn={false}
            showFullscreenBtn={false}
            enableProgressGesture={false}
          />
        )
      ) : (
        <Image className='work-media-element' src={imageUrl || fallbackUrl} mode={coverMode} />
      )}
      {isVideo && isInteractive && !isPlaying ? (
        <View className='video-play-overlay'>
          <View className='video-play-button'><AppIcon name='play' size={24} /></View>
        </View>
      ) : null}
      {isVideo && showBadge && !isInteractive ? (
        <View className='video-preview-badge'>
          <AppIcon name='play' size={11} />
          <Text>视频</Text>
        </View>
      ) : null}
    </View>
  )
}
