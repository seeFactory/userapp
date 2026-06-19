import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Picker } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import {
  cancelWalletWithdrawal,
  createWalletCryptoOrder,
  createWalletWithdrawal,
  fetchWalletAccount,
  fetchWalletCryptoOrder,
  fetchWalletRechargeOptions,
  fetchWalletWithdrawals,
  fetchWithdrawalAddress,
  saveWithdrawalAddress
} from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/storage'

const defaultOptions = {
  currency: 'USD',
  minRechargeAmount: 10,
  chains: [],
  acquiringConfigured: false
}

function asId(item) {
  return item?.id || item?._id || ''
}

function money(value) {
  return Number(value || 0).toFixed(2)
}

function shortDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function orderStatusText(status) {
  const map = {
    pending: '等待支付',
    processing: '确认中',
    paid: '已到账',
    expired: '已过期',
    failed: '失败'
  }
  return map[status] || '等待支付'
}

function withdrawalStatusText(status) {
  const map = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回',
    paid: '已打款',
    cancelled: '已取消'
  }
  return map[status] || '待审核'
}

function statusClass(status) {
  if (['paid', 'approved'].includes(status)) return 'status success'
  if (['processing', 'pending'].includes(status)) return 'status warning'
  if (['expired', 'failed', 'rejected', 'cancelled'].includes(status)) return 'status failed'
  return 'status'
}

function firstRoute(chains, preferred = {}) {
  const selectedChain = chains.find((item) => item.chain === preferred.chain) || chains[0]
  const selectedToken = selectedChain?.tokens?.find((item) => item.token === preferred.token) || selectedChain?.tokens?.[0]
  return {
    chain: selectedChain?.chain || '',
    token: selectedToken?.token || '',
    bridgeCurrency: selectedToken?.bridgeCurrency || ''
  }
}

function ChainTokenPicker({ title, chains, value, onChange }) {
  const selectedChain = chains.find((item) => item.chain === value.chain) || chains[0]
  const tokens = selectedChain?.tokens || []
  const selectedToken = tokens.find((item) => item.token === value.token) || tokens[0]
  const chainIndex = Math.max(0, chains.findIndex((item) => item.chain === selectedChain?.chain))
  const tokenIndex = Math.max(0, tokens.findIndex((item) => item.token === selectedToken?.token))

  const updateChain = (event) => {
    const nextChain = chains[Number(event.detail.value)] || chains[0]
    const nextToken = nextChain?.tokens?.[0]
    onChange({
      chain: nextChain?.chain || '',
      token: nextToken?.token || '',
      bridgeCurrency: nextToken?.bridgeCurrency || ''
    })
  }

  const updateToken = (event) => {
    const nextToken = tokens[Number(event.detail.value)] || tokens[0]
    onChange({
      chain: selectedChain?.chain || '',
      token: nextToken?.token || '',
      bridgeCurrency: nextToken?.bridgeCurrency || ''
    })
  }

  return (
    <View className='wallet-picker-block'>
      <Text className='input-label'>{title}</Text>
      <View className='wallet-select-grid'>
        <Picker mode='selector' range={chains.map((item) => `${item.label} · ${item.network}`)} value={chainIndex} onChange={updateChain}>
          <View className='select-field'>
            <Text>{selectedChain ? `${selectedChain.label}` : '暂无支付链'}</Text>
            <Text className='select-sub'>{selectedChain?.network || '--'}</Text>
          </View>
        </Picker>
        <Picker mode='selector' range={tokens.map((item) => `${item.token} · ${item.bridgeCurrency}`)} value={tokenIndex} onChange={updateToken}>
          <View className='select-field'>
            <Text>{selectedToken?.token || '暂无代币'}</Text>
            <Text className='select-sub'>{selectedToken?.bridgeCurrency || '--'}</Text>
          </View>
        </Picker>
      </View>
    </View>
  )
}

export default function Wallet() {
  const loggedIn = isLoggedIn()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState(null)
  const [options, setOptions] = useState(defaultOptions)
  const [rechargeRoute, setRechargeRoute] = useState({ chain: '', token: '', bridgeCurrency: '' })
  const [withdrawRoute, setWithdrawRoute] = useState({ chain: '', token: '', bridgeCurrency: '' })
  const [rechargeAmount, setRechargeAmount] = useState('10')
  const [order, setOrder] = useState(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [addressForm, setAddressForm] = useState({ address: '', memo: '' })
  const [withdrawAmount, setWithdrawAmount] = useState('10')
  const [withdrawals, setWithdrawals] = useState([])
  const [savingAddress, setSavingAddress] = useState(false)
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false)

  const account = overview?.account || {}
  const currency = options.currency || account.currency || 'USD'
  const minRecharge = Number(options.minRechargeAmount || 10)
  const minWithdrawal = Number(overview?.options?.minWithdrawalAmount || 10)
  const currentOrderId = asId(order)
  const currentOrderStatus = order?.status

  const selectedDepositAddress = order?.bridgeDepositAddress || order?.depositAddress || ''
  const paymentAmount = order?.payAmount || order?.amount || rechargeAmount
  const paymentCurrency = order?.payBridgeCurrency || order?.payCurrency || rechargeRoute.bridgeCurrency

  const loadWallet = async (silent = false) => {
    if (!loggedIn) return
    if (!silent) setLoading(true)
    try {
      const [accountData, optionData, addressData, withdrawalData] = await Promise.all([
        fetchWalletAccount(),
        fetchWalletRechargeOptions(),
        fetchWithdrawalAddress().catch(() => null),
        fetchWalletWithdrawals({ pageSize: 6 })
      ])
      const nextOptions = { ...defaultOptions, ...(optionData || {}) }
      const chains = nextOptions.chains || []
      setOverview(accountData)
      setOptions(nextOptions)
      setWithdrawals(withdrawalData?.list || [])
      setRechargeRoute((current) => current.chain ? current : firstRoute(chains))
      setWithdrawRoute((current) => addressData?.chain ? firstRoute(chains, addressData) : (current.chain ? current : firstRoute(chains)))
      if (addressData?.address) {
        setAddressForm({
          address: addressData.address,
          memo: addressData.memo || ''
        })
      }
      setRechargeAmount((value) => value || String(nextOptions.minRechargeAmount || 10))
      setWithdrawAmount((value) => value || String(accountData?.options?.minWithdrawalAmount || 10))
    } catch (error) {
      Taro.showToast({ title: error.message || '钱包数据加载失败', icon: 'none' })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!loggedIn) return undefined
    loadWallet()
    return undefined
  }, [loggedIn])

  useEffect(() => {
    if (!currentOrderId || !['pending', 'processing'].includes(currentOrderStatus)) return undefined
    const timer = setInterval(async () => {
      try {
        const nextOrder = await fetchWalletCryptoOrder(currentOrderId)
        setOrder(nextOrder)
        if (nextOrder?.status === 'paid') {
          await loadWallet(true)
          Taro.showToast({ title: '充值已到账', icon: 'success' })
        }
      } catch (_) {}
    }, 5000)
    return () => clearInterval(timer)
  }, [currentOrderId, currentOrderStatus])

  const chainCount = useMemo(() => options.chains?.length || 0, [options.chains])

  if (!loggedIn) {
    requireLogin('/pages/wallet/index')
    return <Shell title='钱包' showTab={false}><View className='empty'>正在前往登录</View></Shell>
  }

  const createOrder = async () => {
    const amount = Number(rechargeAmount)
    if (!Number.isFinite(amount) || amount < minRecharge) {
      Taro.showToast({ title: `充值金额最低 ${minRecharge} ${currency}`, icon: 'none' })
      return
    }
    if (!options.acquiringConfigured) {
      Taro.showModal({
        title: '充值暂不可用',
        content: '后台尚未配置启用的收单地址，请稍后再试。',
        showCancel: false,
        confirmText: '我知道了'
      })
      return
    }
    if (!rechargeRoute.chain || !rechargeRoute.token) {
      Taro.showToast({ title: '请选择支付链和支付代币', icon: 'none' })
      return
    }
    if (creatingOrder) return
    setCreatingOrder(true)
    Taro.showLoading({ title: '创建订单' })
    try {
      const nextOrder = await createWalletCryptoOrder({
        amount,
        payChain: rechargeRoute.chain,
        payToken: rechargeRoute.token
      })
      setOrder(nextOrder)
      Taro.showToast({ title: '充值订单已创建', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error.message || '创建订单失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setCreatingOrder(false)
    }
  }

  const refreshOrder = async () => {
    if (!currentOrderId) return
    Taro.showLoading({ title: '刷新状态' })
    try {
      const nextOrder = await fetchWalletCryptoOrder(currentOrderId)
      setOrder(nextOrder)
      if (nextOrder.status === 'paid') await loadWallet(true)
      Taro.showToast({ title: orderStatusText(nextOrder.status), icon: nextOrder.status === 'paid' ? 'success' : 'none' })
    } catch (error) {
      Taro.showToast({ title: error.message || '订单状态刷新失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const copyAddress = () => {
    if (!selectedDepositAddress) return
    Taro.setClipboardData({
      data: selectedDepositAddress,
      success: () => Taro.showToast({ title: '地址已复制', icon: 'success' })
    })
  }

  const saveAddress = async () => {
    if (!addressForm.address.trim()) {
      Taro.showToast({ title: '请填写提现地址', icon: 'none' })
      return null
    }
    if (!withdrawRoute.chain || !withdrawRoute.token) {
      Taro.showToast({ title: '请选择提现链和代币', icon: 'none' })
      return null
    }
    setSavingAddress(true)
    Taro.showLoading({ title: '保存地址' })
    try {
      const saved = await saveWithdrawalAddress({
        chain: withdrawRoute.chain,
        token: withdrawRoute.token,
        address: addressForm.address.trim(),
        memo: addressForm.memo.trim()
      })
      Taro.showToast({ title: '提现地址已保存', icon: 'success' })
      return saved
    } catch (error) {
      Taro.showToast({ title: error.message || '保存失败', icon: 'none' })
      return null
    } finally {
      Taro.hideLoading()
      setSavingAddress(false)
    }
  }

  const submitWithdrawal = async () => {
    const amount = Number(withdrawAmount)
    if (!Number.isFinite(amount) || amount < minWithdrawal) {
      Taro.showToast({ title: `提现金额最低 ${minWithdrawal} ${currency}`, icon: 'none' })
      return
    }
    if (!addressForm.address.trim()) {
      Taro.showToast({ title: '请先填写提现地址', icon: 'none' })
      return
    }
    if (submittingWithdrawal) return
    setSubmittingWithdrawal(true)
    Taro.showLoading({ title: '提交提现' })
    try {
      await createWalletWithdrawal({
        amount,
        chain: withdrawRoute.chain,
        token: withdrawRoute.token,
        address: addressForm.address.trim(),
        memo: addressForm.memo.trim()
      })
      await loadWallet(true)
      Taro.showToast({ title: '提现申请已提交', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error.message || '提现提交失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setSubmittingWithdrawal(false)
    }
  }

  const cancelWithdrawal = async (item) => {
    const id = asId(item)
    if (!id) return
    Taro.showLoading({ title: '取消提现' })
    try {
      await cancelWalletWithdrawal(id)
      await loadWallet(true)
      Taro.showToast({ title: '提现已取消', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error.message || '取消失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  return (
    <Shell title='钱包' showTab={false}>
      <View className='panel wallet-hero'>
        <View className='panel-brand-row'>
          <BrandLogo size={52} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>Wallet</Text>
            <Text className='section-title'>平台钱包</Text>
          </View>
        </View>
        <Text className='tool-desc'>充值走 crypto bridge 真实订单，到账后进入平台钱包余额；提现申请由后台人工审核并打款。</Text>
        <View className='wallet-balance-grid'>
          <View className='wallet-balance-card'>
            <Text>可用余额</Text>
            <Text>{money(account.availableBalance)} {currency}</Text>
          </View>
          <View className='wallet-balance-card'>
            <Text>冻结余额</Text>
            <Text>{money(account.frozenBalance)} {currency}</Text>
          </View>
          <View className='wallet-balance-card'>
            <Text>累计充值</Text>
            <Text>{money(account.totalRecharged)} {currency}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className='loading-state'>
          <View className='loading-ring' />
          <Text>正在同步钱包数据</Text>
        </View>
      ) : (
        <>
          <View className='form-panel wallet-panel'>
            <View className='section-head slim'>
              <View>
                <Text className='section-kicker'>Recharge</Text>
                <Text className='section-title'>钱包充值</Text>
              </View>
              <Text className={options.acquiringConfigured ? 'status success' : 'status failed'}>
                {options.acquiringConfigured ? '已开放' : '未配置'}
              </Text>
            </View>
            <Text className='input-label'>充值金额</Text>
            <Input
              className='text-input amount-input'
              type='digit'
              value={rechargeAmount}
              placeholder={`最低 ${minRecharge} ${currency}`}
              onInput={(event) => setRechargeAmount(event.detail.value)}
            />
            <Text className='wallet-hint'>当前钱包以 {currency} 记账，打币金额以订单页展示为准。</Text>
            <ChainTokenPicker
              title='支付链与代币'
              chains={options.chains || []}
              value={rechargeRoute}
              onChange={setRechargeRoute}
            />
            <View className={chainCount ? 'primary-button block-gap' : 'primary-button block-gap disabled'} onClick={createOrder}>
              <AppIcon name='wallet' size={16} />
              <Text>{creatingOrder ? '创建中...' : '创建充值订单'}</Text>
            </View>
          </View>

          {order && (
            <View className='panel wallet-order-card'>
              <View className='modal-head'>
                <Text className='modal-title'>打币订单</Text>
                <Text className={statusClass(order.status)}>{orderStatusText(order.status)}</Text>
              </View>
              <View className='payment-row strong'>
                <Text>需支付</Text>
                <Text>{paymentAmount} {paymentCurrency}</Text>
              </View>
              <View className='payment-row'>
                <Text>过期时间</Text>
                <Text>{shortDate(order.expiresAt)}</Text>
              </View>
              <Text className='input-label'>打币地址</Text>
              <View className='copy-box wallet-copy-box' onClick={copyAddress}>
                <Text>{selectedDepositAddress || '等待订单返回地址'}</Text>
                <AppIcon name='copy' size={16} />
              </View>
              <View className='hero-actions'>
                <View className='primary-button' onClick={refreshOrder}>
                  <AppIcon name='refresh' size={16} />
                  <Text>刷新状态</Text>
                </View>
                <View className='ghost-button glass-button' onClick={copyAddress}>
                  <AppIcon name='copy' size={16} />
                  <Text>复制地址</Text>
                </View>
              </View>
            </View>
          )}

          <View className='form-panel wallet-panel'>
            <View className='section-head slim'>
              <View>
                <Text className='section-kicker'>Withdrawal</Text>
                <Text className='section-title'>提现管理</Text>
              </View>
            </View>
            <ChainTokenPicker
              title='提现链与代币'
              chains={options.chains || []}
              value={withdrawRoute}
              onChange={setWithdrawRoute}
            />
            <Text className='input-label'>提现地址</Text>
            <Input
              className='text-input'
              value={addressForm.address}
              placeholder='填写链上收款地址'
              onInput={(event) => setAddressForm({ ...addressForm, address: event.detail.value })}
            />
            <Text className='input-label'>Memo / Tag</Text>
            <Input
              className='text-input'
              value={addressForm.memo}
              placeholder='无 memo 可留空'
              onInput={(event) => setAddressForm({ ...addressForm, memo: event.detail.value })}
            />
            <View className='ghost-button glass-button block-gap' onClick={saveAddress}>
              <AppIcon name='badge' size={16} />
              <Text>{savingAddress ? '保存中...' : '保存提现地址'}</Text>
            </View>
            <Text className='input-label'>提现金额</Text>
            <Input
              className='text-input amount-input'
              type='digit'
              value={withdrawAmount}
              placeholder={`最低 ${minWithdrawal} ${currency}`}
              onInput={(event) => setWithdrawAmount(event.detail.value)}
            />
            <View className='primary-button block-gap' onClick={submitWithdrawal}>
              <AppIcon name='share' size={16} />
              <Text>{submittingWithdrawal ? '提交中...' : '提交提现申请'}</Text>
            </View>
          </View>

          <View className='panel wallet-panel'>
            <View className='section-head slim'>
              <View>
                <Text className='section-kicker'>Records</Text>
                <Text className='section-title'>提现记录</Text>
              </View>
            </View>
            {withdrawals.length ? (
              <View className='wallet-list'>
                {withdrawals.map((item) => (
                  <View key={asId(item)} className='wallet-row'>
                    <View className='wallet-row-main'>
                      <Text className='profile-name'>{money(item.amount)} {item.currency || currency}</Text>
                      <Text className='tool-desc'>{item.chain} · {item.token} · {shortDate(item.createdAt)}</Text>
                    </View>
                    <View className='wallet-row-side'>
                      <Text className={statusClass(item.status)}>{withdrawalStatusText(item.status)}</Text>
                      {item.status === 'pending' && (
                        <View className='ghost-button compact' onClick={() => cancelWithdrawal(item)}>
                          <Text>取消</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className='empty compact-empty'>暂无提现记录</View>
            )}
          </View>
        </>
      )}

      <View className='ghost-button glass-button block-gap' onClick={() => Taro.navigateBack()}>
        <AppIcon name='back' size={16} />
        <Text>返回</Text>
      </View>
    </Shell>
  )
}
