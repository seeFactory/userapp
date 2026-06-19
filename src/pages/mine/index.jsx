import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import CustomerModal from '../../components/CustomerModal'
import PaymentSheet from '../../components/PaymentSheet'
import {
  createCryptoOrder,
  createPlatformPaymentOrder,
  createRechargeOrder,
  createTelegramStarsOrder,
  fetchAgreement,
  fetchCreditBalance,
  fetchCryptoOrder,
  fetchPaymentOrder,
  fetchTelegramStarsOrder,
  getClientRuntime,
  logoutRemote
} from '../../services/api'
import { getCurrentUser, isLoggedIn, requireLogin } from '../../utils/storage'

const PLATFORM_PAY_RUNTIMES = ['wechat-miniapp', 'alipay-miniapp', 'douyin-miniapp', 'qq-miniapp']

export default function Mine() {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [balance, setBalance] = useState(null)
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('10')
  const [payment, setPayment] = useState(null)
  const [creatingPayment, setCreatingPayment] = useState(false)
  const currentUser = getCurrentUser()

  useEffect(() => {
    if (!loggedIn) return undefined
    let mounted = true
    fetchCreditBalance()
      .then((data) => {
        if (mounted) setBalance(data.balance)
      })
      .catch(() => {
        if (mounted) setBalance(null)
      })
    return () => {
      mounted = false
    }
  }, [loggedIn])

  const signOut = async () => {
    await logoutRemote().catch(() => {})
    setLoggedIn(false)
    setBalance(null)
    Taro.showToast({ title: '已退出登录', icon: 'success' })
  }

  const showAgreement = async (type) => {
    const titleMap = {
      user: '用户协议',
      privacy: '隐私政策'
    }
    Taro.showLoading({ title: '加载中' })
    try {
      const agreement = await fetchAgreement(type)
      Taro.hideLoading()
      Taro.showModal({
        title: agreement.title || titleMap[type],
        content: agreement.contentMarkdown || '协议正文待后台发布',
        showCancel: false,
        confirmText: '我知道了'
      })
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: error.message || '协议暂未发布', icon: 'none' })
    }
  }

  const refreshBalance = async () => {
    const data = await fetchCreditBalance()
    setBalance(data.balance)
    return data
  }

  const startRecharge = async () => {
    if (!requireLogin('/pages/mine/index')) return
    const amount = Number(rechargeAmount)
    if (!Number.isFinite(amount) || amount < 1) {
      Taro.showToast({ title: '充值金额最低 1 元', icon: 'none' })
      return
    }
    if (creatingPayment) return
    setCreatingPayment(true)
    Taro.showLoading({ title: '创建订单' })
    try {
      const clientRuntime = getClientRuntime()
      const order = await createRechargeOrder({
        amountCents: Math.round(amount * 100),
        clientRuntime
      })
      const nextPayment = { order, runtime: clientRuntime }
      if (clientRuntime === 'telegram-tma') {
        nextPayment.starsOrder = await createTelegramStarsOrder({ paymentOrderId: order.id })
      } else if (PLATFORM_PAY_RUNTIMES.includes(clientRuntime)) {
        nextPayment.platformPayment = await createPlatformPaymentOrder({ paymentOrderId: order.id })
      } else {
        nextPayment.cryptoOrder = await createCryptoOrder({
          paymentOrderId: order.id,
          chainName: 'TRON',
          token: 'USDT'
        })
      }
      setPayment(nextPayment)
      setRechargeOpen(false)
      Taro.showToast({ title: '支付订单已创建', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error.message || '创建订单失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setCreatingPayment(false)
    }
  }

  const refreshPayment = async () => {
    if (!payment?.order?.id) return
    Taro.showLoading({ title: '刷新状态' })
    try {
      const order = await fetchPaymentOrder(payment.order.id)
      const nextPayment = { ...payment, order }
      if (payment.cryptoOrder?.id) {
        nextPayment.cryptoOrder = await fetchCryptoOrder(payment.cryptoOrder.id)
      }
      if (payment.starsOrder?.id) {
        nextPayment.starsOrder = await fetchTelegramStarsOrder(payment.starsOrder.id)
      }
      setPayment(nextPayment)
      if (order.status === 'paid') {
        await refreshBalance()
        Taro.showToast({ title: '点数已到账', icon: 'success' })
        setPayment(null)
      } else {
        Taro.showToast({ title: '订单仍在处理中', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: error.message || '状态刷新失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  return (
    <Shell active='mine' title='我的'>
      <View className='panel'>
        <View className='panel-brand-row'>
          <BrandLogo size={54} />
          <View>
            <Text className='section-kicker'>Account</Text>
            <Text className='section-title'>{loggedIn ? (currentUser?.nickname || 'seeFactory 创作者') : '未登录'}</Text>
          </View>
        </View>
        <Text className='tool-desc'>{loggedIn ? (balance === null ? '点数同步中，作品与广场发布状态会自动同步。' : `剩余点数 ${balance} 点，作品与广场发布状态会自动同步。`) : '登录后可查看作品、复制提示词并使用生成工具。'}</Text>
        <View className='hero-actions'>
          {loggedIn ? (
            <>
              <View className='primary-button' onClick={() => setRechargeOpen(true)}>
                <AppIcon name='agent' size={16} />
                <Text>点数充值</Text>
              </View>
              <View className='ghost-button glass-button' onClick={signOut}>
                <AppIcon name='logout' size={16} />
                <Text>退出登录</Text>
              </View>
            </>
          ) : (
            <View className='primary-button' onClick={() => Taro.navigateTo({ url: '/pages/login/index?redirect=/pages/mine/index' })}>
              <AppIcon name='login' size={16} />
              <Text>立即登录</Text>
            </View>
          )}
        </View>
      </View>

      <View className='section-head'>
        <View>
          <Text className='section-kicker'>Service</Text>
          <Text className='section-title'>服务入口</Text>
        </View>
      </View>

      <View className='profile-grid'>
        <View className='profile-card' onClick={() => loggedIn ? setRechargeOpen(true) : requireLogin('/pages/mine/index')}>
          <View className='profile-icon'><AppIcon name='agent' size={22} /></View>
          <Text className='profile-name'>点数充值</Text>
          <Text className='tool-desc'>自填金额</Text>
        </View>
        <View className='profile-card' onClick={() => loggedIn ? Taro.navigateTo({ url: '/pages/agent/index' }) : requireLogin('/pages/agent/index')}>
          <View className='profile-icon'><AppIcon name='agent' size={22} /></View>
          <Text className='profile-name'>代理中心</Text>
          <Text className='tool-desc'>用户和激活</Text>
        </View>
        <View className='profile-card' onClick={() => setCustomerOpen(true)}>
          <View className='profile-icon'><AppIcon name='headphones' size={22} /></View>
          <Text className='profile-name'>联系客服</Text>
          <Text className='tool-desc'>反馈建议</Text>
        </View>
        <View className='profile-card' onClick={() => showAgreement('user')}>
          <View className='profile-icon'><AppIcon name='book' size={22} /></View>
          <Text className='profile-name'>用户协议</Text>
          <Text className='tool-desc'>查看服务条款</Text>
        </View>
        <View className='profile-card' onClick={() => showAgreement('privacy')}>
          <View className='profile-icon'><AppIcon name='lock' size={22} /></View>
          <Text className='profile-name'>隐私政策</Text>
          <Text className='tool-desc'>查看数据说明</Text>
        </View>
      </View>

      {rechargeOpen && (
        <View className='modal-mask'>
          <View className='modal-panel payment-sheet'>
            <View className='modal-head'>
              <Text className='modal-title'>点数充值</Text>
              <View className='icon-button' onClick={() => setRechargeOpen(false)}>
                <AppIcon name='close' size={16} />
              </View>
            </View>
            <Text className='modal-note'>请输入充值金额，系统按 1 元 = 7 点自动到账。</Text>
            <Input
              className='text-input amount-input'
              type='digit'
              value={rechargeAmount}
              placeholder='输入金额，最低 1 元'
              onInput={(event) => setRechargeAmount(event.detail.value)}
            />
            <View className='payment-row strong'>
              <Text>预计到账</Text>
              <Text>{Math.floor(Number(rechargeAmount || 0) * 7)} 点</Text>
            </View>
            <View className='hero-actions'>
              <View className='primary-button' onClick={startRecharge}>
                <AppIcon name='agent' size={16} />
                <Text>{creatingPayment ? '创建中...' : '创建支付'}</Text>
              </View>
              <View className='ghost-button glass-button' onClick={() => setRechargeOpen(false)}>
                <AppIcon name='close' size={16} />
                <Text>取消</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <PaymentSheet
        open={Boolean(payment)}
        title='充值支付'
        payment={payment}
        onClose={() => setPayment(null)}
        onRefresh={refreshPayment}
      />

      <CustomerModal open={customerOpen} onClose={() => setCustomerOpen(false)} />
    </Shell>
  )
}
