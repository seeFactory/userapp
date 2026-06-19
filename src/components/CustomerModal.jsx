import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, View, Text } from '@tarojs/components'
import AppIcon from './AppIcon'
import { fetchCustomerService } from '../services/api'

const defaultCustomer = {
  wechat: 'seeFactory-service',
  telegram: '@seeFactorySupport',
  email: 'support@seefactory.ai',
  qrCodeUrl: '',
  note: '添加客服获取创作建议和充值说明'
}

export default function CustomerModal({ open, onClose }) {
  const [service, setService] = useState(defaultCustomer)
  const [loading, setLoading] = useState(false)
  const [qrError, setQrError] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let mounted = true
    setLoading(true)
    setQrError(false)
    fetchCustomerService()
      .then((data) => {
        if (mounted) setService({ ...defaultCustomer, ...data })
      })
      .catch(() => {
        Taro.showToast({ title: '客服信息加载失败，已使用默认联系方式', icon: 'none' })
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
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

  const openQrCode = () => {
    if (!service.qrCodeUrl || qrError) {
      Taro.showToast({ title: service.qrCodeUrl ? '二维码加载失败，请复制客服微信号' : '请在后台配置客服二维码', icon: 'none' })
      return
    }
    Taro.previewImage({
      current: service.qrCodeUrl,
      urls: [service.qrCodeUrl],
      fail: () => {
        if (typeof window !== 'undefined') {
          window.open(service.qrCodeUrl, '_blank', 'noopener,noreferrer')
          return
        }
        Taro.showToast({ title: '请长按或截图保存二维码', icon: 'none' })
      }
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
        <View className='modal-note'>{loading ? '正在加载客服信息...' : service.note}</View>
        <View className={loading ? 'qr-card loading' : 'qr-card'} onClick={openQrCode}>
          {service.qrCodeUrl && !qrError ? (
            <Image
              className='qr-image'
              src={service.qrCodeUrl}
              mode='aspectFit'
              onError={() => setQrError(true)}
            />
          ) : (
            <View className='qr-grid'>
              {Array.from({ length: 49 }).map((_, index) => (
                <View key={index} className={(index * 7 + index) % 5 === 0 || index % 8 === 0 ? 'qr-cell on' : 'qr-cell'} />
              ))}
            </View>
          )}
          <Text>{loading ? '加载客服二维码' : service.qrCodeUrl && !qrError ? '点击放大客服二维码' : '二维码待后台配置'}</Text>
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
