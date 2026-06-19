import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { galleryWorks, toolCategories } from '../../data/mock'
import { fetchGalleryWorks } from '../../services/api'

export default function Gallery() {
  const [category, setCategory] = useState('all')
  const [works, setWorks] = useState(galleryWorks)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchGalleryWorks({ pageSize: 24 })
      .then((data) => {
        if (!mounted) return
        if (data.list?.length) setWorks(data.list)
        setError('')
      })
      .catch(() => {
        if (!mounted) return
        setError('当前展示本地精选，后端连接后自动同步。')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  const categories = toolCategories.filter((item) => ['all', 'image', 'video', 'fusion', 'comic', 'quick'].includes(item.key))

  const filtered = useMemo(() => {
    if (category === 'all') return works
    return works.filter((item) => item.category === category || item.toolKey === category)
  }, [category, works])

  const featured = filtered[0]

  return (
    <Shell active='gallery' title='作品广场'>
      <View className='gallery-hero'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={46} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>Public gallery</Text>
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

      {error && <View className='inline-note'>{error}</View>}

      {loading ? (
        <View className='loading-state'>
          <View className='loading-ring' />
          <Text>正在加载广场作品</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View className='empty'>暂无公开作品</View>
      ) : (
        <>
          {featured && (
            <View className='gallery-featured-card' onClick={() => Taro.navigateTo({ url: `/pages/work-detail/index?id=${featured.id}` })}>
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

          <View className='gallery-grid'>
            {filtered.map((item, index) => (
              <View
                key={item.id}
                className={index % 3 === 1 ? 'gallery-card tall' : 'gallery-card'}
                onClick={() => Taro.navigateTo({ url: `/pages/work-detail/index?id=${item.id}` })}
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
        </>
      )}
    </Shell>
  )
}
