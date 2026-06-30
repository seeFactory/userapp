import { useEffect, useState } from 'react'
import { View, Image } from '@tarojs/components'
import AppIcon from './AppIcon'

export default function ModelLogo({ src = '', icon = 'sparkles', size = 34, className = '' }) {
  const [failed, setFailed] = useState(false)
  const safeSrc = String(src || '').trim()

  useEffect(() => {
    setFailed(false)
  }, [safeSrc])

  const hasImage = safeSrc && !failed
  return (
    <View
      className={`model-logo ${hasImage ? 'has-image' : 'fallback'} ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {hasImage ? (
        <Image
          className='model-logo-image'
          src={safeSrc}
          mode='aspectFit'
          onError={() => setFailed(true)}
        />
      ) : (
        <View className='model-logo-fallback'>
          <AppIcon name={icon} size={Math.max(15, Math.round(size * 0.52))} />
        </View>
      )}
    </View>
  )
}
