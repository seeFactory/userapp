import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
import WorkflowRunFormFields, { buildWorkflowRunPayload, initialWorkflowRunValues } from '../../components/WorkflowRunFormFields'
import { fetchWorkflowPurchases, runWorkflowCase } from '../../services/api'
import { requireLogin, isLoggedIn } from '../../utils/storage'
import { goPage } from '../../utils/navigation'

const fallbackCover = 'https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&w=900&q=80'

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return `${formatDate(value)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function canRunWorkflowPurchase(item) {
  if (item?.canRun !== undefined) return Boolean(item.canRun)
  if (item?.runnable !== undefined) return Boolean(item.runnable)
  return item?.status !== 'disabled' && item?.disabled !== true
}

function workflowBlockedReason(item) {
  return item?.runBlockedReason || item?.disabledReason || ''
}

function workflowRunStatusText(status) {
  if (status === 'success') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'canceled') return '已取消'
  if (status === 'processing') return '生成中'
  return '排队中'
}

function workflowLifecycleSource(item) {
  return item?.case || item || {}
}

function workflowLifecycleLabel(item) {
  const source = workflowLifecycleSource(item)
  if (source.disabled || source.visibility === 'disabled' || source.listingStatus === 'disabled') return '已禁用'
  if (source.deletedByAuthorAt) return '已停止公开'
  if (source.public === false || source.visibility === 'hidden' || source.listingStatus === 'hidden') return '已隐藏'
  return '公开中'
}

function workflowLifecycleNote(item) {
  const source = workflowLifecycleSource(item)
  if (source.disabled || source.visibility === 'disabled' || source.listingStatus === 'disabled') {
    return '该模板已被平台暂停运行，购买记录仍保留，待平台恢复或提供替代模型后再运行。'
  }
  if (source.deletedByAuthorAt) {
    return '作者已停止公开展示该案例，已购权益仍保留，可继续运行该发布版本。'
  }
  if (source.public === false || source.visibility === 'hidden' || source.listingStatus === 'hidden') {
    return '作者已隐藏公开展示，已购权益仍保留，可继续运行该发布版本。'
  }
  return ''
}

function statusText(item) {
  if (!canRunWorkflowPurchase(item)) return '暂停运行'
  if (item.hasReplacementModel || item.replacementAvailable) return '可替代'
  return '可运行'
}

function templateTitle(item) {
  return item.case?.title || item.version?.title || 'Workflow 模板'
}

function templateSummary(item) {
  return item.case?.summary || item.version?.summary || '已购买的闭源模板，可在权限可用时继续调度运行。'
}

function templateCreatorName(item) {
  return item?.creator?.nickname || 'seeFactory 创作者'
}

function templateVersionLabel(item) {
  return item?.versionLabel || (item?.purchasedVersion?.version ? `v${item.purchasedVersion.version}` : '发布版本')
}

function templateLastRunText(item) {
  if (!item?.lastRunAt) return '暂无运行'
  const runKind = item.lastRun?.isTrial ? '试运行' : '正式运行'
  return `${runKind} ${workflowRunStatusText(item.lastRunStatus)} · ${formatDateTime(item.lastRunAt)}`
}

function runFormOf(item) {
  return item?.case?.runForm || item?.version?.runForm || {}
}

export default function WorkflowPurchases() {
  const loggedIn = isLoggedIn()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [runningId, setRunningId] = useState('')
  const [runValuesById, setRunValuesById] = useState({})

  const loadPurchases = () => {
    let mounted = true
    setLoading(true)
    fetchWorkflowPurchases({ pageSize: 50 })
      .then((data) => {
        if (!mounted) return
        const rows = data.list || []
        setList(rows)
        setRunValuesById((current) => rows.reduce((values, item) => ({
          ...values,
          [item.id]: current[item.id] || initialWorkflowRunValues(runFormOf(item))
        }), {}))
        setError('')
      })
      .catch((err) => {
        if (mounted) setError(err?.message || '已购模板库暂未同步，请稍后重试。')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    if (!loggedIn) return undefined
    return loadPurchases()
  }, [loggedIn])

  const runTemplate = async (item) => {
    if (!canRunWorkflowPurchase(item)) {
      Taro.showToast({ title: workflowBlockedReason(item) || '该模板已暂停运行', icon: 'none' })
      return
    }
    const caseId = item.caseContentId || item.case?.id
    if (!caseId) {
      Taro.showToast({ title: '模板缺少案例信息', icon: 'none' })
      return
    }
    const payloadResult = buildWorkflowRunPayload(runFormOf(item), runValuesById[item.id] || initialWorkflowRunValues(runFormOf(item)))
    if (!payloadResult.ok) {
      Taro.showToast({ title: payloadResult.message, icon: 'none' })
      return
    }
    setRunningId(item.id)
    Taro.showLoading({ title: '准备运行' })
    try {
      const result = await runWorkflowCase(caseId, payloadResult.payload)
      Taro.showToast({ title: '已提交运行', icon: 'success' })
      loadPurchases()
      const runId = result?.run?.id || result?.id
      if (runId) {
        goPage(`/pages/workflow-runs/detail/index?id=${encodeURIComponent(runId)}`)
      }
    } catch (err) {
      const message = err?.message || '运行失败，请稍后重试'
      Taro.showModal({
        title: '暂不能运行',
        content: message,
        showCancel: false,
        confirmText: '我知道了'
      })
    } finally {
      Taro.hideLoading()
      setRunningId('')
    }
  }

  const updateRunValue = (itemId, key, value) => {
    setRunValuesById((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || {}),
        [key]: value
      }
    }))
  }

  if (!loggedIn) {
    return (
      <Shell title='已购模板库' showTab={false} backFallback='/pages/mine/index'>
        <EmptyState
          title='请先登录'
          description='登录后可查看已购买的闭源 Workflow 模板。'
          icon='lock'
          actionText='前往登录'
          onAction={() => requireLogin('/pages/workflow-purchases/index')}
        />
      </Shell>
    )
  }

  return (
    <Shell title='已购模板库' showTab={false} backFallback='/pages/mine/index'>
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>{loading ? '同步模板中' : 'Workflow 权益'}</Text>
            <Text className='section-title'>已购模板库</Text>
          </View>
        </View>
        <View className='ghost-button glass-button compact' onClick={loadPurchases}>
          <AppIcon name='refresh' size={14} />
          <Text>刷新</Text>
        </View>
      </View>

      {error && list.length ? <InlineNotice tone='danger'>{error}</InlineNotice> : null}

      {loading ? (
        <PageLoading title='正在同步模板库' description='正在读取你已购买的 Workflow 权益和运行状态。' />
      ) : error && !list.length ? (
        <ErrorState title='模板库加载失败' description={error} onRetry={loadPurchases} />
      ) : list.length === 0 ? (
        <EmptyState
          title='暂无已购模板'
          description='购买闭源 Workflow 后，会在这里永久保留运行权益。'
          icon='center'
          actionText='去广场看看'
          onAction={() => goPage('/pages/gallery/index')}
        />
      ) : (
        <View className='case-grid'>
          {list.map((item) => (
            <View key={item.id} className='work-card'>
              <Image className='work-image' src={item.case?.coverUrl || item.version?.coverUrl || fallbackCover} mode='aspectFill' />
              <View className='work-body'>
                <Text className='work-title'>{templateTitle(item)}</Text>
                <Text className='tool-desc'>{templateSummary(item)}</Text>
                <View className='meta-row'>
                  <View className='meta-icon-text'>
                    <AppIcon name='fusion' size={12} />
                    <Text>{item.pricePoints || 0} 点 · {templateVersionLabel(item)} · {formatDate(item.purchasedAt)}</Text>
                  </View>
                  <View className={!canRunWorkflowPurchase(item) ? 'status failed' : 'status'}>
                    <AppIcon name={!canRunWorkflowPurchase(item) ? 'alert' : 'badge'} size={11} />
                    <Text>{statusText(item)}</Text>
                  </View>
                </View>
                <Text className='tool-desc'>作者 {templateCreatorName(item)} · {templateLastRunText(item)}</Text>
                {item.hasReplacementModel || item.replacementAvailable ? <Text className='tool-desc'>存在可替代模型，运行时按后台映射处理。</Text> : null}
                <Text className='tool-desc'>{workflowLifecycleLabel(item)}</Text>
                {workflowLifecycleNote(item) ? (
                  <InlineNotice tone={!canRunWorkflowPurchase(item) ? 'danger' : 'info'}>{workflowLifecycleNote(item)}</InlineNotice>
                ) : null}
                {workflowBlockedReason(item) ? <Text className='tool-desc'>{workflowBlockedReason(item)}</Text> : null}
                <WorkflowRunFormFields
                  runForm={runFormOf(item)}
                  values={runValuesById[item.id] || initialWorkflowRunValues(runFormOf(item))}
                  disabled={runningId === item.id || !canRunWorkflowPurchase(item)}
                  onChange={(key, value) => updateRunValue(item.id, key, value)}
                />
                <View
                  className={runningId === item.id || !canRunWorkflowPurchase(item) ? 'primary-button full-width-button disabled' : 'primary-button full-width-button'}
                  onClick={runningId === item.id ? undefined : () => runTemplate(item)}
                >
                  <AppIcon name='play' size={15} />
                  <Text>{runningId === item.id ? '提交中...' : !canRunWorkflowPurchase(item) ? '暂停运行' : '运行模板'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Shell>
  )
}
