import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import CustomerModal from '../../components/CustomerModal'
import { fetchAgreement, fetchCreditBalance } from '../../services/api'
import { getCurrentUser, isLoggedIn, logout, requireLogin } from '../../utils/storage'

export default function Mine() {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [balance, setBalance] = useState(null)
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

  const signOut = () => {
    logout()
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
            <View className='ghost-button glass-button' onClick={signOut}>
              <AppIcon name='logout' size={16} />
              <Text>退出登录</Text>
            </View>
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
    </Shell>
  )
}
