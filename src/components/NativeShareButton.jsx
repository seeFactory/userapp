import { View } from '@tarojs/components'

export default function NativeShareButton({ className = '', children, onClick }) {
  return (
    <View className={className} onClick={onClick}>
      {children}
    </View>
  )
}

