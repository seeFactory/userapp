import { Image, View } from '@tarojs/components'

const logo = '/static/logo.png'

export default function BrandLogo({ size = 42, className = '' }) {
  return (
    <View
      className={`brand-logo ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <Image className='brand-logo-image' src={logo} mode='aspectFit' />
    </View>
  )
}
