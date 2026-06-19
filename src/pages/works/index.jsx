import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { toolCategories } from '../../data/mock'
import { clearFailedWorks, getWorks, isLoggedIn, requireLogin } from '../../utils/storage'
import { clearFailedWorksRemote, fetchWorks } from '../../services/api'

function statusLabel(status) {
  const map = {
    queued: '排队中',
    processing: '生成中',
    success: '成功',
    failed: '失败',
    canceled: '已取消'
  }
  return map[status] || '成功'
}

function statusIcon(status) {
  if (status === 'failed' || status === 'canceled') return 'alert'
  if (status === 'queued' || status === 'processing') return 'refresh'
  return 'badge'
}

export default function Works() {
  const loggedIn = isLoggedIn()
  const [category, setCategory] = useState('all')
  const [works, setWorks] = useState(loggedIn ? getWorks() : [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!loggedIn) return undefined
    let mounted = true
    setLoading(true)
    fetchWorks({ pageSize: 50 })
      .then((data) => {
        if (mounted && data.list?.length) setWorks(data.list)
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [loggedIn])

  const categories = toolCategories.filter((item) => ['all', 'image', 'quick', 'video', 'image-video', 'text-video', 'fusion', 'comic'].includes(item.key))

  const filtered = useMemo(() => {
    if (category === 'all') return works
    return works.filter((item) => item.category === category)
  }, [category, works])

  const clearFailed = () => {
    Taro.showModal({
      title: '清除失败记录',
      content: '确认清除所有失败的生成记录吗？',
      success: (res) => {
        if (res.confirm) {
          clearFailedWorksRemote().catch(() => {})
          setWorks(clearFailedWorks())
          Taro.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  }

  if (!loggedIn) {
    return (
      <Shell active='works' title='我的作品'>
        <View className='empty' onClick={() => requireLogin('/pages/works/index')}>登录后查看你的生成记录</View>
      </Shell>
    )
  }

  return (
    <Shell active='works' title='我的作品'>
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
          <Text className='section-kicker'>{loading ? '同步作品中' : '生成记录'}</Text>
          <Text className='section-title'>使用记录</Text>
          </View>
        </View>
        <View className='danger-button compact transparent-button' onClick={clearFailed}>
          <AppIcon name='delete' size={14} />
          <Text>清除失败记录</Text>
        </View>
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

      {filtered.length === 0 ? (
        <View className='empty'>暂无记录</View>
      ) : (
        <View className='case-grid'>
          {filtered.map((item) => (
            <View key={item.id} className='work-card' onClick={() => Taro.navigateTo({ url: `/pages/work-detail/index?id=${item.id}` })}>
              <Image className='work-image' src={item.image || 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=900&q=80'} mode='aspectFill' />
              <View className='work-body'>
                <Text className='work-title'>{item.title}</Text>
                <View className='meta-row'>
                  <View className='meta-icon-text'>
                    <AppIcon name={item.category === 'video' ? 'video' : item.category === 'fusion' ? 'fusion' : 'image'} size={12} />
                    <Text>{item.toolName}</Text>
                  </View>
                  <View className={['failed', 'canceled'].includes(item.status) ? 'status failed' : 'status'}>
                    <AppIcon name={statusIcon(item.status)} size={11} />
                    <Text>{statusLabel(item.status)}</Text>
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
