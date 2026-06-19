import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, View, Text } from '@tarojs/components'
import { customer } from '../data/mock'
import AppIcon from './AppIcon'
import { fetchCustomerService } from '../services/api'

export default function CustomerModal({ open, onClose }) {
  const [service, setService] = useState(customer)

  useEffect(() => {
    if (!open) return undefined
    let mounted = true
    fetchCustomerService()
      .then((data) => {
        if (mounted) setService({ ...customer, ...data })
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [open])

  if (!open) return null

  const copyValue = (label, value) => {
    if (!value) {
      Taro.showToast({ title: `${label}暂未配置`, icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: value,
      success: () => Taro.showToast({ title: `${label}已复制`, icon: 'success' })
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
        <View className='modal-note'>{service.note}</View>
        <View className='qr-card' onClick={() => Taro.showToast({ title: service.qrCodeUrl ? '请扫码添加客服' : '请在后台配置客服二维码', icon: 'none' })}>
          {service.qrCodeUrl ? (
            <Image className='qr-image' src={service.qrCodeUrl} mode='aspectFill' />
          ) : (
            <View className='qr-grid'>
              {Array.from({ length: 49 }).map((_, index) => (
                <View key={index} className={(index * 7 + index) % 5 === 0 || index % 8 === 0 ? 'qr-cell on' : 'qr-cell'} />
              ))}
            </View>
          )}
          <Text>{service.qrCodeUrl ? '微信客服二维码' : '二维码待后台配置'}</Text>
        </View>
        <View className='copy-row'>
          <View>
            <Text className='muted small'>微信号</Text>
            <Text className='copy-value'>{service.wechat}</Text>
          </View>
          <View className='primary-button compact' onClick={() => copyValue('微信号', service.wechat)}>
            <AppIcon name='copy' size={14} />
            <Text>复制</Text>
          </View>
        </View>
        <View className='copy-row block-gap'>
          <View>
            <Text className='muted small'>Telegram</Text>
            <Text className='copy-value'>{service.telegram || '暂未配置'}</Text>
          </View>
          <View className='ghost-button glass-button compact' onClick={() => copyValue('Telegram', service.telegram)}>
            <AppIcon name='copy' size={14} />
            <Text>复制</Text>
          </View>
        </View>
        <View className='copy-row block-gap'>
          <View>
            <Text className='muted small'>邮箱</Text>
            <Text className='copy-value'>{service.email || '暂未配置'}</Text>
          </View>
          <View className='ghost-button glass-button compact' onClick={() => copyValue('邮箱', service.email)}>
            <AppIcon name='copy' size={14} />
            <Text>复制</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
