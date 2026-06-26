import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
import { useAuthStatus } from '../../hooks/useAuthStatus'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { fetchAgentCommissions, fetchAgentInviteCode, fetchAgentProfile, fetchAgentStats, fetchAgreement } from '../../services/api'
import { formatAgreementContent } from '../../utils/agreement'
import { acceptAgreement, hasAcceptedAgreement, requireLogin } from '../../utils/storage'

const defaultStats = {
  invitedUsers: 0,
  activatedUsers: 0,
  commissionTotal: 0,
  withdrawEnabled: false
}

function commissionStatusText(status) {
  const map = {
    pending: '待统计',
    settled: '已统计',
    void: '已作废'
  }
  return map[status] || '待统计'
}

function formatMoney(cents = 0) {
  return `¥ ${(Number(cents || 0) / 100).toFixed(2)}`
}

export default function Agent() {
  const [profile, setProfile] = useState(null)
  const [inviteCode, setInviteCode] = useState(null)
  const [stats, setStats] = useState(defaultStats)
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agreementError, setAgreementError] = useState('')
  const [agreementDeclined, setAgreementDeclined] = useState(false)
  const { loggedIn } = useAuthStatus()
  const { config, loading: configLoading } = useAppConfig()
  const agentEnabled = isFeatureEnabled(config, 'agent')

  const ensureAgentAgreement = async () => {
    setAgreementError('')
    setAgreementDeclined(false)
    Taro.showLoading({ title: '加载协议' })
    try {
      const agreement = await fetchAgreement('agent')
      Taro.hideLoading()
      const version = agreement.version || agreement.id || agreement.updatedAt
      if (hasAcceptedAgreement('agent', version)) return true
      const result = await Taro.showModal({
        title: agreement.title || '代理推广协议',
        content: formatAgreementContent(agreement, config?.legal, '代理推广协议暂未发布，请联系平台确认后再进入代理中心。'),
        cancelText: '暂不进入',
        confirmText: '同意并进入'
      })
      if (result.confirm) {
        acceptAgreement('agent', version)
        return true
      }
      setAgreementDeclined(true)
      return false
    } catch (error) {
      Taro.hideLoading()
      setAgreementError(error.message || '代理推广协议加载失败')
      return false
    }
  }

  const loadAgent = () => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchAgentProfile(),
      fetchAgentInviteCode(),
      fetchAgentStats(),
      fetchAgentCommissions({ pageSize: 5 })
    ])
      .then(([profileData, inviteData, statsData, commissionData]) => {
        if (!mounted) return
        setProfile(profileData)
        setInviteCode(inviteData?.inviteCode || null)
        setStats({ ...defaultStats, ...statsData })
        setCommissions(commissionData?.list || [])
        setError('')
      })
      .catch((error) => {
        if (mounted) setError(error.message || '代理数据加载失败')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    if (configLoading) {
      setLoading(true)
      return undefined
    }
    if (!loggedIn || !agentEnabled) {
      if (!agentEnabled) setLoading(false)
      return undefined
    }
    let cleanup
    let mounted = true
    setLoading(true)
    ensureAgentAgreement().then((accepted) => {
      if (!mounted) return
      if (!accepted) {
        setLoading(false)
        return
      }
      cleanup = loadAgent()
    })
    return () => {
      mounted = false
      cleanup?.()
    }
  }, [loggedIn, configLoading, agentEnabled])

  if (configLoading) {
    return (
      <Shell title='代理中心' showTab={false} backFallback='/pages/mine/index'>
        <PageLoading title='正在同步应用配置' description='正在确认代理中心是否开放。' />
      </Shell>
    )
  }

  if (!agentEnabled) {
    return (
      <Shell title='代理中心' showTab={false} backFallback='/pages/mine/index'>
        <EmptyState title='代理中心已关闭' description='代理中心暂未开放，请稍后再试。' icon='agent' />
      </Shell>
    )
  }

  if (!loggedIn) {
    return (
      <Shell title='代理中心' showTab={false} backFallback='/pages/mine/index'>
        <EmptyState
          title='请先登录'
          description='登录后可查看代理身份、邀请码和佣金统计。'
          icon='lock'
          actionText='前往登录'
          onAction={() => requireLogin('/pages/agent/index')}
        />
      </Shell>
    )
  }

  const copyCode = () => {
    if (!inviteCode) {
      Taro.showToast({ title: '请联系管理员开通代理身份', icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: inviteCode,
      success: () => Taro.showToast({ title: '邀请码已复制', icon: 'success' })
    })
  }

  const isAgent = Boolean(profile?.isAgent)
  const statusText = isAgent ? (profile?.profile?.status === 'disabled' ? '已停用' : '已开通') : '未开通'

  return (
    <Shell title='代理中心' showTab={false} backFallback='/pages/mine/index'>
      <View className='panel'>
        <View className='panel-brand-row'>
          <BrandLogo size={50} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>推广管理</Text>
            <Text className='section-title'>{isAgent ? '推广数据' : '联系开通代理'}</Text>
          </View>
        </View>
        <Text className='tool-desc'>{isAgent ? '邀请码、邀请关系和佣金归因由平台统一管理，此处展示当前状态。' : '代理身份暂不支持自助申请，请联系平台完成开通和绑定。'}</Text>
      </View>

      {loading ? (
        <PageLoading title='正在同步代理数据' description='正在确认代理推广协议并读取代理身份、邀请码和佣金统计。' />
      ) : agreementError ? (
        <ErrorState title='代理协议加载失败' description={agreementError} onRetry={() => {
          setLoading(true)
          ensureAgentAgreement().then((accepted) => {
            if (!accepted) {
              setLoading(false)
              return
            }
            loadAgent()
          })
        }} />
      ) : agreementDeclined ? (
        <EmptyState
          title='请先确认代理推广协议'
          description='确认代理推广协议后，可继续查看代理身份、邀请码和佣金统计。'
          icon='book'
          actionText='查看并确认'
          onAction={() => {
            setLoading(true)
            ensureAgentAgreement().then((accepted) => {
              if (!accepted) {
                setLoading(false)
                return
              }
              loadAgent()
            })
          }}
        />
      ) : error && !profile ? (
        <ErrorState title='代理数据加载失败' description={error} onRetry={loadAgent} />
      ) : (
        <>
          {error ? <InlineNotice tone='danger'>{error}</InlineNotice> : null}
          <View className='profile-grid spaced'>
            <View className='profile-card'>
              <View className='profile-icon'><AppIcon name='badge' size={22} /></View>
              <Text className='profile-name'>代理状态</Text>
              <Text className='tool-desc'>{statusText}</Text>
            </View>
            <View className='profile-card' onClick={copyCode}>
              <View className='profile-icon'><AppIcon name='copy' size={22} /></View>
              <Text className='profile-name'>邀请码</Text>
              <Text className='tool-desc'>{inviteCode || '开通后显示'}</Text>
            </View>
            <View className='profile-card'>
              <View className='profile-icon'><AppIcon name='user' size={22} /></View>
              <Text className='profile-name'>激活用户</Text>
              <Text className='tool-desc'>{stats.activatedUsers || 0} 人</Text>
            </View>
            <View className='profile-card'>
              <View className='profile-icon'><AppIcon name='agent' size={22} /></View>
              <Text className='profile-name'>累计佣金</Text>
              <Text className='tool-desc'>{formatMoney(stats.commissionTotal)}</Text>
            </View>
            <View className='profile-card'>
              <View className='profile-icon'><AppIcon name='scan' size={22} /></View>
              <Text className='profile-name'>待统计</Text>
              <Text className='tool-desc'>{formatMoney(stats.pendingCommission)}</Text>
            </View>
            <View className='profile-card'>
              <View className='profile-icon'><AppIcon name='badge' size={22} /></View>
              <Text className='profile-name'>已统计</Text>
              <Text className='tool-desc'>{formatMoney(stats.settledCommission)}</Text>
            </View>
          </View>

          <View className='qr-card qr-card-dark'>
            <View className='qr-grid'>
              {Array.from({ length: 49 }).map((_, index) => (
                <View key={index} className={inviteCode && ((index + index * 3) % 4 === 0 || index % 9 === 0) ? 'qr-cell on' : 'qr-cell'} />
              ))}
            </View>
            <Text>{inviteCode ? `推广识别码：${inviteCode}` : '代理开通后显示推广识别码'}</Text>
          </View>

          <View className='primary-button' onClick={copyCode}>
            <AppIcon name='copy' size={16} />
            <Text>{inviteCode ? '复制邀请码' : '等待平台开通'}</Text>
          </View>

          <View className='panel'>
            <View className='section-head slim'>
              <View>
                <Text className='section-kicker'>佣金记录</Text>
                <Text className='section-title'>佣金流水</Text>
              </View>
            </View>
            {commissions.length ? (
              <View className='commission-list'>
                {commissions.map((item) => (
                  <View key={item.id} className='commission-row'>
                    <View>
                      <Text className='profile-name'>{formatMoney(item.commissionAmountCents)}</Text>
                      <Text className='tool-desc'>第 {item.level || 1} 级 · {commissionStatusText(item.status)}</Text>
                    </View>
                    <Text className='section-kicker'>{item.commissionRate ? `${Math.round(item.commissionRate * 100)}%` : ''}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState compact title='暂无佣金流水' description='产生有效推广付费后，佣金记录会显示在这里。' icon='agent' />
            )}
          </View>
        </>
      )}

    </Shell>
  )
}
