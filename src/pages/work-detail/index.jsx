import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Image, Video } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { ErrorState, PageLoading } from '../../components/PageState'
import {
  cancelGenerationTask,
  createWorkShareTicket,
  deleteWorkRemote,
  fetchGenerationTask,
  fetchGalleryWork,
  fetchSharedWork,
  fetchWork,
  getDownloadUrl,
  normalizeWorkMedia,
  publishGalleryWork,
  retryGenerationTask,
  unpublishGalleryWork
} from '../../services/api'
import { goPage, goTab } from '../../utils/navigation'
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
  if (status === 'queued') return '任务已进入队列，系统会按顺序开始生成。'
  if (status === 'processing') return '生成服务正在处理素材和提示词，完成后会自动刷新结果。'
  if (status === 'canceled') return '任务已取消，本次扣点将按平台规则处理。'
  if (status === 'failed') return '任务生成失败，可以查看原因后重新生成。'
  return '任务已完成，可以保存、分享或发布到广场。'
}

function mergeTask(work, task) {
  if (!work) return work
  return normalizeWorkMedia({
    ...work,
    status: task.status,
    resultUrls: task.resultUrls || work.resultUrls || [],
    coverUrl: task.coverUrl || work.coverUrl,
    image: task.coverUrl || task.resultUrls?.[0] || work.image,
    failureReason: task.failureReason || work.failureReason,
    failReason: task.failureReason || work.failReason,
    providerAttempts: task.providerAttempts || work.providerAttempts,
    finishedAt: task.finishedAt || work.finishedAt
  })
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

function buildShareLink({ ticket, id, source = 'gallery' }) {
  const path = ticket
    ? `/pages/work-detail/index?ticket=${encodeURIComponent(ticket)}&source=share`
    : `/pages/work-detail/index?id=${encodeURIComponent(id)}&source=${encodeURIComponent(source)}`
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}#${path}`
  }
  return path
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
  const { id, source, ticket } = getCurrentInstance().router?.params || {}
  const [work, setWork] = useState(null)
  const [detailMode, setDetailMode] = useState(ticket ? 'share' : source === 'gallery' ? 'gallery' : 'owner')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshingTask, setRefreshingTask] = useState(false)
  const [cancelingTask, setCancelingTask] = useState(false)
  const [sharing, setSharing] = useState(false)

  const loadWorkDetail = () => {
    let mounted = true
    setLoading(true)
    const loadDetail = ticket
      ? fetchSharedWork(ticket).then((data) => ({ data, mode: 'share' }))
      : (source === 'gallery' || !isLoggedIn())
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
  }, [id, source, ticket])

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
          goTab('/pages/works/index')
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
      content: '确认取消当前生成任务吗？取消后本次扣点将按平台规则处理，已进入处理阶段的任务可能仍需等待状态同步。',
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
        goPage(`/pages/work-detail/index?id=${result.work.id}`, { replace: true })
        return
      } catch (error) {
        Taro.showToast({ title: error.message || '重试失败', icon: 'none' })
      }
    }
    goPage(`/pages/tool/index?id=${work.toolKey || 'factory-painter'}&prompt=${encodeURIComponent(work.prompt || '')}`)
  }

  const saveWork = async () => {
    if (work.lockedUntilPurchase) {
      Taro.showToast({ title: '购买模板后解锁保存', icon: 'none' })
      return
    }
    if (['gallery', 'share'].includes(detailMode) && work.downloadEnabled === false) {
      Taro.showToast({ title: '该作品暂不支持保存', icon: 'none' })
      return
    }
    let url = ''
    Taro.showLoading({ title: process.env.TARO_ENV === 'h5' ? '准备下载' : '保存中' })
    try {
      const data = await getDownloadUrl(work.id, detailMode === 'share' ? (work.shareTicket || ticket) : '')
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

  const shareWork = async () => {
    if (work.status !== 'success') {
      Taro.showToast({ title: '成功作品才可以分享', icon: 'none' })
      return
    }
    if (work.lockedUntilPurchase) {
      Taro.showToast({ title: '购买模板后解锁分享', icon: 'none' })
      return
    }
    if (sharing) return
    setSharing(true)
    Taro.showLoading({ title: '生成分享' })
    try {
      let shareTicket = work.shareTicket || ticket || ''
      if (detailMode === 'owner') {
        const result = await createWorkShareTicket(work.id)
        shareTicket = result.shareTicket
        setWork((prev) => ({ ...prev, shareTicket }))
      }
      const shareLink = detailMode === 'gallery' && !shareTicket
        ? buildShareLink({ id: work.id, source: 'gallery' })
        : buildShareLink({ ticket: shareTicket, id: work.id, source: 'share' })
      Taro.hideLoading()
      try {
        Taro.showShareMenu({ withShareTicket: true })
      } catch (_) {}
      Taro.setClipboardData({
        data: shareLink,
        success: () => Taro.showToast({ title: '分享链接已复制', icon: 'success' }),
        fail: () => Taro.showToast({ title: '分享链接生成成功，请手动复制', icon: 'none' })
      })
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: error.message || '分享失败', icon: 'none' })
    } finally {
      setSharing(false)
    }
  }

  const publish = async () => {
    if (work.lockedUntilPurchase) {
      Taro.showToast({ title: '购买模板后解锁发布', icon: 'none' })
      return
    }
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

  const goPurchaseWorkflow = () => {
    if (!work?.sourceCaseContentId) {
      Taro.showToast({ title: '缺少对应 Workflow 案例信息', icon: 'none' })
      return
    }
    goPage(`/pages/workflow-cases/index?id=${encodeURIComponent(work.sourceCaseContentId)}`)
  }

  if (!work) {
    const fallbackUrl = source === 'gallery' ? '/pages/gallery/index' : '/pages/works/index'
    return (
      <Shell title='作品详情' showTab={false} backFallback={fallbackUrl} onRefresh={work?.generationTaskId && isActiveStatus(work.status) ? (() => refreshTaskStatus(true)) : loadWorkDetail}>
        {loading ? (
          <PageLoading title='正在同步作品' description='正在读取作品结果、任务状态和保存权限。' />
        ) : (
          <ErrorState title='作品不可访问' description={error || '作品不存在、已删除或暂未公开。'} onRetry={loadWorkDetail} />
        )}
      </Shell>
    )
  }

  const media = work.mediaUrl || work.resultUrls?.[0] || work.image || work.coverUrl || ''
  const mediaKind = work.mediaKind || inferMediaKind(work, media)
  const preview = work.previewUrl || work.coverUrl || (mediaKind === 'image' ? (work.image || media) : '')
  const pending = isActiveStatus(work?.status)
  const failed = ['failed', 'canceled'].includes(work?.status)
  const isSharedDetail = detailMode === 'share'
  const isGalleryDetail = detailMode === 'gallery'
  const publicLikeDetail = isGalleryDetail || isSharedDetail
  const lockedUntilPurchase = Boolean(work.lockedUntilPurchase)
  const canSave = work.status === 'success' && !lockedUntilPurchase && (!publicLikeDetail || work.downloadEnabled !== false)
  const canShare = work.status === 'success' && !lockedUntilPurchase
  const backFallback = isGalleryDetail ? '/pages/gallery/index' : '/pages/works/index'

  return (
    <Shell title='作品详情' showTab={false} backFallback={backFallback} onRefresh={work?.generationTaskId && isActiveStatus(work.status) ? (() => refreshTaskStatus(true)) : loadWorkDetail}>
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
          {!publicLikeDetail && (
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

      {lockedUntilPurchase ? (
        <View className='panel task-state-panel locked-work-panel'>
          <View className='task-state-main'>
            <View className='profile-icon'>
              <AppIcon name='lock' size={20} />
            </View>
            <View className='task-state-copy'>
              <Text className='profile-name'>试运行作品待解锁</Text>
              <Text className='tool-desc'>该作品来自闭源付费 Workflow 试运行。购买对应模板后，可保存、分享并发布到广场。</Text>
            </View>
          </View>
          <View className='task-actions'>
            <View className={work.sourceCaseContentId ? 'primary-button' : 'primary-button disabled'} onClick={work.sourceCaseContentId ? goPurchaseWorkflow : undefined}>
              <AppIcon name='fusion' size={14} />
              <Text>购买解锁</Text>
            </View>
            <View className='ghost-button glass-button' onClick={() => goPage('/pages/workflow-cases/index')}>
              <AppIcon name='gallery' size={14} />
              <Text>Workflow 案例</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View className='hero-actions'>
        <View className={canSave ? 'primary-button' : 'primary-button disabled'} onClick={canSave ? saveWork : undefined}>
          <AppIcon name='download' size={16} />
          <Text>{lockedUntilPurchase ? '购买后保存' : work.downloadEnabled === false && publicLikeDetail ? '不可保存' : '保存'}</Text>
        </View>
        <View className={canShare && !sharing ? 'ghost-button glass-button' : 'ghost-button glass-button disabled'} onClick={canShare ? shareWork : undefined}>
          <AppIcon name='share' size={16} />
          <Text>{lockedUntilPurchase ? '购买后分享' : sharing ? '生成中' : '分享'}</Text>
        </View>
      </View>
      {publicLikeDetail ? (
        <View className='hero-actions'>
          <View className='primary-button' onClick={retry}>
            <AppIcon name='wand' size={16} />
            <Text>同款创作</Text>
          </View>
        </View>
      ) : (
        <View className='hero-actions'>
          <View className={work.status === 'success' && !lockedUntilPurchase ? 'primary-button' : 'primary-button disabled'} onClick={work.status === 'success' && !lockedUntilPurchase ? publish : undefined}>
            <AppIcon name='gallery' size={16} />
            <Text>{lockedUntilPurchase ? '购买后发布' : '发布广场'}</Text>
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
          <Text>{publicLikeDetail ? '带入提示词' : '重新生成'}</Text>
        </View>
        {!publicLikeDetail && (
          <View className='danger-button transparent-button' onClick={remove}>
            <AppIcon name='delete' size={16} />
            <Text>删除</Text>
          </View>
        )}
      </View>
    </Shell>
  )
}
