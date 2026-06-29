import { View, Text, Image, Video } from '@tarojs/components'
import AppIcon from './AppIcon'
import { inferWorkMediaKind } from '../services/api'

const fallbackCover = 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=900&q=80'

function resolveMedia(item = {}, fallbackUrl = fallbackCover) {
  const resultUrl = item.resultUrls?.[0] || ''
  const mediaUrl = item.mediaUrl || resultUrl || item.image || item.coverUrl || ''
  const mediaKind = item.mediaKind || inferWorkMediaKind(item, mediaUrl)
  const previewUrl = item.previewUrl || item.coverUrl || (mediaKind === 'image' ? mediaUrl : '') || fallbackUrl
  return { mediaUrl, mediaKind, previewUrl }
}

export default function WorkMedia({
  item,
  className = 'work-image',
  fallbackUrl = fallbackCover,
  controls = false,
  autoplay = true,
  loop = true,
  muted = true,
  showBadge = true
}) {
  const { mediaUrl, mediaKind, previewUrl } = resolveMedia(item, fallbackUrl)
  const isVideo = mediaKind === 'video' && mediaUrl
  const imageUrl = isVideo ? previewUrl : (previewUrl || mediaUrl || fallbackUrl)

  return (
    <View className={`${className} work-media-frame ${controls ? 'interactive-media-frame' : ''} ${isVideo ? 'video-media-frame' : 'image-media-frame'}`}>
      {isVideo ? (
        <Video
          className='work-media-element work-media-video'
          src={mediaUrl}
          poster={previewUrl}
          controls={controls}
          autoplay={autoplay}
          loop={loop}
          muted={muted}
          objectFit='cover'
          showCenterPlayBtn={controls}
          showPlayBtn={controls}
          showFullscreenBtn={controls}
          enableProgressGesture={controls}
        />
      ) : (
        <Image className='work-media-element' src={imageUrl} mode='aspectFill' />
      )}
      {isVideo && showBadge ? (
        <View className='video-preview-badge'>
          <AppIcon name='play' size={11} />
          <Text>视频</Text>
        </View>
      ) : null}
    </View>
  )
}
