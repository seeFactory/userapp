import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Image, Video } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { ErrorState, PageLoading } from '../../components/PageState'
import {
  cancelGenerationTask,
  deleteWorkRemote,
  fetchGenerationTask,
  fetchGalleryWork,
  fetchWork,
  getDownloadUrl,
  publishGalleryWork,
  retryGenerationTask,
  unpublishGalleryWork
} from '../../services/api'
import { isLoggedIn } from '../../utils/storage'

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

function isActiveStatus(status) {
  return ['queued', 'processing'].includes(status)
}

function taskStatusCopy(status) {
  if (status === 'queued') return '任务已进入队列，正在等待 seeFactory 生成工厂领取。'
  if (status === 'processing') return '生成服务正在处理素材和提示词，完成后会自动刷新结果。'
  if (status === 'canceled') return '任务已取消，本次扣点会按后端规则回退。'
  if (status === 'failed') return '任务生成失败，可以查看原因后重新生成。'
  return '任务已完成，可以保存、分享或发布到广场。'
}

function mergeTask(work, task) {
  if (!work) return work
  return {
    ...work,
    status: task.status,
    resultUrls: task.resultUrls || work.resultUrls || [],
    coverUrl: task.coverUrl || work.coverUrl,
    image: task.coverUrl || task.resultUrls?.[0] || work.image,
    failureReason: task.failureReason || work.failureReason,
    failReason: task.failureReason || work.failReason,
    providerAttempts: task.providerAttempts || work.providerAttempts,
    finishedAt: task.finishedAt || work.finishedAt
  }
}

function inferMediaKind(work, url = '') {
  const text = `${work?.category || ''} ${work?.type || ''} ${work?.toolKey || ''} ${url}`.toLowerCase()
  if (/\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(text) || text.includes('video')) return 'video'
  if (/\.(jpg|jpeg|png|webp|gif|bmp)(\?|#|$)/i.test(text) || text.includes('image')) return 'image'
  return 'file'
}

function openH5Download(url, title) {
  if (typeof document === 'undefined') {
    if (typeof window !== 'undefined') window.open(url, '_blank')
    return
  }
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.download = `${title || 'seefactory-work'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function downloadTempFile(url) {
  return new Promise((resolve, reject) => {
    Taro.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
          resolve(res.tempFilePath)
          return
        }
        reject(new Error('文件下载失败，请稍后重试'))
      },
      fail: () => reject(new Error('文件下载失败，请检查网络或下载域名配置'))
    })
  })
}

function saveFileToAlbum(filePath, mediaKind) {
  return new Promise((resolve, reject) => {
    const api = mediaKind === 'video' ? Taro.saveVideoToPhotosAlbum : Taro.saveImageToPhotosAlbum
    if (!api) {
      reject(new Error(mediaKind === 'video' ? '当前平台暂不支持保存视频' : '当前平台暂不支持保存图片'))
      return
    }
    api({
      filePath,
      success: resolve,
      fail: () => reject(new Error('请确认已允许保存到相册，或稍后重试'))
    })
  })
}

export default function WorkDetail() {
  const { id, source } = getCurrentInstance().router?.params || {}
  const [work, setWork] = useState(null)
  const [detailMode, setDetailMode] = useState(source === 'gallery' ? 'gallery' : 'owner')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshingTask, setRefreshingTask] = useState(false)
  const [cancelingTask, setCancelingTask] = useState(false)

  const loadWorkDetail = () => {
    let mounted = true
    setLoading(true)
    const loadDetail = source === 'gallery' || !isLoggedIn()
      ? fetchGalleryWork(id).then((data) => ({ data, mode: 'gallery' }))
      : fetchWork(id)
        .then((data) => ({ data, mode: 'owner' }))
        .catch(() => fetchGalleryWork(id).then((data) => ({ data, mode: 'gallery' })))
    loadDetail
      .then(({ data, mode }) => {
        if (!mounted) return
        setDetailMode(mode)
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
  }

  useEffect(() => {
    const cleanup = loadWorkDetail()
    return cleanup
  }, [id, source])

  useEffect(() => {
    if (!work?.generationTaskId || !isActiveStatus(work.status)) return undefined
    const timer = setInterval(async () => {
      try {
        const task = await fetchGenerationTask(work.generationTaskId)
        setWork((prev) => mergeTask(prev, task))
        if (!isActiveStatus(task.status)) {
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

  const refreshTaskStatus = async (silent = false) => {
    if (!work.generationTaskId) {
      if (!silent) Taro.showToast({ title: '暂无任务状态可刷新', icon: 'none' })
      return
    }
    if (!silent) Taro.showLoading({ title: '刷新任务' })
    setRefreshingTask(true)
    try {
      const task = await fetchGenerationTask(work.generationTaskId)
      setWork((prev) => mergeTask(prev, task))
      if (!isActiveStatus(task.status) && detailMode !== 'gallery') {
        const latest = await fetchWork(id)
        if (latest) setWork(latest)
      }
      if (!silent) Taro.showToast({ title: `当前状态：${statusLabel(task.status)}`, icon: 'none' })
    } catch (error) {
      if (!silent) Taro.showToast({ title: error.message || '任务刷新失败', icon: 'none' })
    } finally {
      if (!silent) Taro.hideLoading()
      setRefreshingTask(false)
    }
  }

  const cancelTask = () => {
    if (!work.generationTaskId || !isActiveStatus(work.status)) return
    Taro.showModal({
      title: '取消生成任务',
      content: '确认取消当前生成任务吗？取消后本次扣点会按后端规则回退，已进入供应商处理的任务可能仍需要等待状态同步。',
      success: async (res) => {
        if (!res.confirm) return
        setCancelingTask(true)
        Taro.showLoading({ title: '取消任务' })
        try {
          const task = await cancelGenerationTask(work.generationTaskId)
          setWork((prev) => mergeTask(prev, task))
          const latest = await fetchWork(id).catch(() => null)
          if (latest) setWork(latest)
          Taro.showToast({ title: '任务已取消', icon: 'success' })
        } catch (error) {
          Taro.showToast({ title: error.message || '取消失败', icon: 'none' })
          refreshTaskStatus(true)
        } finally {
          Taro.hideLoading()
          setCancelingTask(false)
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
    if (detailMode === 'gallery' && work.downloadEnabled === false) {
      Taro.showToast({ title: '该作品暂不支持保存', icon: 'none' })
      return
    }
    let url = ''
    Taro.showLoading({ title: process.env.TARO_ENV === 'h5' ? '准备下载' : '保存中' })
    try {
      const data = await getDownloadUrl(work.id)
      url = data?.url || work.image
      if (!url) throw new Error('下载地址为空')
      const mediaKind = inferMediaKind(work, url)
      if (process.env.TARO_ENV === 'h5') {
        openH5Download(url, work.title)
        Taro.hideLoading()
        Taro.showToast({ title: '已打开下载地址', icon: 'success' })
        return
      }

      if (!['image', 'video'].includes(mediaKind)) {
        Taro.hideLoading()
        Taro.setClipboardData({
          data: url,
          success: () => Taro.showToast({ title: '下载地址已复制', icon: 'success' })
        })
        return
      }

      const filePath = /^https?:\/\//i.test(url) ? await downloadTempFile(url) : url
      await saveFileToAlbum(filePath, mediaKind)
      Taro.hideLoading()
      Taro.showToast({ title: mediaKind === 'video' ? '视频已保存' : '图片已保存', icon: 'success' })
    } catch (error) {
      Taro.hideLoading()
      Taro.showModal({
        title: '保存失败',
        content: error.message || '请确认已允许保存到相册，或稍后重试。',
        showCancel: false
      })
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
        {loading ? (
          <PageLoading title='正在同步作品' description='正在读取作品结果、任务状态和保存权限。' />
        ) : (
          <ErrorState title='作品不可访问' description={error || '作品不存在、已删除或暂未公开。'} onRetry={loadWorkDetail} />
        )}
        <View className='ghost-button glass-button block-gap' onClick={() => Taro.navigateBack()}>
          <AppIcon name='back' size={16} />
          <Text>返回</Text>
        </View>
      </Shell>
    )
  }

  const media = work.resultUrls?.[0] || work.image || work.coverUrl || ''
  const preview = work.coverUrl || work.image || media
  const mediaKind = inferMediaKind(work, media || preview)
  const pending = isActiveStatus(work?.status)
  const failed = ['failed', 'canceled'].includes(work?.status)
  const canSave = work.status === 'success' && (detailMode !== 'gallery' || work.downloadEnabled !== false)
  const isGalleryDetail = detailMode === 'gallery'

  return (
    <Shell title='作品详情' showTab={false}>
      {media && mediaKind === 'video' ? (
        <Video className='detail-image' src={media} poster={preview} controls />
      ) : (
        <Image className='detail-image' src={preview} mode='aspectFill' />
      )}
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
        <View className='panel task-state-panel'>
          <View className='task-state-main'>
            <View className='loading-ring' />
            <View className='task-state-copy'>
              <Text className='tool-desc'>{taskStatusCopy(work.status)}</Text>
              <Text className='task-state-note'>{refreshingTask ? '正在同步最新状态...' : '每 3 秒自动刷新一次，也可以手动刷新。'}</Text>
            </View>
          </View>
          {!isGalleryDetail && (
            <View className='task-actions'>
              <View className={refreshingTask ? 'ghost-button glass-button disabled' : 'ghost-button glass-button'} onClick={() => refreshTaskStatus(false)}>
                <AppIcon name='refresh' size={14} />
                <Text>{refreshingTask ? '刷新中' : '立即刷新'}</Text>
              </View>
              <View className={cancelingTask ? 'danger-button transparent-button disabled' : 'danger-button transparent-button'} onClick={cancelTask}>
                <AppIcon name='close' size={14} />
                <Text>{cancelingTask ? '取消中' : '取消任务'}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View className='prompt-box'>
        <Text>{work.prompt}</Text>
        {(work.failureReason || work.failReason) && <Text className='tool-desc'>失败原因：{work.failureReason || work.failReason}</Text>}
      </View>

      <View className='hero-actions'>
        <View className={canSave ? 'primary-button' : 'primary-button disabled'} onClick={canSave ? saveWork : undefined}>
          <AppIcon name='download' size={16} />
          <Text>{work.downloadEnabled === false && isGalleryDetail ? '不可保存' : '保存'}</Text>
        </View>
        <View className='ghost-button glass-button' onClick={() => Taro.showShareMenu({})}>
          <AppIcon name='share' size={16} />
          <Text>分享</Text>
        </View>
      </View>
      {isGalleryDetail ? (
        <View className='hero-actions'>
          <View className='primary-button' onClick={retry}>
            <AppIcon name='wand' size={16} />
            <Text>同款创作</Text>
          </View>
          <View className='ghost-button glass-button' onClick={() => Taro.navigateBack()}>
            <AppIcon name='back' size={16} />
            <Text>返回广场</Text>
          </View>
        </View>
      ) : (
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
      )}
      <View className='hero-actions'>
        <View className='ghost-button glass-button' onClick={retry}>
          <AppIcon name='refresh' size={16} />
          <Text>{isGalleryDetail ? '带入提示词' : '重新生成'}</Text>
        </View>
        {!isGalleryDetail && (
          <View className='danger-button transparent-button' onClick={remove}>
            <AppIcon name='delete' size={16} />
            <Text>删除</Text>
          </View>
        )}
      </View>
    </Shell>
  )
}
