import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import AppIcon from './AppIcon'
import CryptoRoutePicker from './CryptoRoutePicker'

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

function displayPaymentAmount(order, crypto, stars) {
  if (crypto) return `${crypto.payAmount || crypto.sourceAmount || crypto.amount || '--'} ${crypto.payCurrency || crypto.sourceCurrency || crypto.currency || 'USDT'}`
  if (stars) return `${stars.starsAmount || stars.sourceAmount || '--'} Stars`
  return formatMoney(order.amount || 0)
}

function displayPoints(order, crypto, stars) {
  return order.creditedPoints ?? order.points ?? crypto?.creditedPoints ?? crypto?.points ?? stars?.creditedPoints ?? stars?.points ?? 0
}

function displayRate(order, crypto, stars) {
  const sourceCurrency = stars ? 'Stars' : crypto?.sourceCurrency || order.sourceCurrency || order.currency || 'CNY'
  const rate = stars ? '2 Stars = 1 点' : `${sourceCurrency} 汇率 ${crypto?.pointRate ?? order.pointRate ?? 1} 点`
  const rounding = crypto?.roundingMode || order.roundingMode || stars?.roundingMode
  return rounding === 'floor' ? `${rate}，向下取整` : rate
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

function invokePlatformPayment(platformPayment, onRefresh) {
  if (!platformPayment?.payParams) {
    Taro.showToast({ title: '支付参数暂未生成', icon: 'none' })
    return Promise.resolve(false)
  }
  const params = platformPayment.payParams || {}
  if (platformPayment.invokeType === 'dev-preview') {
    copy(JSON.stringify(params), '支付参数')
    Taro.showToast({ title: '支付参数预览，请刷新状态', icon: 'none' })
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    const finish = (paid) => {
      if (!paid) {
        Taro.showToast({ title: '支付未完成', icon: 'none' })
        resolve(false)
        return
      }
      Taro.showToast({ title: '支付完成，正在刷新', icon: 'success' })
      Promise.resolve(onRefresh?.()).finally(() => resolve(true))
    }
    const success = () => finish(true)
    const fail = () => finish(false)
    const invokeTaroPayment = () => {
      Taro.requestPayment({
        ...params,
        success,
        fail
      })
    }

    try {
      if (platformPayment.invokeType === 'alipay-trade-pay') {
        const alipay = typeof my !== 'undefined' ? my : null
        if (!alipay?.tradePay) {
          Taro.showToast({ title: '请在支付宝小程序内完成支付', icon: 'none' })
          resolve(false)
          return
        }
        alipay.tradePay({
          tradeNO: params.tradeNO || params.tradeNo,
          orderStr: params.orderStr,
          success,
          fail
        })
        return
      }

      if (platformPayment.invokeType === 'douyin-pay') {
        const ttPay = typeof tt !== 'undefined' ? tt.pay : null
        if (ttPay) {
          ttPay({
            ...params,
            success,
            fail
          })
          return
        }
      }

      invokeTaroPayment()
    } catch (error) {
      Taro.showToast({ title: error.message || '支付拉起失败', icon: 'none' })
      resolve(false)
    }
  })
}

function invokeTelegramStarsPayment(stars, onRefresh) {
  if (!stars?.invoiceLink) {
    Taro.showToast({ title: 'Stars 支付链接暂未生成', icon: 'none' })
    return Promise.resolve(false)
  }
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
  if (!webApp?.openInvoice) {
    copy(stars.invoiceLink, 'Stars 支付链接')
    Taro.showToast({ title: '请在 Telegram 内打开并完成支付', icon: 'none' })
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    try {
      webApp.openInvoice(stars.invoiceLink, (status) => {
        if (status === 'paid') {
          Taro.showToast({ title: '支付完成，正在刷新', icon: 'success' })
          Promise.resolve(onRefresh?.()).finally(() => resolve(true))
          return
        }
        if (status === 'pending') {
          Taro.showToast({ title: '支付处理中，正在刷新', icon: 'none' })
          Promise.resolve(onRefresh?.()).finally(() => resolve(true))
          return
        }
        if (status === 'failed') {
          Taro.showToast({ title: '支付失败，请重试', icon: 'none' })
          resolve(false)
          return
        }
        Taro.showToast({ title: '支付未完成', icon: 'none' })
        resolve(false)
      })
    } catch (error) {
      Taro.showToast({ title: error.message || 'Stars 支付拉起失败', icon: 'none' })
      resolve(false)
    }
  })
}

export default function PaymentSheet({
  open,
  title = '支付订单',
  payment,
  onClose,
  onRefresh,
  onCryptoRouteChange,
  onCreateCryptoOrder
}) {
  const [invoking, setInvoking] = useState(false)
  if (!open || !payment) return null
  const order = payment.order || {}
  const crypto = payment.cryptoOrder
  const stars = payment.starsOrder
  const platformPayment = payment.platformPayment
  const needsCryptoOrder = payment.cryptoOrderRequired && !crypto
  const status = order.status || crypto?.status || stars?.status
  const cryptoAddress = crypto?.depositAddress || crypto?.bridgeDepositAddress || crypto?.bridgeReceiveAddress
  const cryptoOptions = payment.cryptoOptions || {}
  const cryptoSelectable = (cryptoOptions.chains || []).length > 0
  const primaryBusy = invoking || Boolean(payment.cryptoCreating)
  const primaryAction = async () => {
    if (primaryBusy) return
    if (needsCryptoOrder) {
      if (!cryptoSelectable) {
        Taro.showToast({ title: cryptoOptions.unavailableReason || 'Crypto 支付暂不可用', icon: 'none' })
        return
      }
      if (!payment.cryptoRoute?.chain || !payment.cryptoRoute?.token) {
        Taro.showToast({ title: '请选择支付链和支付代币', icon: 'none' })
        return
      }
      onCreateCryptoOrder?.(payment.cryptoRoute)
      return
    }
    setInvoking(true)
    try {
      if (platformPayment) {
        await invokePlatformPayment(platformPayment, onRefresh)
        return
      }
      if (stars) {
        await invokeTelegramStarsPayment(stars, onRefresh)
        return
      }
      await Promise.resolve(onRefresh?.())
    } finally {
      setInvoking(false)
    }
  }
  const primaryIcon = needsCryptoOrder ? 'wallet' : platformPayment || stars ? 'agent' : 'refresh'
  let primaryText = '刷新状态'
  if (needsCryptoOrder) {
    primaryText = payment.cryptoCreating ? '创建中...' : '创建 Crypto 支付'
  } else if (invoking) {
    primaryText = platformPayment || stars ? '拉起中...' : '刷新中...'
  } else if (platformPayment) {
    primaryText = platformPayment.invokeType === 'dev-preview' ? '查看支付参数' : '立即支付'
  } else if (stars) {
    primaryText = '打开 Stars 支付'
  }

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
          <Text className='payment-amount'>{displayPaymentAmount(order, crypto, stars)}</Text>
          <Text className='modal-note'>到账点数：{displayPoints(order, crypto, stars)} 点</Text>
          <Text className='tool-desc'>{displayRate(order, crypto, stars)}</Text>
        </View>

        {crypto && (
          <View className='payment-info'>
            <View className='payment-row'>
              <Text>网络</Text>
              <Text>{crypto.chainName || crypto.payChain || '待返回'} / {crypto.token || crypto.payToken || crypto.payCurrency || '--'}</Text>
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

        {needsCryptoOrder && (
          <View className='payment-info'>
            <CryptoRoutePicker
              title='选择支付链与代币'
              chains={cryptoOptions.chains || []}
              value={payment.cryptoRoute || {}}
              onChange={onCryptoRouteChange}
              disabled={payment.cryptoCreating}
            />
            <Text className={cryptoOptions.acquiringConfigured ? 'modal-note' : 'modal-note danger-note'}>
              {cryptoSelectable
                ? '创建订单后会展示打币地址、应付数量和过期时间。'
                : cryptoOptions.unavailableReason || '当前暂无可用的 Crypto 支付地址。'}
            </Text>
          </View>
        )}

        {stars && (
          <View className='payment-info'>
            <View className='payment-row'>
              <Text>支付单位</Text>
              <Text>{stars.starsAmount} Stars</Text>
            </View>
            <View className='payment-row'>
              <Text>固定换算</Text>
              <Text>2 Stars = 1 点</Text>
            </View>
            <View className='copy-box' onClick={() => copy(stars.invoiceLink, 'Stars 支付链接')}>
              <Text>{stars.invoiceLink || 'Stars 支付链接生成中'}</Text>
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
              <Text>{platformPayment.configured ? '平台支付参数已生成' : '支付参数预览'}</Text>
              <AppIcon name='copy' size={14} />
            </View>
          </View>
        )}

        <View className='hero-actions'>
          <View className={primaryBusy ? 'primary-button disabled' : 'primary-button'} onClick={primaryAction}>
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
