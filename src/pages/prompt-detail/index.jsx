import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { ErrorState, PageLoading } from '../../components/PageState'
import { copyPromptCase, fetchPromptCase, fetchTools, usePromptCase } from '../../services/api'
import { goPage } from '../../utils/navigation'
import { requireLogin } from '../../utils/storage'

export default function PromptDetail() {
  const { id } = getCurrentInstance().router.params
  const [item, setItem] = useState(null)
  const [toolList, setToolList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const tool = toolList.find((entry) => entry.id === item?.toolId)

  const loadPromptDetail = () => {
    let mounted = true
    setLoading(true)
    setItem(null)
    Promise.all([fetchPromptCase(id), fetchTools()])
      .then(([detail, apiTools]) => {
        if (!mounted) return
        setItem(detail || null)
        setToolList(apiTools || [])
        setError('')
      })
      .catch((err) => {
        if (!mounted) return
        setItem(null)
        setError(err.message || '案例不存在或已下架')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    const cleanup = loadPromptDetail()
    return cleanup
  }, [id])
  const copyPrompt = () => {
    Taro.setClipboardData({
      data: item.prompt,
      success: () => {
        copyPromptCase(item.id).catch(() => {})
        Taro.showToast({ title: '提示词已复制', icon: 'success' })
      }
    })
  }

  const sameCreation = async () => {
    if (!requireLogin(`/pages/prompt-detail/index?id=${item.id}`)) return
    try {
      const payload = await usePromptCase(item.id)
      goPage(`/pages/tool/index?id=${payload.toolKey || item.toolId}&prompt=${encodeURIComponent(payload.prompt || item.prompt)}`)
    } catch (err) {
      Taro.showToast({ title: err.message || '同款生成失败', icon: 'none' })
    }
  }

  if (!item) {
    return (
      <Shell title='提示词详情' showTab={false} backFallback='/pages/create-center/index' onRefresh={loadPromptDetail}>
        {loading ? (
          <PageLoading title='正在同步案例详情' description='正在读取完整提示词、封面和同款创作入口。' />
        ) : (
          <ErrorState title='案例不可访问' description={error || '案例不存在、已删除或暂未公开。'} onRetry={loadPromptDetail} />
        )}
      </Shell>
    )
  }

  return (
    <Shell title='提示词详情' showTab={false} backFallback='/pages/create-center/index' onRefresh={loadPromptDetail}>
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
        {(item.tags || []).map((tag) => <View key={tag} className='filter-chip active'>{tag}</View>)}
      </View>

      <View className='prompt-box'>{item.prompt}</View>

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
    </Shell>
  )
}
