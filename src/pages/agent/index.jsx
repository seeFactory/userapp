import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { fetchAgentInviteCode, fetchAgentProfile, fetchAgentStats } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/storage'

const defaultStats = {
  invitedUsers: 0,
  activatedUsers: 0,
  commissionTotal: 0,
  withdrawEnabled: false
}

function formatMoney(cents = 0) {
  return `¥ ${(Number(cents || 0) / 100).toFixed(2)}`
}

export default function Agent() {
  const [profile, setProfile] = useState(null)
  const [inviteCode, setInviteCode] = useState(null)
  const [stats, setStats] = useState(defaultStats)
  const [loading, setLoading] = useState(true)
  const loggedIn = isLoggedIn()

  useEffect(() => {
    if (!loggedIn) return undefined
    let mounted = true
    Promise.all([
      fetchAgentProfile(),
      fetchAgentInviteCode(),
      fetchAgentStats()
    ])
      .then(([profileData, inviteData, statsData]) => {
        if (!mounted) return
        setProfile(profileData)
        setInviteCode(inviteData?.inviteCode || null)
        setStats({ ...defaultStats, ...statsData })
      })
      .catch((error) => {
        Taro.showToast({ title: error.message || '代理数据加载失败', icon: 'none' })
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [loggedIn])

  if (!loggedIn) {
    requireLogin('/pages/agent/index')
    return <Shell title='代理中心' showTab={false}><View className='empty'>正在前往登录</View></Shell>
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
    <Shell title='代理中心' showTab={false}>
      <View className='panel'>
        <View className='panel-brand-row'>
          <BrandLogo size={50} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>Partner console</Text>
            <Text className='section-title'>{isAgent ? '推广关系面板' : '人工开通代理'}</Text>
          </View>
        </View>
        <Text className='tool-desc'>{isAgent ? '邀请码、邀请关系和佣金归因由后台统一配置，用户端仅展示当前状态。' : '代理身份不开放自助申请，请联系管理员完成开通和绑定。'}</Text>
      </View>

      {loading ? (
        <View className='loading-state'>
          <AppIcon name='sparkles' size={16} />
          <Text>正在同步代理数据</Text>
        </View>
      ) : (
        <>
          <View className='profile-grid spaced'>
            <View className='profile-card'>
              <View className='profile-icon'><AppIcon name='badge' size={22} /></View>
              <Text className='profile-name'>代理状态</Text>
              <Text className='tool-desc'>{statusText}</Text>
            </View>
            <View className='profile-card' onClick={copyCode}>
              <View className='profile-icon'><AppIcon name='copy' size={22} /></View>
              <Text className='profile-name'>邀请码</Text>
              <Text className='tool-desc'>{inviteCode || '后台配置后显示'}</Text>
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
            <Text>{inviteCode ? '复制邀请码' : '等待后台开通'}</Text>
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
