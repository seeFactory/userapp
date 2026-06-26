import { lazy, Suspense, useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { firstCryptoRoute } from '../../utils/cryptoRoute'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { isPlatformPaymentRuntime, isTelegramStarsRuntime } from '../../platform/payment'
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
import { formatAgreementContent } from '../../utils/agreement'
import { goPage } from '../../utils/navigation'
import { getCurrentUser, isLoggedIn, requireLogin } from '../../utils/storage'

const CustomerModal = lazy(() => import('../../components/CustomerModal'))
const AgreementModal = lazy(() => import('../../components/AgreementModal'))
const PaymentSheet = lazy(() => import('../../components/PaymentSheet'))

function money(value) {
  return Number(value || 0).toFixed(2)
}

function defaultRechargePolicy() {
  return {
    currency: 'CNY',
    pointRate: 1,
    minAmountCents: 100,
    maxAmountCents: 999900,
    allowCustomAmount: true
  }
}

export default function Mine() {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [balance, setBalance] = useState(null)
  const [frozenBalance, setFrozenBalance] = useState(0)
  const [wallet, setWallet] = useState(null)
  const [rechargePolicy, setRechargePolicy] = useState(defaultRechargePolicy())
  const [rechargeAmount, setRechargeAmount] = useState('20')
  const [creatingRecharge, setCreatingRecharge] = useState(false)
  const [rechargePayment, setRechargePayment] = useState(null)
  const [agreementModal, setAgreementModal] = useState(null)
  const currentUser = getCurrentUser()
  const { config, loading: configLoading } = useAppConfig()
  const rechargeFeatureEnabled = isFeatureEnabled(config, 'recharge')

  const loadAccount = async (options = {}) => {
    const [creditData, walletData, rechargeData] = await Promise.all([
      fetchCreditBalance(options).catch(() => null),
      fetchWalletAccount(options).catch(() => null),
      fetchRechargeSettings(options).catch(() => null)
    ])
    return { creditData, walletData, rechargeData }
  }

  const clearAccountState = () => {
    setBalance(null)
    setFrozenBalance(0)
    setWallet(null)
    setRechargePayment(null)
  }

  const applyAccountData = ({ creditData, walletData, rechargeData }) => {
    setBalance(creditData?.balance ?? null)
    setFrozenBalance(creditData?.frozenBalance || 0)
    setWallet(walletData?.account || null)
    if (rechargeData) setRechargePolicy({ ...defaultRechargePolicy(), ...rechargeData })
  }

  useDidShow(() => {
    const nextLoggedIn = isLoggedIn()
    setLoggedIn(nextLoggedIn)
    if (!nextLoggedIn) clearAccountState()
  })

  useEffect(() => {
    if (!loggedIn) return undefined
    let mounted = true
    loadAccount().then(({ creditData, walletData, rechargeData }) => {
      if (!mounted) return
      applyAccountData({ creditData, walletData, rechargeData })
    })
    return () => {
      mounted = false
    }
  }, [loggedIn])

  const signOut = async () => {
    await logoutRemote().catch(() => {})
    setLoggedIn(false)
    clearAccountState()
    Taro.showToast({ title: '已退出登录', icon: 'success' })
  }

  const showAgreement = async (type) => {
    const titleMap = {
      user: '用户协议',
      privacy: '隐私政策',
      creator: '创作与生成服务条款'
    }
    Taro.showLoading({ title: '加载中' })
    try {
      const agreement = await fetchAgreement(type)
      Taro.hideLoading()
      setAgreementModal({
        title: agreement.title || titleMap[type],
        content: formatAgreementContent(agreement, config?.legal)
      })
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: error.message || '协议暂未发布', icon: 'none' })
    }
  }

  const goWorkflowPurchases = () => {
    if (loggedIn) {
      goPage('/pages/workflow-purchases/index')
      return
    }
    requireLogin('/pages/workflow-purchases/index')
  }

  const goWorkflowCases = () => {
    if (loggedIn) {
      goPage('/pages/workflow-cases/index')
      return
    }
    requireLogin('/pages/workflow-cases/index')
  }

  const goWorkflowLinear = () => {
    if (loggedIn) {
      goPage('/pages/workflow-linear/index')
      return
    }
    requireLogin('/pages/workflow-linear/index')
  }

  const updateRechargeCryptoRoute = (route) => {
    setRechargePayment((current) => current ? { ...current, cryptoRoute: route } : current)
  }

  const createRechargeCryptoOrder = async (route) => {
    if (!rechargePayment?.order?.id || rechargePayment.cryptoCreating) return
    setRechargePayment((current) => current ? { ...current, cryptoCreating: true } : current)
    Taro.showLoading({ title: '创建 Crypto 支付' })
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
      Taro.showToast({ title: error.message || 'Crypto 支付创建失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const reloadBalance = async () => {
    applyAccountData(await loadAccount({ force: true }))
  }

  const beginRecharge = async () => {
    if (configLoading) {
      Taro.showToast({ title: '应用配置同步中', icon: 'none' })
      return
    }
    if (!rechargeFeatureEnabled) {
      Taro.showToast({ title: '充值功能暂未开放', icon: 'none' })
      return
    }
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
      if (isTelegramStarsRuntime(clientRuntime)) {
        nextPayment.starsOrder = await createTelegramStarsOrder({ paymentOrderId: order.id })
      } else if (isPlatformPaymentRuntime(clientRuntime)) {
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

  const rechargeDisabled = configLoading || !rechargeFeatureEnabled || rechargePolicy.allowCustomAmount === false
  const estimatedPoints = Math.max(0, Math.floor((Number(rechargeAmount || 0)) * rechargePolicy.pointRate))
  const minRecharge = money(rechargePolicy.minAmountCents / 100)
  const maxRecharge = money(rechargePolicy.maxAmountCents / 100)

  return (
    <Shell active='mine' title='我的' onRefresh={loggedIn ? reloadBalance : () => Promise.resolve()}>
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
            ? `点数 ${balance === null ? '--' : balance} 点${frozenBalance ? `，冻结 ${frozenBalance} 点` : ''}。所有充值均直接购买点数，不能提现。`
            : '登录后可查看作品、复制提示词并使用生成工具。'}
        </Text>
        <View className='hero-actions'>
          {loggedIn ? (
            <>
              <View className={rechargeDisabled ? 'ghost-button glass-button disabled' : 'ghost-button glass-button'} onClick={rechargeDisabled ? undefined : beginRecharge}>
                <AppIcon name='coin' size={16} />
                <Text>购买点数</Text>
              </View>
              <View className='ghost-button glass-button' onClick={signOut}>
                <AppIcon name='logout' size={16} />
                <Text>退出登录</Text>
              </View>
            </>
          ) : (
            <View className='primary-button' onClick={() => goPage('/pages/login/index?redirect=/pages/mine/index')}>
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
            <Text className={rechargeDisabled ? 'status failed' : 'status success'}>
              {rechargeDisabled ? '暂未开放' : `1 CNY = ${rechargePolicy.pointRate} 点`}
            </Text>
          </View>

          <Text className='input-label'>充值金额</Text>
          <View className='text-input recharge-input'>
            <Text className='money-prefix'>¥</Text>
            <Input
              type='digit'
              value={rechargeAmount}
              disabled={rechargeDisabled}
              placeholder={`最低 ${minRecharge}`}
              placeholderClass='muted'
              onInput={(event) => setRechargeAmount(event.detail.value)}
            />
          </View>
          <View className='recharge-meta'>
            <Text>预计到账 {estimatedPoints} 点</Text>
            <Text>范围 ¥{minRecharge} - ¥{maxRecharge}</Text>
          </View>
          <View className={creatingRecharge || rechargeDisabled ? 'primary-button full-width-button disabled' : 'primary-button full-width-button'} onClick={creatingRecharge || rechargeDisabled ? undefined : beginRecharge}>
            <AppIcon name='coin' size={16} />
            <Text>{rechargeDisabled ? '充值已关闭' : creatingRecharge ? '创建中...' : '创建点数订单'}</Text>
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
        <View className={rechargeDisabled ? 'profile-card disabled' : 'profile-card'} onClick={rechargeDisabled ? undefined : beginRecharge}>
          <View className='profile-icon'><AppIcon name='coin' size={22} /></View>
          <Text className='profile-name'>购买点数</Text>
          <Text className='tool-desc'>充值后不可提现</Text>
        </View>
        <View className='profile-card' onClick={goWorkflowPurchases}>
          <View className='profile-icon'><AppIcon name='fusion' size={22} /></View>
          <Text className='profile-name'>已购模板库</Text>
          <Text className='tool-desc'>Workflow 权益</Text>
        </View>
        <View className='profile-card' onClick={goWorkflowCases}>
          <View className='profile-icon'><AppIcon name='fusion' size={22} /></View>
          <Text className='profile-name'>我的workflow</Text>
          <Text className='tool-desc'>购买和运行模板</Text>
        </View>
        <View className='profile-card' onClick={goWorkflowLinear}>
          <View className='profile-icon'><AppIcon name='wand' size={22} /></View>
          <Text className='profile-name'>我的模板</Text>
          <Text className='tool-desc'>创建 AI模板</Text>
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
        <View className='profile-card' onClick={() => showAgreement('creator')}>
          <View className='profile-icon'><AppIcon name='wand' size={22} /></View>
          <Text className='profile-name'>创作条款</Text>
          <Text className='tool-desc'>生成服务说明</Text>
        </View>
      </View>

      <Suspense fallback={null}>
        {customerOpen && <CustomerModal open={customerOpen} onClose={() => setCustomerOpen(false)} />}
        {agreementModal && (
          <AgreementModal
        open={Boolean(agreementModal)}
        title={agreementModal?.title}
        content={agreementModal?.content}
        onClose={() => setAgreementModal(null)}
          />
        )}
        {rechargePayment && (
          <PaymentSheet
        open={Boolean(rechargePayment)}
        title='点数充值'
        payment={rechargePayment}
        onClose={() => setRechargePayment(null)}
        onRefresh={refreshRechargePayment}
        onCryptoRouteChange={updateRechargeCryptoRoute}
        onCreateCryptoOrder={createRechargeCryptoOrder}
          />
        )}
      </Suspense>
    </Shell>
  )
}
