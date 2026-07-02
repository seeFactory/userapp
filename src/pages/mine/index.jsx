import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import AgreementModal from '../../components/AgreementModal'
import BrandLogo from '../../components/BrandLogo'
import CustomerModal from '../../components/CustomerModal'
import PaymentSheet from '../../components/PaymentSheet'
import { firstCryptoRoute } from '../../components/CryptoRoutePicker'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { useAuthState } from '../../hooks/useAuthState'
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
import { requireLogin } from '../../utils/storage'

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
  const { loggedIn, user: currentUser } = useAuthState()
  const [balance, setBalance] = useState(null)
  const [frozenBalance, setFrozenBalance] = useState(0)
  const [wallet, setWallet] = useState(null)
  const [rechargePolicy, setRechargePolicy] = useState(defaultRechargePolicy())
  const [rechargeAmount, setRechargeAmount] = useState('20')
  const [creatingRecharge, setCreatingRecharge] = useState(false)
  const [rechargePayment, setRechargePayment] = useState(null)
  const [agreementModal, setAgreementModal] = useState(null)
  const { config, loading: configLoading } = useAppConfig()
  const rechargeFeatureEnabled = isFeatureEnabled(config, 'recharge')
  const agentFeatureEnabled = isFeatureEnabled(config, 'agent')

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
      setFrozenBalance(creditData?.frozenBalance || 0)
      setWallet(walletData?.account || null)
      if (rechargeData) setRechargePolicy({ ...defaultRechargePolicy(), ...rechargeData })
    })
    return () => {
      mounted = false
    }
  }, [loggedIn])

  const signOut = async () => {
    await logoutRemote().catch(() => {})
    setBalance(null)
    setFrozenBalance(0)
    setWallet(null)
    setRechargePayment(null)
    Taro.showToast({ title: '宸查€€鍑虹櫥褰?, icon: 'success' })
  }

  const showAgreement = async (type) => {
    const titleMap = {
      user: '鐢ㄦ埛鍗忚',
      privacy: '闅愮鏀跨瓥',
      creator: '鍒涗綔涓庣敓鎴愭湇鍔℃潯娆?
    }
    Taro.showLoading({ title: '鍔犺浇涓? })
    try {
      const agreement = await fetchAgreement(type)
      Taro.hideLoading()
      setAgreementModal({
        title: agreement.title || titleMap[type],
        content: formatAgreementContent(agreement, config?.legal),
      })
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: error.message || '鍗忚鏆傛湭鍙戝竷', icon: 'none' })
    }
  }

  const goAgent = () => {
    if (configLoading) {
      Taro.showToast({ title: '搴旂敤閰嶇疆鍚屾涓?, icon: 'none' })
      return
    }
    if (!agentFeatureEnabled) {
      Taro.showToast({ title: '浠ｇ悊涓績鏆傛湭寮€鏀?, icon: 'none' })
      return
    }
    if (loggedIn) {
      goPage('/pages/agent/index')
      return
    }
    requireLogin('/pages/agent/index')
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
    Taro.showLoading({ title: '鍒涘缓 Crypto 鏀粯' })
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
      Taro.showToast({ title: '鎵撳竵璁㈠崟宸插垱寤?, icon: 'success' })
    } catch (error) {
      setRechargePayment((current) => current ? { ...current, cryptoCreating: false } : current)
      Taro.showToast({ title: error.message || 'Crypto 鏀粯鍒涘缓澶辫触', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const reloadBalance = async () => {
    const { creditData, walletData, rechargeData } = await loadAccount()
    setBalance(creditData?.balance ?? null)
    setFrozenBalance(creditData?.frozenBalance || 0)
    setWallet(walletData?.account || null)
    if (rechargeData) setRechargePolicy({ ...defaultRechargePolicy(), ...rechargeData })
  }

  const beginRecharge = async () => {
    if (configLoading) {
      Taro.showToast({ title: '搴旂敤閰嶇疆鍚屾涓?, icon: 'none' })
      return
    }
    if (!rechargeFeatureEnabled) {
      Taro.showToast({ title: '鍏呭€煎姛鑳芥殏鏈紑鏀?, icon: 'none' })
      return
    }
    if (!requireLogin('/pages/mine/index')) return
    if (rechargePolicy.allowCustomAmount === false) {
      Taro.showToast({ title: '鐐规暟鍏呭€兼殏鏈紑鏀?, icon: 'none' })
      return
    }
    const amount = Number(rechargeAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      Taro.showToast({ title: '璇疯緭鍏ユ湁鏁堝厖鍊奸噾棰?, icon: 'none' })
      return
    }
    const amountCents = Math.round(amount * 100)
    if (amountCents < rechargePolicy.minAmountCents || amountCents > rechargePolicy.maxAmountCents) {
      Taro.showToast({
        title: `閲戦闇€鍦?楼${money(rechargePolicy.minAmountCents / 100)} 鍒?楼${money(rechargePolicy.maxAmountCents / 100)}`,
        icon: 'none'
      })
      return
    }
    const clientRuntime = getClientRuntime()
    setCreatingRecharge(true)
    Taro.showLoading({ title: '鍒涘缓鏀粯' })
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
        title: nextPayment.cryptoOrderRequired ? '璇烽€夋嫨鏀粯閾惧苟鍒涘缓璁㈠崟' : '璇峰畬鎴愭敮浠樺悗鍒锋柊鐘舵€?,
        icon: 'none'
      })
    } catch (error) {
      if (error?.action === 'login' || error?.statusCode === 401) {
        Taro.showToast({ title: '璇烽噸鏂扮櫥褰曞悗鍐嶅垱寤鸿鍗?, icon: 'none' })
        return
      }
      Taro.showToast({ title: error.message || '鍒涘缓鏀粯澶辫触', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setCreatingRecharge(false)
    }
  }

  const refreshRechargePayment = async () => {
    if (!rechargePayment?.order?.id) return
    Taro.showLoading({ title: '鍒锋柊鐘舵€? })
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
        Taro.showToast({ title: '鐐规暟宸插埌璐?, icon: 'success' })
      } else {
        Taro.showToast({ title: '璁㈠崟浠嶅湪澶勭悊涓?, icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: error.message || '鐘舵€佸埛鏂板け璐?, icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const rechargeDisabled = configLoading || !rechargeFeatureEnabled || rechargePolicy.allowCustomAmount === false
  const estimatedPoints = Math.max(0, Math.floor((Number(rechargeAmount || 0)) * rechargePolicy.pointRate))
  const minRecharge = money(rechargePolicy.minAmountCents / 100)
  const maxRecharge = money(rechargePolicy.maxAmountCents / 100)

  return (
    <Shell active='mine' title='鎴戠殑' onRefresh={loggedIn ? reloadBalance : () => Promise.resolve()}>
      <View className='panel'>
        <View className='panel-brand-row'>
          <BrandLogo size={54} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>璐︽埛涓績</Text>
            <Text className='section-title'>{loggedIn ? (currentUser?.nickname || 'seeFactory 鍒涗綔鑰?) : '鏈櫥褰?}</Text>
          </View>
        </View>
        <Text className='tool-desc'>
          {loggedIn
            ? `鐐规暟 ${balance === null ? '--' : balance} 鐐?{frozenBalance ? `锛屽喕缁?${frozenBalance} 鐐筦 : ''}銆傛墍鏈夊厖鍊煎潎鐩存帴璐拱鐐规暟锛屼笉鑳芥彁鐜般€俙
            : '鐧诲綍鍚庡彲鏌ョ湅浣滃搧銆佸鍒舵彁绀鸿瘝骞朵娇鐢ㄧ敓鎴愬伐鍏枫€?}
        </Text>
        <View className='hero-actions'>
          {loggedIn ? (
            <>
              <View className={rechargeDisabled ? 'ghost-button glass-button disabled' : 'ghost-button glass-button'} onClick={rechargeDisabled ? undefined : beginRecharge}>
                <AppIcon name='coin' size={16} />
                <Text>璐拱鐐规暟</Text>
              </View>
              <View className='ghost-button glass-button' onClick={signOut}>
                <AppIcon name='logout' size={16} />
                <Text>閫€鍑虹櫥褰?/Text>
              </View>
            </>
          ) : (
            <View className='primary-button' onClick={() => goPage('/pages/login/index?redirect=/pages/mine/index')}>
              <AppIcon name='login' size={16} />
              <Text>绔嬪嵆鐧诲綍</Text>
            </View>
          )}
        </View>
      </View>

      {loggedIn && (
        <View className='form-panel credit-recharge-panel'>
          <View className='section-head compact-head'>
            <View>
              <Text className='section-kicker'>鐐规暟鍏呭€?/Text>
              <Text className='section-title'>鑷～閲戦鍏呭€?/Text>
            </View>
            <Text className={rechargeDisabled ? 'status failed' : 'status success'}>
              {rechargeDisabled ? '鏆傛湭寮€鏀? : `1 CNY = ${rechargePolicy.pointRate} 鐐筦}
            </Text>
          </View>

          <Text className='input-label'>鍏呭€奸噾棰?/Text>
          <View className='text-input recharge-input'>
            <Text className='money-prefix'>楼</Text>
            <Input
              type='digit'
              value={rechargeAmount}
              disabled={rechargeDisabled}
              placeholder={`鏈€浣?${minRecharge}`}
              placeholderClass='muted'
              onInput={(event) => setRechargeAmount(event.detail.value)}
            />
          </View>
          <View className='recharge-meta'>
            <Text>棰勮鍒拌处 {estimatedPoints} 鐐?/Text>
            <Text>鑼冨洿 楼{minRecharge} - 楼{maxRecharge}</Text>
          </View>
          <View className={creatingRecharge || rechargeDisabled ? 'primary-button full-width-button disabled' : 'primary-button full-width-button'} onClick={creatingRecharge || rechargeDisabled ? undefined : beginRecharge}>
            <AppIcon name='coin' size={16} />
            <Text>{rechargeDisabled ? '鍏呭€煎凡鍏抽棴' : creatingRecharge ? '鍒涘缓涓?..' : '鍒涘缓鐐规暟璁㈠崟'}</Text>
          </View>
        </View>
      )}

      <View className='section-head'>
        <View>
          <Text className='section-kicker'>鏈嶅姟鏀寔</Text>
          <Text className='section-title'>鏈嶅姟鍏ュ彛</Text>
        </View>
      </View>

      <View className='profile-grid'>
        <View className={rechargeDisabled ? 'profile-card disabled' : 'profile-card'} onClick={rechargeDisabled ? undefined : beginRecharge}>
          <View className='profile-icon'><AppIcon name='coin' size={22} /></View>
          <Text className='profile-name'>璐拱鐐规暟</Text>
          <Text className='tool-desc'>鍏呭€煎悗涓嶅彲鎻愮幇</Text>
        </View>
        <View className='profile-card' onClick={goWorkflowPurchases}>
          <View className='profile-icon'><AppIcon name='fusion' size={22} /></View>
          <Text className='profile-name'>宸茶喘妯℃澘搴?/Text>
          <Text className='tool-desc'>Workflow 鏉冪泭</Text>
        </View>
        <View className='profile-card' onClick={goWorkflowCases}>
          <View className='profile-icon'><AppIcon name='fusion' size={22} /></View>
          <Text className='profile-name'>Workflow 妗堜緥</Text>
          <Text className='tool-desc'>璐拱鍜岃繍琛屾ā鏉?/Text>
        </View>
        <View className='profile-card' onClick={goWorkflowLinear}>
          <View className='profile-icon'><AppIcon name='wand' size={22} /></View>
          <Text className='profile-name'>AI妯℃澘</Text>
          <Text className='tool-desc'>鍒涘缓 Workflow</Text>
        </View>
        {!configLoading && agentFeatureEnabled ? (
        <View className='profile-card' onClick={goAgent}>
          <View className='profile-icon'><AppIcon name='agent' size={22} /></View>
          <Text className='profile-name'>浠ｇ悊涓績</Text>
          <Text className='tool-desc'>鐢ㄦ埛鍜屾縺娲?/Text>
        </View>
        ) : null}
        <View className='profile-card' onClick={() => setCustomerOpen(true)}>
          <View className='profile-icon'><AppIcon name='headphones' size={22} /></View>
          <Text className='profile-name'>鑱旂郴瀹㈡湇</Text>
          <Text className='tool-desc'>鍙嶉寤鸿</Text>
        </View>
        <View className='profile-card' onClick={() => showAgreement('user')}>
          <View className='profile-icon'><AppIcon name='book' size={22} /></View>
          <Text className='profile-name'>鐢ㄦ埛鍗忚</Text>
          <Text className='tool-desc'>鏌ョ湅鏈嶅姟鏉℃</Text>
        </View>
        <View className='profile-card' onClick={() => showAgreement('privacy')}>
          <View className='profile-icon'><AppIcon name='lock' size={22} /></View>
          <Text className='profile-name'>闅愮鏀跨瓥</Text>
          <Text className='tool-desc'>鏌ョ湅鏁版嵁璇存槑</Text>
        </View>
        <View className='profile-card' onClick={() => showAgreement('creator')}>
          <View className='profile-icon'><AppIcon name='wand' size={22} /></View>
          <Text className='profile-name'>鍒涗綔鏉℃</Text>
          <Text className='tool-desc'>鐢熸垚鏈嶅姟璇存槑</Text>
        </View>
      </View>

      <CustomerModal open={customerOpen} onClose={() => setCustomerOpen(false)} />
      <AgreementModal
        open={Boolean(agreementModal)}
        title={agreementModal?.title}
        content={agreementModal?.content}
        onClose={() => setAgreementModal(null)}
      />
      <PaymentSheet
        open={Boolean(rechargePayment)}
        title='鐐规暟鍏呭€?
        payment={rechargePayment}
        onClose={() => setRechargePayment(null)}
        onRefresh={refreshRechargePayment}
        onCryptoRouteChange={updateRechargeCryptoRoute}
        onCreateCryptoOrder={createRechargeCryptoOrder}
      />
    </Shell>
  )
}
