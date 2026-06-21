import { View } from '@tarojs/components'
import AppIcon from './AppIcon'
import { safeBack } from '../utils/navigation'

export default function PageBackButton({ fallbackUrl, className = '', label = '返回' }) {
  return (
    <View
      className={`page-back-button ${className}`.trim()}
      hoverClass='page-back-button-pressed'
      role='button'
      aria-label={label}
      onClick={() => safeBack({ fallbackUrl })}
    >
      <AppIcon name='back' size={20} />
    </View>
  )
}
