import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { copyPromptCase, fetchPromptCase, fetchTools, usePromptCase } from '../../services/api'
import { requireLogin } from '../../utils/storage'

export default function PromptDetail() {
  const { id } = getCurrentInstance().router.params
  const [item, setItem] = useState(null)
  const [toolList, setToolList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const tool = toolList.find((entry) => entry.id === item?.toolId)

  useEffect(() => {
    let mounted = true
    Promise.all([fetchPromptCase(id), fetchTools()])
      .then(([detail, apiTools]) => {
        if (!mounted) return
        if (detail) setItem(detail)
        setToolList(apiTools || [])
        setError('')
      })
      .catch((err) => {
        if (mounted) setError(err.message || '案例不存在或已下架')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
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
      Taro.navigateTo({ url: `/pages/tool/index?id=${payload.toolKey || item.toolId}&prompt=${encodeURIComponent(payload.prompt || item.prompt)}` })
    } catch (err) {
      Taro.showToast({ title: err.message || '同款生成失败', icon: 'none' })
    }
  }

  if (!item) {
    return (
      <Shell title='提示词详情' showTab={false}>
        <View className='empty'>{loading ? '正在同步案例' : error || '案例不存在'}</View>
        <View className='ghost-button glass-button block-gap' onClick={() => Taro.navigateBack()}>
          <AppIcon name='back' size={16} />
          <Text>返回</Text>
        </View>
      </Shell>
    )
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
      <View className='ghost-button glass-button block-gap' onClick={() => Taro.navigateBack()}>
        <AppIcon name='back' size={16} />
        <Text>返回</Text>
      </View>
    </Shell>
  )
}
