import { View } from '@tarojs/components'

const iconParts = {
  agent: ['coin', 'coin-mark', 'spark'],
  alert: ['alert-body', 'alert-line', 'alert-dot'],
  back: ['chevron-left', 'chevron-tail'],
  badge: ['badge-ring', 'badge-check'],
  book: ['book-left', 'book-right', 'spark'],
  bot: ['bot-head', 'bot-eye-left', 'bot-eye-right'],
  camera: ['camera-body', 'camera-top', 'camera-lens'],
  center: ['doc-back', 'doc-front', 'doc-mark'],
  close: ['close-a', 'close-b'],
  comic: ['panel-a', 'panel-b', 'panel-c'],
  copy: ['copy-back', 'copy-front'],
  delete: ['trash-lid', 'trash-body', 'trash-line'],
  download: ['download-stem', 'download-head', 'download-tray'],
  film: ['film-body', 'film-frame', 'film-dot'],
  fusion: ['fusion-a', 'fusion-b', 'fusion-core'],
  gallery: ['panel-a', 'panel-b', 'panel-c', 'spark'],
  headphones: ['phone-arch', 'phone-left', 'phone-right'],
  home: ['home-roof', 'home-body', 'home-door'],
  image: ['image-frame', 'image-sun', 'image-mount'],
  lock: ['lock-arch', 'lock-body', 'lock-dot'],
  login: ['door-line', 'arrow-stem', 'arrow-head'],
  logout: ['door-line', 'arrow-stem', 'arrow-head'],
  music: ['music-stem', 'music-head', 'music-flag'],
  play: ['play-triangle'],
  portrait: ['portrait-head', 'portrait-body'],
  refresh: ['refresh-ring', 'refresh-head'],
  scan: ['scan-a', 'scan-b', 'scan-c', 'scan-d', 'scan-dot'],
  search: ['search-ring', 'search-handle'],
  share: ['share-node-a', 'share-node-b', 'share-node-c', 'share-line-a', 'share-line-b'],
  sparkles: ['wand-spark', 'spark', 'wand-dot'],
  user: ['user-head', 'user-body', 'spark'],
  video: ['video-body', 'video-lens'],
  wallet: ['coin', 'coin-mark', 'spark'],
  wand: ['wand-stick', 'wand-spark', 'wand-dot']
}

export default function AppIcon({ name, size = 18, className = '' }) {
  const iconName = iconParts[name] ? name : 'center'
  const parts = iconParts[iconName]

  return (
    <View
      className={`app-icon app-icon-${iconName} ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {parts.map((part) => (
        <View key={part} className={`icon-shape icon-shape-${part}`} />
      ))}
    </View>
  )
}
