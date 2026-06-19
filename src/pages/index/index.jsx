import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { tools as mockTools } from '../../data/mock'
import { fetchTools } from '../../services/api'
import { isLoggedIn } from '../../utils/storage'

export default function Index() {
  const loggedIn = isLoggedIn()
  const [tools, setTools] = useState(mockTools)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchTools()
      .then((list) => {
        if (mounted && list.length) setTools(list)
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  const openTool = (tool) => {
    Taro.navigateTo({ url: `/pages/tool/index?id=${tool.id}` })
  }

  return (
    <Shell active='home' title='首页'>
      <View className='hero'>
        <View className='hero-logo-line'>
          <View className='hero-orbit-icon'>
            <BrandLogo size={42} />
          </View>
          <Text className='hero-kicker'>seeFactory AI creation plant</Text>
        </View>
        <Text className='hero-title'>Hi，{loggedIn ? '创作者' : '游客'}</Text>
        <Text className='hero-subtitle'>用 AI 启动你的视觉工厂，从图片、视频到品牌漫画都在一个深色控制台里完成。</Text>
        <View className='hero-actions'>
          <View className='primary-button' onClick={() => Taro.navigateTo({ url: '/pages/tool/index?id=factory-painter' })}>
            <AppIcon name='wand' size={16} />
            <Text>开始创作</Text>
          </View>
          <View className='ghost-button glass-button' onClick={() => Taro.redirectTo({ url: '/pages/create-center/index' })}>
            <AppIcon name='center' size={16} />
            <Text>看案例</Text>
          </View>
        </View>
      </View>

      <View className='section-head'>
        <View>
          <Text className='section-kicker'>Factory modules</Text>
          <Text className='section-title'>创作工具</Text>
        </View>
        <Text className='muted small'>{loading ? '同步配置中' : 'Admin 配置驱动'}</Text>
      </View>

      <View className='tool-grid'>
        {tools.map((tool) => (
          <View
            key={tool.id}
            className={tool.featured ? 'tool-card featured' : 'tool-card'}
            onClick={() => openTool(tool)}
          >
            <Text className='tool-chip'>{tool.label}</Text>
            <View className='tool-icon'>
              <AppIcon name={tool.icon} size={20} />
            </View>
            <Text className='tool-name'>{tool.name}</Text>
            <Text className='tool-desc'>{tool.desc}</Text>
          </View>
        ))}
      </View>
    </Shell>
  )
}
