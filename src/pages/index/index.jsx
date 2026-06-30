import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import ModelLogo from '../../components/ModelLogo'
import { EmptyState, ErrorState, PageLoading } from '../../components/PageState'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { fetchTools } from '../../services/api'
import { goPage, goTab } from '../../utils/navigation'
import { isLoggedIn } from '../../utils/storage'

const HOME_TOOL_TABS = [
  { key: 'recommended', label: '推荐' },
  { key: 'ai_image', label: 'AI生图' },
  { key: 'ai_video', label: 'AI生视频' }
]

function textOf(value) {
  return String(value || '').toLowerCase()
}

function arrayOf(value) {
  return Array.isArray(value) ? value : value ? [value] : []
}

function outputTypesOf(tool) {
  const explicit = arrayOf(tool.outputTypes)
  const modeTypes = arrayOf(tool.modes).map((mode) => mode.outputType).filter(Boolean)
  const category = textOf(tool.category)
  const fallback = category.includes('video')
    ? ['video']
    : category.includes('image') || category.includes('fusion') || category.includes('portrait')
      ? ['image']
      : []
  return Array.from(new Set(explicit.concat(modeTypes, fallback).map((item) => textOf(item))))
}

function tabsOf(tool) {
  const configured = arrayOf(tool.homeTabs)
  const tabs = new Set(configured)
  const outputTypes = outputTypesOf(tool)
  if (tool.homeRecommended || configured.includes('recommended')) tabs.add('recommended')
  if (configured.includes('ai_image') || outputTypes.includes('image')) tabs.add('ai_image')
  if (configured.includes('ai_video') || outputTypes.includes('video')) tabs.add('ai_video')
  return tabs
}

function toolSearchText(tool) {
  return [
    tool.name,
    tool.desc,
    tool.label,
    tool.category,
    tool.icon,
    ...arrayOf(tool.searchKeywords),
    ...arrayOf(tool.homeTabs),
    ...arrayOf(tool.modes).flatMap((mode) => [mode.label, mode.name, mode.description, mode.outputType])
  ].map(textOf).join(' ')
}

function defaultModelKeyOf(tool) {
  const options = tool?.options || {}
  return String(
    tool?.defaultModelKey ||
    options.defaultModelKey ||
    arrayOf(options.models)[0] ||
    arrayOf(tool?.modes).map((mode) => mode?.defaultModelKey || arrayOf(mode?.allowedModels)[0] || arrayOf(mode?.options?.models)[0]).find(Boolean) ||
    ''
  )
}

function modelLogoOf(tool) {
  const key = defaultModelKeyOf(tool)
  const options = tool?.options || {}
  const meta = key ? (options.modelMeta?.[key] || tool?.modelMeta?.[key]) : null
  return tool?.logoUrl || tool?.defaultModelLogoUrl || meta?.logoUrl || (key ? (options.modelLogos?.[key] || tool?.modelLogos?.[key]) : '') || ''
}

export default function Index() {
  const loggedIn = isLoggedIn()
  const { config, loading: configLoading } = useAppConfig()
  const generationEnabled = isFeatureEnabled(config, 'generation')
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeToolTab, setActiveToolTab] = useState('recommended')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')

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
      Taro.showToast({ title: '创作功能暂未开放', icon: 'none' })
      return
    }
    goPage(`/pages/tool/index?id=${tool.id}`)
  }

  const startFirstTool = () => {
    if (!generationEnabled) {
      Taro.showToast({ title: '创作功能暂未开放', icon: 'none' })
      return
    }
    goPage(`/pages/tool/index?id=${visibleTools[0]?.id || tools[0]?.id || 'factory-painter'}`)
  }

  const groupedTools = useMemo(() => {
    const groups = {
      recommended: [],
      ai_image: [],
      ai_video: []
    }
    tools.forEach((tool) => {
      const tabs = tabsOf(tool)
      HOME_TOOL_TABS.forEach((tab) => {
        if (tabs.has(tab.key)) groups[tab.key].push(tool)
      })
    })
    Object.keys(groups).forEach((key) => {
      groups[key] = groups[key].slice().sort((a, b) => Number(b.homeSort || 0) - Number(a.homeSort || 0))
    })
    return groups
  }, [tools])

  const visibleTools = groupedTools[activeToolTab] || []
  const searchResults = useMemo(() => {
    const keyword = textOf(searchKeyword).trim()
    const sorted = tools.slice().sort((a, b) => Number(b.homeSort || 0) - Number(a.homeSort || 0))
    if (!keyword) return groupedTools.recommended
    return sorted.filter((tool) => toolSearchText(tool).includes(keyword))
  }, [groupedTools, searchKeyword, tools])

  return (
    <Shell active='home' title='首页' onRefresh={loadTools}>
      <View className='hero'>
        <View className='hero-logo-line'>
          <View className='hero-orbit-icon'>
            <View className='hero-brand-image' style={{ backgroundImage: 'url(/static/logo-hero.png)' }} />
          </View>
          <Text className='hero-kicker'>seeFactory AI 创作平台</Text>
        </View>
        <Text className='hero-title'>Hi，{loggedIn ? '创作者' : '游客'}</Text>
        <Text className='hero-subtitle'>从图片生成、视频创作到品牌漫画，用 AI 快速完成多场景内容制作。</Text>
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
          <Text className='section-kicker'>创作入口</Text>
          <Text className='section-title'>创作工具</Text>
        </View>
        <View className='home-tool-actions'>
          <View className='home-tool-tabs'>
            {HOME_TOOL_TABS.map((tab) => (
              <View
                key={tab.key}
                className={activeToolTab === tab.key ? 'home-tool-tab active' : 'home-tool-tab'}
                onClick={() => setActiveToolTab(tab.key)}
              >
                <Text>{tab.label}</Text>
              </View>
            ))}
          </View>
          <View className='icon-button home-search-button' onClick={() => setSearchOpen(true)}>
            <AppIcon name='search' size={17} />
          </View>
        </View>
      </View>

      {!generationEnabled ? (
        <EmptyState title='创作功能已关闭' description='生成服务暂未开放，你仍可查看作品、联系客服和管理账号。' icon='wand' />
      ) : loading ? (
        <PageLoading title='正在同步工具配置' description='正在同步可用创作工具。' />
      ) : error ? (
        <ErrorState title='工具配置加载失败' description={error} onRetry={loadTools} />
      ) : visibleTools.length ? (
        <View className='tool-grid'>
          {visibleTools.map((tool) => (
            <View
              key={tool.id}
              className={tool.featured ? 'tool-card featured' : 'tool-card'}
              onClick={() => openTool(tool)}
            >
              <Text className='tool-chip'>{tool.label}</Text>
              <ModelLogo src={modelLogoOf(tool)} icon={tool.icon} size={tool.featured ? 46 : 40} className='tool-card-model-logo' />
              <Text className='tool-name'>{tool.name}</Text>
              <Text className='tool-desc'>{tool.desc}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title='该分类暂无工具' description='请切换其他分类，或稍后查看新上线工具。' icon='wand' />
      )}

      {searchOpen ? (
        <View className='modal-mask search-modal-mask' onClick={() => setSearchOpen(false)}>
          <View className='search-panel' onClick={(event) => event.stopPropagation()}>
            <View className='search-panel-head'>
              <View className='text-input search-input'>
                <AppIcon name='search' size={16} />
                <Input
                  value={searchKeyword}
                  placeholder='搜索工具、模式或关键词'
                  placeholderClass='muted'
                  onInput={(event) => setSearchKeyword(event.detail.value)}
                />
                {searchKeyword ? (
                  <View className='icon-button tiny-icon-button' onClick={() => setSearchKeyword('')}>
                    <AppIcon name='close' size={13} />
                  </View>
                ) : null}
              </View>
              <View className='icon-button' onClick={() => setSearchOpen(false)}>
                <AppIcon name='close' size={15} />
              </View>
            </View>
            {!searchKeyword ? (
              <View className='search-hot-row'>
                {['写真', 'Logo', '首尾帧', '动作克隆'].map((item) => (
                  <View key={item} className='filter-chip' onClick={() => setSearchKeyword(item)}>
                    <Text>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {searchResults.length ? (
              <View className='search-result-list'>
                {searchResults.map((tool) => {
                  const tabs = tabsOf(tool)
                  const label = tabs.has('ai_video') ? 'AI生视频' : tabs.has('ai_image') ? 'AI生图' : '推荐'
                  return (
                    <View key={tool.id} className='search-result-card' onClick={() => {
                      setSearchOpen(false)
                      openTool(tool)
                    }}>
                      <ModelLogo src={modelLogoOf(tool)} icon={tool.icon} size={34} className='compact-tool-icon' />
                      <View className='search-result-copy'>
                        <Text className='tool-name'>{tool.name}</Text>
                        <Text className='tool-desc'>{tool.desc}</Text>
                      </View>
                      <Text className='tool-chip'>{label}</Text>
                    </View>
                  )
                })}
              </View>
            ) : (
              <EmptyState title='没有找到工具' description='换一个关键词试试。' icon='search' />
            )}
          </View>
        </View>
      ) : null}
    </Shell>
  )
}
