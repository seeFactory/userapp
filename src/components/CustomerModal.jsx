import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { customer } from '../data/mock'
import AppIcon from './AppIcon'

export default function CustomerModal({ open, onClose }) {
  if (!open) return null

  const copyWechat = () => {
    Taro.setClipboardData({
      data: customer.wechat,
      success: () => Taro.showToast({ title: '微信号已复制', icon: 'success' })
    })
  }

  return (
    <View className='modal-mask'>
      <View className='modal-panel'>
        <View className='modal-head'>
          <Text className='modal-title'>联系客服</Text>
          <View className='close-btn' onClick={onClose}>
            <AppIcon name='close' size={20} />
          </View>
        </View>
        <View className='modal-note'>{customer.note}</View>
        <View className='qr-card' onClick={() => Taro.showToast({ title: 'H5 预览中使用模拟二维码', icon: 'none' })}>
          <View className='qr-grid'>
            {Array.from({ length: 49 }).map((_, index) => (
              <View key={index} className={(index * 7 + index) % 5 === 0 || index % 8 === 0 ? 'qr-cell on' : 'qr-cell'} />
            ))}
          </View>
          <Text>模拟客服二维码</Text>
        </View>
        <View className='copy-row'>
          <View>
            <Text className='muted small'>微信号</Text>
            <Text className='copy-value'>{customer.wechat}</Text>
          </View>
          <View className='primary-button compact' onClick={copyWechat}>
            <AppIcon name='copy' size={14} />
            <Text>复制</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
