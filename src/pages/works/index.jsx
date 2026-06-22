import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
import { isLoggedIn, requireLogin } from '../../utils/storage'
import { clearFailedWorksRemote, fetchToolCategories, fetchWorks } from '../../services/api'
import { goPage } from '../../utils/navigation'

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

function workBadgeText(item) {
  if (item?.lockedUntilPurchase) return '购买解锁'
  if (item?.isIntermediateOutput) return '中间结果'
  return statusLabel(item?.status)
}

function workBadgeIcon(item) {
  if (item?.lockedUntilPurchase) return 'lock'
  return statusIcon(item?.status)
}

function workBadgeClass(item) {
  if (item?.lockedUntilPurchase || ['failed', 'canceled'].includes(item?.status)) return 'status failed'
  return 'status'
}

export default function Works() {
  const loggedIn = isLoggedIn()
  const [category, setCategory] = useState('all')
  const [works, setWorks] = useState([])
  const [categories, setCategories] = useState([{ key: 'all', label: '全部' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadWorks = () => {
    let mounted = true
    setLoading(true)
    Promise.all([fetchWorks({ pageSize: 50 }), fetchToolCategories()])
      .then(([data, categoryList]) => {
        if (!mounted) return
        setWorks(data.list || [])
        if (categoryList?.length) setCategories(categoryList)
        setError('')
      })
      .catch(() => {
        if (mounted) setError('作品记录暂未同步，请稍后重试。')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    if (!loggedIn) return undefined
    const cleanup = loadWorks()
    return cleanup
  }, [loggedIn])

  const filtered = useMemo(() => {
    if (category === 'all') return works
    return works.filter((item) => item.category === category || item.toolKey === category)
  }, [category, works])

  const clearFailed = () => {
    Taro.showModal({
      title: '清除失败记录',
      content: '确认清除所有失败的生成记录吗？',
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: '清除中' })
          try {
            await clearFailedWorksRemote()
            setWorks((prev) => prev.filter((item) => item.status !== 'failed'))
            Taro.showToast({ title: '已清除', icon: 'success' })
          } catch (err) {
            Taro.showToast({ title: err?.message || '清除失败，请重试', icon: 'none' })
          } finally {
            Taro.hideLoading()
          }
        }
      }
    })
  }

  if (!loggedIn) {
    return (
      <Shell active='works' title='我的作品'>
        <EmptyState
          title='请先登录'
          description='登录后可查看生成记录、失败任务和已发布作品。'
          icon='lock'
          actionText='前往登录'
          onAction={() => requireLogin('/pages/works/index')}
        />
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

      {error && works.length ? <InlineNotice tone='danger'>{error}</InlineNotice> : null}

      {loading ? (
        <PageLoading title='正在同步作品记录' description='正在读取你的生成任务、作品状态和分类。' />
      ) : error && !works.length ? (
        <ErrorState title='作品记录加载失败' description={error} onRetry={loadWorks} />
      ) : filtered.length === 0 ? (
        <EmptyState title='暂无记录' description='完成一次生成后，作品会出现在这里。' icon='image' />
      ) : (
        <View className='case-grid'>
          {filtered.map((item) => (
            <View key={item.id} className='work-card' onClick={() => goPage(`/pages/work-detail/index?id=${item.id}`)}>
              <Image className='work-image' src={item.image || 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=900&q=80'} mode='aspectFill' />
              <View className='work-body'>
                <Text className='work-title'>{item.title}</Text>
                <View className='meta-row'>
                  <View className='meta-icon-text'>
                    <AppIcon name={item.category === 'video' ? 'video' : item.category === 'fusion' ? 'fusion' : 'image'} size={12} />
                    <Text>{item.toolName}</Text>
                  </View>
                  <View className={workBadgeClass(item)}>
                    <AppIcon name={workBadgeIcon(item)} size={11} />
                    <Text>{workBadgeText(item)}</Text>
                  </View>
                </View>
                {item.lockedUntilPurchase ? <Text className='tool-desc'>试运行作品，购买对应 Workflow 后可保存、分享和发布</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </Shell>
  )
}
