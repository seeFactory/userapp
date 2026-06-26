import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
import { fetchWalletAccount, fetchWalletWithdrawals } from '../../services/api'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { isLoggedIn, requireLogin } from '../../utils/storage'

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

function withdrawalStatusText(status) {
  const map = {
    pending: '历史待处理',
    approved: '历史已通过',
    rejected: '历史已驳回',
    paid: '历史已打款',
    cancelled: '历史已取消'
  }
  return map[status] || '历史记录'
}

function statusClass(status) {
  if (['paid', 'approved'].includes(status)) return 'status success'
  if (['processing', 'pending'].includes(status)) return 'status warning'
  if (['expired', 'failed', 'rejected', 'cancelled'].includes(status)) return 'status failed'
  return 'status'
}

export default function Wallet() {
  const loggedIn = isLoggedIn()
  const { config, loading: configLoading } = useAppConfig()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [overview, setOverview] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])

  const account = overview?.account || {}
  const currency = account.currency || overview?.options?.currency || 'USD'
  const rechargeFeatureEnabled = isFeatureEnabled(config, 'recharge')

  const loadWallet = async () => {
    if (!loggedIn) return
    setLoading(true)
    Taro.showLoading({ title: '加载中', mask: true })
    try {
      const [accountData, withdrawalData] = await Promise.all([
        fetchWalletAccount(),
        fetchWalletWithdrawals({ pageSize: 12 })
      ])
      setOverview(accountData)
      setWithdrawals(withdrawalData?.list || [])
      setLoadError('')
    } catch (error) {
      const message = error.message || '历史钱包数据加载失败'
      setLoadError(message)
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setLoading(false)
      Taro.hideLoading()
    }
  }

  const showClosedNotice = (content) => {
    Taro.showModal({
      title: '功能已关闭',
      content,
      showCancel: false,
      confirmText: '知道了'
    })
  }

  useEffect(() => {
    loadWallet()
  }, [loggedIn])

  if (!loggedIn) {
    return (
      <Shell title='历史钱包' showTab={false} backFallback='/pages/mine/index' onRefresh={loadWallet}>
        <EmptyState
          title='请先登录'
          description='登录后可查看历史钱包余额和历史提现记录。'
          icon='lock'
          actionText='前往登录'
          onAction={() => requireLogin('/pages/wallet/index')}
        />
      </Shell>
    )
  }

  return (
    <Shell title='历史钱包' showTab={false} backFallback='/pages/mine/index' onRefresh={loadWallet}>
      <View className='panel wallet-hero'>
        <View className='panel-brand-row'>
          <BrandLogo size={52} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>只读历史</Text>
            <Text className='section-title'>历史钱包记录</Text>
          </View>
        </View>
        <Text className='tool-desc'>当前充值统一购买点数，提现通道已关闭。这里仅保留历史钱包余额、流水和提现记录展示。</Text>
        {!configLoading && !rechargeFeatureEnabled ? (
          <InlineNotice tone='warning'>充值功能已由后台关闭</InlineNotice>
        ) : null}
        <InlineNotice tone='warning'>历史钱包余额不会自动兑换为点数，也不能继续发起提现。</InlineNotice>
        <View className='wallet-balance-grid'>
          <View className='wallet-balance-card'>
            <Text>历史可用余额</Text>
            <Text>{money(account.availableBalance)} {currency}</Text>
          </View>
          <View className='wallet-balance-card'>
            <Text>历史冻结余额</Text>
            <Text>{money(account.frozenBalance)} {currency}</Text>
          </View>
          <View className='wallet-balance-card'>
            <Text>历史累计充值</Text>
            <Text>{money(account.totalRecharged)} {currency}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <PageLoading title='正在同步历史钱包数据' description='正在读取历史余额和历史提现记录。' />
      ) : loadError && !overview ? (
        <ErrorState title='历史钱包加载失败' description={loadError} onRetry={loadWallet} />
      ) : (
        <View className='panel wallet-panel'>
          <View className='section-head slim'>
            <View>
              <Text className='section-kicker'>记录</Text>
              <Text className='section-title'>历史提现记录</Text>
            </View>
            <Text className='status failed'>已关闭</Text>
          </View>
          {loadError ? <InlineNotice tone='danger'>{loadError}</InlineNotice> : null}
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
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              compact
              title='暂无历史提现记录'
              description='提现通道已关闭，不再创建新的提现申请。'
              icon='wallet'
            />
          )}
        </View>
      )}

      <View className='panel wallet-panel'>
        <View className='hero-actions'>
          <View className='ghost-button glass-button disabled' onClick={() => showClosedNotice('当前充值统一进入点数账户，历史钱包不再发起新的充值。')}>
            <AppIcon name='wallet' size={16} />
            <Text>钱包充值已关闭</Text>
          </View>
          <View className='ghost-button glass-button disabled' onClick={() => showClosedNotice('提现通道已关闭，仅保留历史记录查询。')}>
            <AppIcon name='share' size={16} />
            <Text>提现已关闭</Text>
          </View>
        </View>
      </View>
    </Shell>
  )
}
