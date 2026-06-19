import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import CustomerModal from '../../components/CustomerModal'
import PaymentSheet from '../../components/PaymentSheet'
import { firstCryptoRoute } from '../../components/CryptoRoutePicker'
import {
  createCryptoOrder,
  createPlatformPaymentOrder,
  createRechargeOrder,
  createTelegramStarsOrder,
  fetchAgreement,
  fetchCreditBalance,
  fetchCryptoOrder,
  fetchPaymentOrder,
  fetchRechargeSettings,
  fetchTelegramStarsOrder,
  fetchWalletAccount,
  fetchWalletRechargeOptions,
  getClientRuntime,
  logoutRemote
} from '../../services/api'
import { getCurrentUser, isLoggedIn, requireLogin } from '../../utils/storage'

const PLATFORM_PAY_RUNTIMES = ['wechat-miniapp', 'alipay-miniapp', 'douyin-miniapp', 'qq-miniapp']

function money(value) {
  return Number(value || 0).toFixed(2)
}

function defaultRechargePolicy() {
  return {
    currency: 'CNY',
    pointRate: 7,
    minAmountCents: 100,
    maxAmountCents: 999900,
    allowCustomAmount: true
  }
}

export default function Mine() {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [balance, setBalance] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [rechargePolicy, setRechargePolicy] = useState(defaultRechargePolicy())
  const [rechargeAmount, setRechargeAmount] = useState('20')
  const [creatingRecharge, setCreatingRecharge] = useState(false)
  const [rechargePayment, setRechargePayment] = useState(null)
  const currentUser = getCurrentUser()

  const loadAccount = async () => {
    const [creditData, walletData, rechargeData] = await Promise.all([
      fetchCreditBalance().catch(() => null),
      fetchWalletAccount().catch(() => null),
      fetchRechargeSettings().catch(() => null)
    ])
    return { creditData, walletData, rechargeData }
  }

  useEffect(() => {
    if (!loggedIn) return undefined
    let mounted = true
    loadAccount().then(({ creditData, walletData, rechargeData }) => {
      if (!mounted) return
      setBalance(creditData?.balance ?? null)
      setWallet(walletData?.account || null)
      if (rechargeData) setRechargePolicy({ ...defaultRechargePolicy(), ...rechargeData })
    })
    return () => {
      mounted = false
    }
  }, [loggedIn])

  const signOut = async () => {
    await logoutRemote().catch(() => {})
    setLoggedIn(false)
    setBalance(null)
    setWallet(null)
    setRechargePayment(null)
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

  const goWallet = () => {
    if (loggedIn) {
      Taro.navigateTo({ url: '/pages/wallet/index' })
      return
    }
    requireLogin('/pages/wallet/index')
  }

  const updateRechargeCryptoRoute = (route) => {
    setRechargePayment((current) => current ? { ...current, cryptoRoute: route } : current)
  }

  const createRechargeCryptoOrder = async (route) => {
    if (!rechargePayment?.order?.id || rechargePayment.cryptoCreating) return
    setRechargePayment((current) => current ? { ...current, cryptoCreating: true } : current)
    Taro.showLoading({ title: '创建 Crypto 订单' })
    try {
      const cryptoOrder = await createCryptoOrder({
        paymentOrderId: rechargePayment.order.id,
        chainName: route.chain,
        token: route.token
      })
      setRechargePayment((current) => current ? {
        ...current,
        cryptoOrder,
        cryptoOrderRequired: false,
        cryptoCreating: false
      } : current)
      Taro.showToast({ title: '打币订单已创建', icon: 'success' })
    } catch (error) {
      setRechargePayment((current) => current ? { ...current, cryptoCreating: false } : current)
      Taro.showToast({ title: error.message || 'Crypto 订单创建失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const reloadBalance = async () => {
    const { creditData, walletData, rechargeData } = await loadAccount()
    setBalance(creditData?.balance ?? null)
    setWallet(walletData?.account || null)
    if (rechargeData) setRechargePolicy({ ...defaultRechargePolicy(), ...rechargeData })
  }

  const beginRecharge = async () => {
    if (!requireLogin('/pages/mine/index')) return
    if (rechargePolicy.allowCustomAmount === false) {
      Taro.showToast({ title: '点数充值暂未开放', icon: 'none' })
      return
    }
    const amount = Number(rechargeAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      Taro.showToast({ title: '请输入有效充值金额', icon: 'none' })
      return
    }
    const amountCents = Math.round(amount * 100)
    if (amountCents < rechargePolicy.minAmountCents || amountCents > rechargePolicy.maxAmountCents) {
      Taro.showToast({
        title: `金额需在 ¥${money(rechargePolicy.minAmountCents / 100)} 到 ¥${money(rechargePolicy.maxAmountCents / 100)}`,
        icon: 'none'
      })
      return
    }
    const clientRuntime = getClientRuntime()
    setCreatingRecharge(true)
    Taro.showLoading({ title: '创建支付' })
    try {
      const order = await createRechargeOrder({ amountCents, clientRuntime })
      const nextPayment = { order, runtime: clientRuntime, afterPaid: 'recharge' }
      if (clientRuntime === 'telegram-tma') {
        nextPayment.starsOrder = await createTelegramStarsOrder({ paymentOrderId: order.id })
      } else if (PLATFORM_PAY_RUNTIMES.includes(clientRuntime)) {
        nextPayment.platformPayment = await createPlatformPaymentOrder({ paymentOrderId: order.id })
      } else {
        const cryptoOptions = await fetchWalletRechargeOptions()
        nextPayment.cryptoOrderRequired = true
        nextPayment.cryptoOptions = cryptoOptions
        nextPayment.cryptoRoute = firstCryptoRoute(cryptoOptions.chains || [])
      }
      setRechargePayment(nextPayment)
      Taro.showToast({
        title: nextPayment.cryptoOrderRequired ? '请选择支付链并创建订单' : '请完成支付后刷新状态',
        icon: 'none'
      })
    } catch (error) {
      Taro.showToast({ title: error.message || '创建支付失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setCreatingRecharge(false)
    }
  }

  const refreshRechargePayment = async () => {
    if (!rechargePayment?.order?.id) return
    Taro.showLoading({ title: '刷新状态' })
    try {
      const nextPayment = { ...rechargePayment }
      if (rechargePayment.cryptoOrder?.id) {
        nextPayment.cryptoOrder = await fetchCryptoOrder(rechargePayment.cryptoOrder.id)
      }
      if (rechargePayment.starsOrder?.id) {
        nextPayment.starsOrder = await fetchTelegramStarsOrder(rechargePayment.starsOrder.id)
      }
      const order = await fetchPaymentOrder(rechargePayment.order.id)
      nextPayment.order = order
      setRechargePayment(nextPayment)
      if (order.status === 'paid') {
        await reloadBalance()
        setRechargePayment(null)
        Taro.showToast({ title: '点数已到账', icon: 'success' })
      } else {
        Taro.showToast({ title: '订单仍在处理中', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: error.message || '状态刷新失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const estimatedPoints = Math.max(0, Math.floor((Number(rechargeAmount || 0)) * rechargePolicy.pointRate))
  const minRecharge = money(rechargePolicy.minAmountCents / 100)
  const maxRecharge = money(rechargePolicy.maxAmountCents / 100)

  return (
    <Shell active='mine' title='我的'>
      <View className='panel'>
        <View className='panel-brand-row'>
          <BrandLogo size={54} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>账户中心</Text>
            <Text className='section-title'>{loggedIn ? (currentUser?.nickname || 'seeFactory 创作者') : '未登录'}</Text>
          </View>
        </View>
        <Text className='tool-desc'>
          {loggedIn
            ? `点数 ${balance === null ? '--' : balance} 点，钱包可用 ${money(wallet?.availableBalance)} ${wallet?.currency || 'USD'}。`
            : '登录后可查看作品、复制提示词并使用生成工具。'}
        </Text>
        <View className='hero-actions'>
          {loggedIn ? (
            <>
              <View className='primary-button' onClick={goWallet}>
                <AppIcon name='wallet' size={16} />
                <Text>钱包</Text>
              </View>
              <View className='ghost-button glass-button' onClick={beginRecharge}>
                <AppIcon name='coin' size={16} />
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

      {loggedIn && (
        <View className='form-panel credit-recharge-panel'>
          <View className='section-head compact-head'>
            <View>
              <Text className='section-kicker'>点数充值</Text>
              <Text className='section-title'>自填金额充值</Text>
            </View>
            <Text className={rechargePolicy.allowCustomAmount === false ? 'status failed' : 'status success'}>
              {rechargePolicy.allowCustomAmount === false ? '未开放' : `1 元 = ${rechargePolicy.pointRate} 点`}
            </Text>
          </View>

          <Text className='input-label'>充值金额</Text>
          <View className='text-input recharge-input'>
            <Text className='money-prefix'>¥</Text>
            <Input
              type='digit'
              value={rechargeAmount}
              placeholder={`最低 ${minRecharge}`}
              placeholderClass='muted'
              onInput={(event) => setRechargeAmount(event.detail.value)}
            />
          </View>
          <View className='recharge-meta'>
            <Text>预计到账 {estimatedPoints} 点</Text>
            <Text>范围 ¥{minRecharge} - ¥{maxRecharge}</Text>
          </View>
          <View className='primary-button full-width-button' onClick={creatingRecharge ? undefined : beginRecharge}>
            <AppIcon name='coin' size={16} />
            <Text>{creatingRecharge ? '创建中...' : '创建充值订单'}</Text>
          </View>
        </View>
      )}

      <View className='section-head'>
        <View>
          <Text className='section-kicker'>服务支持</Text>
          <Text className='section-title'>服务入口</Text>
        </View>
      </View>

      <View className='profile-grid'>
        <View className='profile-card' onClick={goWallet}>
          <View className='profile-icon'><AppIcon name='wallet' size={22} /></View>
          <Text className='profile-name'>钱包充值</Text>
          <Text className='tool-desc'>充值与提现</Text>
        </View>
        <View className='profile-card' onClick={beginRecharge}>
          <View className='profile-icon'><AppIcon name='coin' size={22} /></View>
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

      <CustomerModal open={customerOpen} onClose={() => setCustomerOpen(false)} />
      <PaymentSheet
        open={Boolean(rechargePayment)}
        title='点数充值'
        payment={rechargePayment}
        onClose={() => setRechargePayment(null)}
        onRefresh={refreshRechargePayment}
        onCryptoRouteChange={updateRechargeCryptoRoute}
        onCreateCryptoOrder={createRechargeCryptoOrder}
      />
    </Shell>
  )
}
