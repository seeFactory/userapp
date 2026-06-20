import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, PageLoading } from '../../components/PageState'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { fetchPromptCases, fetchToolCategories, fetchTools } from '../../services/api'

export default function CreateCenter() {
  const [category, setCategory] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [cases, setCases] = useState([])
  const [toolCategories, setToolCategories] = useState([{ key: 'all', label: '全部产品' }])
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { config, loading: configLoading } = useAppConfig()
  const generationEnabled = isFeatureEnabled(config, 'generation')

  const loadCenter = () => {
    if (configLoading) {
      setLoading(true)
      return () => {}
    }
    if (!generationEnabled) {
      setCases([])
      setTools([])
      setLoading(false)
      setError('')
      return () => {}
    }
    let mounted = true
    setLoading(true)
    Promise.all([fetchPromptCases({ pageSize: 30 }), fetchToolCategories(), fetchTools()])
      .then(([caseData, categories, toolList]) => {
        if (!mounted) return
        setCases(caseData.list || [])
        if (categories?.length) setToolCategories(categories)
        setTools(toolList || [])
        setError('')
      })
      .catch(() => {
        if (mounted) setError('案例与提示词暂未同步，请稍后重试。')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    const cleanup = loadCenter()
    return cleanup
  }, [configLoading, generationEnabled])

  const filtered = useMemo(() => {
    const word = keyword.trim().toLowerCase()
    return cases.filter((item) => {
      const matchCategory = category === 'all' || item.category === category
      const title = item.title || ''
      const tags = item.tags || []
      const matchWord = !word || title.toLowerCase().includes(word) || tags.join('').toLowerCase().includes(word)
      return matchCategory && matchWord
    })
  }, [cases, category, keyword])

  const toolName = (id) => tools.find((tool) => tool.id === id)?.name || 'AI 工具'

  return (
    <Shell active='center' title='创作中心'>
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
          <Text className='section-kicker'>{loading ? '正在加载提示词' : '提示词案例'}</Text>
          <Text className='section-title'>案例与提示词</Text>
          </View>
        </View>
      </View>

      <View className='filter-row'>
        {toolCategories.map((item) => (
          <View
            key={item.key}
            className={category === item.key ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setCategory(item.key)}
          >
            {item.label}
          </View>
        ))}
      </View>

      <View className='search-box'>
        <Input
          className='search-input'
          value={keyword}
          placeholder='搜索提示词标题或关键词'
          placeholderClass='muted'
          onInput={(event) => setKeyword(event.detail.value)}
        />
        <View className='primary-button compact' onClick={() => Taro.showToast({ title: `找到 ${filtered.length} 个案例`, icon: 'none' })}>
          <AppIcon name='search' size={14} />
          <Text>搜索</Text>
        </View>
      </View>

      {!generationEnabled ? (
        <EmptyState title='创作中心已关闭' description='当前后台已关闭生成服务，案例与提示词入口暂不开放。' icon='center' />
      ) : loading ? (
        <PageLoading title='正在加载提示词案例' description='正在同步案例、工具分类和同款创作配置。' />
      ) : error ? (
        <ErrorState title='案例加载失败' description={error} onRetry={loadCenter} />
      ) : filtered.length === 0 ? (
        <EmptyState title='暂无匹配案例' description={keyword.trim() ? '换个关键词或分类再试试。' : '请在管理后台发布至少一个公开案例。'} icon='book' />
      ) : (
        <View className='case-grid'>
          {filtered.map((item) => (
            <View key={item.id} className='case-card' onClick={() => Taro.navigateTo({ url: `/pages/prompt-detail/index?id=${item.id}` })}>
              <Image className='case-image' src={item.image} mode='aspectFill' />
              <View className='case-body'>
                <Text className='case-title'>{item.title}</Text>
                <View className='meta-row'>
                  <Text>{item.date}</Text>
                  <View className='meta-icon-text'>
                    <AppIcon name={tools.find((tool) => tool.id === item.toolId)?.icon} size={12} />
                    <Text>{toolName(item.toolId)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Shell>
  )
}
