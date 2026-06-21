import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import { EmptyState, ErrorState, PageLoading } from '../../components/PageState'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { fetchTools } from '../../services/api'
import { goPage, goTab } from '../../utils/navigation'
import { isLoggedIn } from '../../utils/storage'

export default function Index() {
  const loggedIn = isLoggedIn()
  const { config, loading: configLoading } = useAppConfig()
  const generationEnabled = isFeatureEnabled(config, 'generation')
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTools = () => {
    if (configLoading) {
      setLoading(true)
      return () => {}
    }
    if (!generationEnabled) {
      setTools([])
      setLoading(false)
      setError('')
      return () => {}
    }
    let mounted = true
    setLoading(true)
    fetchTools()
      .then((list) => {
        if (!mounted) return
        setTools(list || [])
        setError('')
      })
      .catch(() => {
        if (mounted) setError('工具配置暂未同步，请稍后刷新。')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    const cleanup = loadTools()
    return cleanup
  }, [configLoading, generationEnabled])

  const openTool = (tool) => {
    if (!generationEnabled) {
      Taro.showToast({ title: '创作功能已由后台关闭', icon: 'none' })
      return
    }
    goPage(`/pages/tool/index?id=${tool.id}`)
  }

  const startFirstTool = () => {
    if (!generationEnabled) {
      Taro.showToast({ title: '创作功能已由后台关闭', icon: 'none' })
      return
    }
    goPage(`/pages/tool/index?id=${tools[0]?.id || 'factory-painter'}`)
  }

  return (
    <Shell active='home' title='首页'>
      <View className='hero'>
        <View className='hero-logo-line'>
          <View className='hero-orbit-icon'>
            <View className='hero-brand-image' style={{ backgroundImage: 'url(/static/logo-hero.png)' }} />
          </View>
          <Text className='hero-kicker'>seeFactory 智能创作工厂</Text>
        </View>
        <Text className='hero-title'>Hi，{loggedIn ? '创作者' : '游客'}</Text>
        <Text className='hero-subtitle'>用 AI 启动你的视觉工厂，从图片、视频到品牌漫画都在一个深色控制台里完成。</Text>
        <View className='hero-actions'>
          <View className={generationEnabled ? 'primary-button' : 'primary-button disabled'} onClick={startFirstTool}>
            <AppIcon name='wand' size={16} />
            <Text>开始创作</Text>
          </View>
          <View className='ghost-button glass-button' onClick={() => goTab('/pages/create-center/index')}>
            <AppIcon name='center' size={16} />
            <Text>看案例</Text>
          </View>
        </View>
      </View>

      <View className='section-head'>
        <View>
          <Text className='section-kicker'>工厂模块</Text>
          <Text className='section-title'>创作工具</Text>
        </View>
        <Text className='muted small'>{loading ? '同步配置中' : 'Admin 配置驱动'}</Text>
      </View>

      {!generationEnabled ? (
        <EmptyState title='创作功能已关闭' description='当前后台已关闭生成服务，已保留作品浏览、客服和账号能力。' icon='wand' />
      ) : loading ? (
        <PageLoading title='正在同步工具配置' description='正在读取后台配置的创作工具。' />
      ) : error ? (
        <ErrorState title='工具配置加载失败' description={error} onRetry={loadTools} />
      ) : tools.length ? (
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
      ) : (
        <EmptyState title='暂无可用工具' description='请在管理后台启用至少一个创作工具。' icon='wand' />
      )}
    </Shell>
  )
}
