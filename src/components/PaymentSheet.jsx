import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import AppIcon from './AppIcon'

function formatMoney(cents = 0) {
  return `¥${(Number(cents || 0) / 100).toFixed(2)}`
}

function statusText(status) {
  const map = {
    pending: '待支付',
    paid: '已支付',
    closed: '已关闭',
    failed: '失败',
    PENDING: '待支付',
    PAID: '已支付',
    EXPIRED: '已过期',
    FAILED: '失败'
  }
  return map[status] || status || '待支付'
}

function copy(value, label) {
  if (!value) {
    Taro.showToast({ title: `${label}暂未生成`, icon: 'none' })
    return
  }
  Taro.setClipboardData({
    data: String(value),
    success: () => Taro.showToast({ title: `${label}已复制`, icon: 'success' })
  })
}

export default function PaymentSheet({ open, title = '支付订单', payment, onClose, onRefresh }) {
  if (!open || !payment) return null
  const order = payment.order || {}
  const crypto = payment.cryptoOrder
  const stars = payment.starsOrder
  const status = order.status || crypto?.status || stars?.status
  const cryptoAddress = crypto?.depositAddress || crypto?.bridgeDepositAddress || crypto?.bridgeReceiveAddress

  return (
    <View className='modal-mask'>
      <View className='modal-panel payment-sheet'>
        <View className='modal-head'>
          <Text className='modal-title'>{title}</Text>
          <View className='icon-button' onClick={onClose}>
            <AppIcon name='close' size={16} />
          </View>
        </View>

        <View className='payment-summary'>
          <Text className='section-kicker'>{statusText(status)}</Text>
          <Text className='payment-amount'>{formatMoney(order.amount || crypto?.amountCents || stars?.amountCents)}</Text>
          <Text className='modal-note'>到账点数：{order.points || crypto?.points || 0} 点</Text>
        </View>

        {crypto && (
          <View className='payment-info'>
            <View className='payment-row'>
              <Text>网络</Text>
              <Text>{crypto.chainName || 'TRON'} / {crypto.token || crypto.payCurrency || 'USDT'}</Text>
            </View>
            <View className='payment-row'>
              <Text>应付数量</Text>
              <Text>{crypto.payAmount} {crypto.payCurrency}</Text>
            </View>
            <View className='copy-box' onClick={() => copy(cryptoAddress, '收款地址')}>
              <Text>{cryptoAddress || '收款地址生成中'}</Text>
              <AppIcon name='copy' size={14} />
            </View>
          </View>
        )}

        {stars && (
          <View className='payment-info'>
            <View className='payment-row'>
              <Text>支付单位</Text>
              <Text>{stars.starsAmount} Stars</Text>
            </View>
            <View className='copy-box' onClick={() => copy(stars.invoiceLink, 'Invoice 链接')}>
              <Text>{stars.invoiceLink || 'Invoice 链接生成中'}</Text>
              <AppIcon name='copy' size={14} />
            </View>
          </View>
        )}

        <View className='hero-actions'>
          <View className='primary-button' onClick={onRefresh}>
            <AppIcon name='refresh' size={16} />
            <Text>刷新状态</Text>
          </View>
          <View className='ghost-button glass-button' onClick={onClose}>
            <AppIcon name='close' size={16} />
            <Text>稍后处理</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
