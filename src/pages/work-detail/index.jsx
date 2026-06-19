import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import {
  deleteWorkRemote,
  fetchGenerationTask,
  fetchWork,
  getDownloadUrl,
  publishGalleryWork,
  retryGenerationTask,
  unpublishGalleryWork
} from '../../services/api'

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

function mergeTask(work, task) {
  return {
    ...work,
    status: task.status,
    resultUrls: task.resultUrls || work.resultUrls || [],
    coverUrl: task.coverUrl || work.coverUrl,
    image: task.coverUrl || task.resultUrls?.[0] || work.image,
    failureReason: task.failureReason || work.failureReason,
    failReason: task.failureReason || work.failReason
  }
}

export default function WorkDetail() {
  const { id } = getCurrentInstance().router.params
  const [work, setWork] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    fetchWork(id)
      .then((data) => {
        if (!mounted) return
        setWork(data || null)
        setError('')
      })
      .catch((err) => {
        if (mounted) setError(err.message || '作品不存在或暂不可访问')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [id])

  useEffect(() => {
    if (!work?.generationTaskId || !['queued', 'processing'].includes(work.status)) return undefined
    const timer = setInterval(async () => {
      try {
        const task = await fetchGenerationTask(work.generationTaskId)
        setWork((prev) => mergeTask(prev, task))
        if (!['queued', 'processing'].includes(task.status)) {
          fetchWork(id).then((data) => data && setWork(data)).catch(() => {})
        }
      } catch (error) {
        clearInterval(timer)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [id, work?.generationTaskId, work?.status])

  const remove = () => {
    Taro.showModal({
      title: '删除作品',
      content: '确认删除这条作品记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await deleteWorkRemote(work.id)
          } catch (error) {
          }
          Taro.showToast({ title: '已删除', icon: 'success' })
          Taro.redirectTo({ url: '/pages/works/index' })
        }
      }
    })
  }

  const retry = async () => {
    if (work.generationTaskId && work.status === 'failed') {
      try {
        const result = await retryGenerationTask(work.generationTaskId)
        Taro.showToast({ title: '已重新提交', icon: 'success' })
        Taro.redirectTo({ url: `/pages/work-detail/index?id=${result.work.id}` })
        return
      } catch (error) {
        Taro.showToast({ title: error.message || '重试失败', icon: 'none' })
      }
    }
    Taro.navigateTo({ url: `/pages/tool/index?id=${work.toolKey || 'factory-painter'}&prompt=${encodeURIComponent(work.prompt || '')}` })
  }

  const saveWork = async () => {
    try {
      const data = await getDownloadUrl(work.id)
      const url = data?.url || work.image
      if (process.env.TARO_ENV === 'h5') {
        Taro.showToast({ title: '已获取下载地址', icon: 'success' })
        return
      }
      Taro.saveImageToPhotosAlbum({
        filePath: url,
        success: () => Taro.showToast({ title: '已保存', icon: 'success' }),
        fail: () => Taro.showModal({ title: '保存失败', content: '请确认已允许保存到相册。', showCancel: false })
      })
    } catch (error) {
      Taro.showToast({ title: '已使用本地预览保存', icon: 'none' })
    }
  }

  const publish = async () => {
    try {
      const next = await publishGalleryWork(work.id)
      setWork((prev) => ({ ...prev, ...next, galleryVisible: true, galleryStatus: 'published' }))
      Taro.showToast({ title: '已发布到广场', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error.message || '发布失败', icon: 'none' })
    }
  }

  const unpublish = async () => {
    try {
      const next = await unpublishGalleryWork(work.id)
      setWork((prev) => ({ ...prev, ...next, galleryVisible: false, galleryStatus: 'private' }))
      Taro.showToast({ title: '已取消发布', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error.message || '取消发布失败', icon: 'none' })
    }
  }

  if (!work) {
    return (
      <Shell title='作品详情' showTab={false}>
        <View className='empty'>{loading ? '正在同步作品' : error || '作品不存在'}</View>
        <View className='ghost-button glass-button block-gap' onClick={() => Taro.navigateBack()}>
          <AppIcon name='back' size={16} />
          <Text>返回</Text>
        </View>
      </Shell>
    )
  }

  const image = work.image || work.coverUrl || work.resultUrls?.[0] || ''
  const pending = ['queued', 'processing'].includes(work?.status)
  const failed = ['failed', 'canceled'].includes(work?.status)

  return (
    <Shell title='作品详情' showTab={false}>
      <Image className='detail-image' src={image} mode='aspectFill' />
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
          <Text className='section-kicker'>{loading ? '同步作品中' : work.toolName}</Text>
          <Text className='section-title'>{work.title}</Text>
          </View>
        </View>
        <View className={failed ? 'status failed' : 'status'}>
          <AppIcon name={statusIcon(work.status)} size={12} />
          <Text>{statusLabel(work.status)}</Text>
        </View>
      </View>

      {pending && (
        <View className='panel compact-panel'>
          <View className='loading-ring' />
          <Text className='tool-desc'>任务正在生成中，页面会自动刷新状态。</Text>
        </View>
      )}

      <View className='prompt-box'>
        <Text>{work.prompt}</Text>
        {(work.failureReason || work.failReason) && <Text className='tool-desc'>失败原因：{work.failureReason || work.failReason}</Text>}
      </View>

      <View className='hero-actions'>
        <View className={work.status === 'success' ? 'primary-button' : 'primary-button disabled'} onClick={work.status === 'success' ? saveWork : undefined}>
          <AppIcon name='download' size={16} />
          <Text>保存</Text>
        </View>
        <View className='ghost-button glass-button' onClick={() => Taro.showShareMenu({})}>
          <AppIcon name='share' size={16} />
          <Text>分享</Text>
        </View>
      </View>
      <View className='hero-actions'>
        <View className={work.status === 'success' ? 'primary-button' : 'primary-button disabled'} onClick={work.status === 'success' ? publish : undefined}>
          <AppIcon name='gallery' size={16} />
          <Text>发布广场</Text>
        </View>
        <View className='ghost-button glass-button' onClick={unpublish}>
          <AppIcon name='close' size={16} />
          <Text>取消发布</Text>
        </View>
      </View>
      <View className='hero-actions'>
        <View className='ghost-button glass-button' onClick={retry}>
          <AppIcon name='refresh' size={16} />
          <Text>重新生成</Text>
        </View>
        <View className='danger-button transparent-button' onClick={remove}>
          <AppIcon name='delete' size={16} />
          <Text>删除</Text>
        </View>
      </View>
    </Shell>
  )
}
