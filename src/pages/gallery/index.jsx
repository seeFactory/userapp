import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { fetchGalleryWorks, fetchToolCategories } from '../../services/api'
import { goPage } from '../../utils/navigation'

export default function Gallery() {
  const [category, setCategory] = useState('all')
  const [works, setWorks] = useState([])
  const [categories, setCategories] = useState([{ key: 'all', label: '全部' }])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { config, loading: configLoading } = useAppConfig()
  const galleryEnabled = isFeatureEnabled(config, 'gallery')

  const loadGallery = () => {
    if (configLoading) {
      setLoading(true)
      return () => {}
    }
    if (!galleryEnabled) {
      setWorks([])
      setLoading(false)
      setError('')
      return () => {}
    }
    let mounted = true
    setLoading(true)
    Promise.all([fetchGalleryWorks({ pageSize: 24 }), fetchToolCategories()])
      .then(([data, categoryList]) => {
        if (!mounted) return
        setWorks(data.list || [])
        if (categoryList?.length) setCategories(categoryList)
        setError('')
      })
      .catch(() => {
        if (!mounted) return
        setError('广场作品暂未同步，请稍后刷新。')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    const cleanup = loadGallery()
    return cleanup
  }, [configLoading, galleryEnabled])

  const filtered = useMemo(() => {
    if (category === 'all') return works
    return works.filter((item) => item.category === category || item.toolKey === category)
  }, [category, works])

  const featured = filtered[0]
  const gridWorks = featured ? filtered.slice(1) : filtered

  return (
    <Shell active='gallery' title='作品广场'>
      <View className='gallery-hero'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={46} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>公开广场</Text>
            <Text className='section-title'>作品广场</Text>
          </View>
        </View>
        <Text className='gallery-hero-copy'>发现公开发布的 AI 视觉作品，查看完整灵感并一键同款创作。</Text>
      </View>

      <View className='filter-row'>
        {categories.map((item) => (
          <View
            key={item.key}
            className={category === item.key ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setCategory(item.key)}
          >
            {item.key === 'all' ? '全部' : item.label}
          </View>
        ))}
      </View>

      {error && works.length ? <InlineNotice tone='danger'>{error}</InlineNotice> : null}

      {!galleryEnabled ? (
        <EmptyState title='作品广场已关闭' description='当前后台已关闭公开广场，个人作品仍可在作品页查看。' icon='gallery' />
      ) : loading ? (
        <PageLoading title='正在加载广场作品' description='正在同步公开作品、精选内容和分类。' />
      ) : error && !works.length ? (
        <ErrorState title='广场加载失败' description={error} onRetry={loadGallery} />
      ) : filtered.length === 0 ? (
        <EmptyState title='暂无公开作品' description='当前筛选下还没有公开发布的作品。' icon='gallery' />
      ) : (
        <>
          {featured && (
            <View className='gallery-featured-card' onClick={() => goPage(`/pages/work-detail/index?id=${featured.id}&source=gallery`)}>
              <Image className='gallery-featured-image' src={featured.image} mode='aspectFill' />
              <View className='gallery-featured-mask' />
              <View className='gallery-featured-body'>
                <Text className='tool-chip'>精选</Text>
                <Text className='gallery-featured-title'>{featured.title}</Text>
                <View className='gallery-meta'>
                  <Text>{featured.author?.nickname || 'seeFactory 用户'}</Text>
                  <Text>{featured.viewCount || 0} 次浏览</Text>
                </View>
              </View>
            </View>
          )}

          {gridWorks.length ? (
          <View className='gallery-grid'>
            {gridWorks.map((item) => (
              <View
                key={item.id}
                className='gallery-card'
                onClick={() => goPage(`/pages/work-detail/index?id=${item.id}&source=gallery`)}
              >
                <Image className='gallery-image' src={item.image} mode='aspectFill' />
                <View className='gallery-card-body'>
                  <Text className='case-title'>{item.title}</Text>
                  <View className='gallery-meta'>
                    <View className='meta-icon-text'>
                      <AppIcon name={item.category === 'video' ? 'video' : 'image'} size={12} />
                      <Text>{item.author?.nickname || 'seeFactory 用户'}</Text>
                    </View>
                    <Text>{item.likeCount || 0} 喜欢</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
          ) : null}
        </>
      )}
    </Shell>
  )
}
