import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { cases, tools } from '../../data/mock'
import { isLoggedIn, requireLogin } from '../../utils/storage'

export default function PromptDetail() {
  const { id } = getCurrentInstance().router.params
  const item = cases.find((entry) => entry.id === id) || cases[0]
  const tool = tools.find((entry) => entry.id === item.toolId)
  const loggedIn = isLoggedIn()

  const copyPrompt = () => {
    if (!requireLogin(`/pages/prompt-detail/index?id=${item.id}`)) return
    Taro.setClipboardData({
      data: item.prompt,
      success: () => Taro.showToast({ title: '提示词已复制', icon: 'success' })
    })
  }

  const sameCreation = () => {
    if (!requireLogin(`/pages/prompt-detail/index?id=${item.id}`)) return
    Taro.navigateTo({ url: `/pages/tool/index?id=${item.toolId}&prompt=${encodeURIComponent(item.prompt)}` })
  }

  return (
    <Shell title='提示词详情' showTab={false}>
      <Image className='detail-image' src={item.image} mode='aspectFill' />

      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
          <Text className='section-kicker'>{tool?.name || 'AI 工具'}</Text>
          <Text className='section-title'>{item.title}</Text>
          </View>
        </View>
      </View>

      <View className='filter-row'>
        {item.tags.map((tag) => <View key={tag} className='filter-chip active'>{tag}</View>)}
      </View>

      {loggedIn ? (
        <View className='prompt-box'>{item.prompt}</View>
      ) : (
        <View className='prompt-box locked' onClick={() => requireLogin(`/pages/prompt-detail/index?id=${item.id}`)}>
          <AppIcon name='lock' size={16} />
          <Text>登录后可见完整提示词</Text>
        </View>
      )}

      <View className='hero-actions'>
        <View className='primary-button' onClick={sameCreation}>
          <AppIcon name='wand' size={16} />
          <Text>同款生成</Text>
        </View>
        <View className='ghost-button glass-button' onClick={copyPrompt}>
          <AppIcon name='copy' size={16} />
          <Text>复制提示词</Text>
        </View>
      </View>
      <View className='ghost-button glass-button block-gap' onClick={() => Taro.navigateBack()}>
        <AppIcon name='back' size={16} />
        <Text>返回</Text>
      </View>
    </Shell>
  )
}
