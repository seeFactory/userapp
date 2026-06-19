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

function invokePlatformPayment(platformPayment) {
  if (!platformPayment?.payParams) {
    Taro.showToast({ title: '支付参数暂未生成', icon: 'none' })
    return
  }
  const params = platformPayment.payParams || {}
  if (platformPayment.invokeType === 'alipay-trade-pay') {
    const alipay = typeof my !== 'undefined' ? my : null
    if (!alipay?.tradePay) {
      Taro.showToast({ title: '请在支付宝小程序内完成支付', icon: 'none' })
      return
    }
    alipay.tradePay({
      tradeNO: params.tradeNO || params.tradeNo,
      orderStr: params.orderStr,
      success: () => Taro.showToast({ title: '支付完成后请刷新状态', icon: 'none' }),
      fail: () => Taro.showToast({ title: '支付未完成', icon: 'none' })
    })
    return
  }
  if (platformPayment.invokeType === 'douyin-pay') {
    const ttPay = typeof tt !== 'undefined' ? tt.pay : null
    if (ttPay) {
      ttPay({
        ...params,
        success: () => Taro.showToast({ title: '支付完成后请刷新状态', icon: 'none' }),
        fail: () => Taro.showToast({ title: '支付未完成', icon: 'none' })
      })
      return
    }
  }
  Taro.requestPayment({
    ...params,
    success: () => Taro.showToast({ title: '支付完成后请刷新状态', icon: 'none' }),
    fail: () => Taro.showToast({ title: '支付未完成', icon: 'none' })
  })
}

function invokeTelegramStarsPayment(stars, onRefresh) {
  if (!stars?.invoiceLink) {
    Taro.showToast({ title: 'Stars Invoice 暂未生成', icon: 'none' })
    return
  }
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
  if (!webApp?.openInvoice) {
    copy(stars.invoiceLink, 'Invoice 链接')
    Taro.showToast({ title: '请在 Telegram 内打开并完成支付', icon: 'none' })
    return
  }
  try {
    webApp.openInvoice(stars.invoiceLink, (status) => {
      if (status === 'paid') {
        Taro.showToast({ title: '支付完成，正在刷新', icon: 'success' })
        onRefresh?.()
        return
      }
      if (status === 'pending') {
        Taro.showToast({ title: '支付处理中，请稍后刷新', icon: 'none' })
        onRefresh?.()
        return
      }
      if (status === 'failed') {
        Taro.showToast({ title: '支付失败，请重试', icon: 'none' })
        return
      }
      Taro.showToast({ title: '支付未完成', icon: 'none' })
    })
  } catch (error) {
    Taro.showToast({ title: error.message || 'Stars 支付拉起失败', icon: 'none' })
  }
}

export default function PaymentSheet({ open, title = '支付订单', payment, onClose, onRefresh }) {
  if (!open || !payment) return null
  const order = payment.order || {}
  const crypto = payment.cryptoOrder
  const stars = payment.starsOrder
  const platformPayment = payment.platformPayment
  const status = order.status || crypto?.status || stars?.status
  const cryptoAddress = crypto?.depositAddress || crypto?.bridgeDepositAddress || crypto?.bridgeReceiveAddress
  const primaryAction = platformPayment
    ? () => invokePlatformPayment(platformPayment)
    : stars
      ? () => invokeTelegramStarsPayment(stars, onRefresh)
      : onRefresh
  const primaryIcon = platformPayment || stars ? 'agent' : 'refresh'
  const primaryText = platformPayment ? '立即支付' : stars ? '打开 Stars 支付' : '刷新状态'

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

        {platformPayment && (
          <View className='payment-info'>
            <View className='payment-row'>
              <Text>支付渠道</Text>
              <Text>{platformPayment.provider}</Text>
            </View>
            <View className='payment-row'>
              <Text>订单号</Text>
              <Text>{platformPayment.orderNo || order.orderNo}</Text>
            </View>
            <View className='copy-box' onClick={() => copy(JSON.stringify(platformPayment.payParams || {}), '支付参数')}>
              <Text>{platformPayment.configured ? '平台支付参数已生成' : '开发环境支付预览'}</Text>
              <AppIcon name='copy' size={14} />
            </View>
          </View>
        )}

        <View className='hero-actions'>
          <View className='primary-button' onClick={primaryAction}>
            <AppIcon name={primaryIcon} size={16} />
            <Text>{primaryText}</Text>
          </View>
          {(platformPayment || stars) && (
            <View className='ghost-button glass-button' onClick={onRefresh}>
              <AppIcon name='refresh' size={16} />
              <Text>刷新状态</Text>
            </View>
          )}
          <View className='ghost-button glass-button' onClick={onClose}>
            <AppIcon name='close' size={16} />
            <Text>稍后处理</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
