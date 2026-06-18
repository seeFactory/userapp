import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { isLoggedIn, requireLogin } from '../../utils/storage'

export default function Agent() {
  if (!isLoggedIn()) {
    requireLogin('/pages/agent/index')
    return <Shell title='代理中心' showTab={false}><View className='empty'>正在前往登录</View></Shell>
  }

  const copyCode = () => {
    Taro.setClipboardData({
      data: 'SF-2026-OPEN',
      success: () => Taro.showToast({ title: '邀请码已复制', icon: 'success' })
    })
  }

  return (
    <Shell title='代理中心' showTab={false}>
      <View className='panel'>
        <View className='panel-brand-row'>
          <BrandLogo size={50} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>Partner console</Text>
            <Text className='section-title'>推广与激活</Text>
          </View>
        </View>
        <Text className='tool-desc'>当前为假数据展示，第一阶段预留代理身份、邀请码、推广二维码、激活用户数和收益统计。</Text>
      </View>

      <View className='profile-grid spaced'>
        <View className='profile-card'>
          <View className='profile-icon'><AppIcon name='badge' size={22} /></View>
          <Text className='profile-name'>代理状态</Text>
          <Text className='tool-desc'>待开通</Text>
        </View>
        <View className='profile-card' onClick={copyCode}>
          <View className='profile-icon'><AppIcon name='copy' size={22} /></View>
          <Text className='profile-name'>邀请码</Text>
          <Text className='tool-desc'>SF-2026-OPEN</Text>
        </View>
        <View className='profile-card'>
          <View className='profile-icon'><AppIcon name='user' size={22} /></View>
          <Text className='profile-name'>激活用户</Text>
          <Text className='tool-desc'>36 人</Text>
        </View>
        <View className='profile-card'>
          <View className='profile-icon'><AppIcon name='agent' size={22} /></View>
          <Text className='profile-name'>累计收益</Text>
          <Text className='tool-desc'>¥ 1,286.00</Text>
        </View>
      </View>

      <View className='qr-card qr-card-dark'>
        <View className='qr-grid'>
          {Array.from({ length: 49 }).map((_, index) => (
            <View key={index} className={(index + index * 3) % 4 === 0 || index % 9 === 0 ? 'qr-cell on' : 'qr-cell'} />
          ))}
        </View>
        <Text>模拟推广二维码</Text>
      </View>

      <View className='primary-button' onClick={() => Taro.showToast({ title: '提现能力后续接入', icon: 'none' })}>
        <AppIcon name='agent' size={16} />
        <Text>申请提现</Text>
      </View>
      <View className='ghost-button glass-button block-gap' onClick={() => Taro.navigateBack()}>
        <AppIcon name='back' size={16} />
        <Text>返回</Text>
      </View>
    </Shell>
  )
}
