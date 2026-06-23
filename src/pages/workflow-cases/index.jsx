import { useEffect, useMemo, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Image, Input } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
import WorkflowRunFormFields, { buildWorkflowRunPayload, initialWorkflowRunValues } from '../../components/WorkflowRunFormFields'
import {
  fetchWorkflowCase,
  fetchWorkflowCasePurchaseStatus,
  fetchWorkflowCases,
  purchaseWorkflowCase,
  runWorkflowCase,
  trialRunWorkflowCase
} from '../../services/api'
import { requireLogin, isLoggedIn } from '../../utils/storage'
import { goPage } from '../../utils/navigation'

const fallbackCover = 'https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&w=900&q=80'

function caseTitle(item) {
  return item?.title || 'Workflow 案例'
}

function caseSummary(item) {
  return item?.summary || item?.description || '可运行的 seeFactory Workflow 模板。'
}

function caseSearchText(item) {
  return [
    item?.title,
    item?.summary,
    item?.description,
    item?.category,
    item?.licenseMode,
    item?.creator?.nickname,
    item?.author?.nickname,
    ...(Array.isArray(item?.tags) ? item.tags : [])
  ].filter(Boolean).join(' ').toLowerCase()
}

function runFormOf(item) {
  return item?.runForm || {}
}

function workflowCanRun(status, item) {
  if (status?.canRun !== undefined) return Boolean(status.canRun)
  if (status?.runnable !== undefined) return Boolean(status.runnable)
  if (item?.licenseMode === 'closed_paid' && !status?.purchased) return false
  return !status?.disabled && item?.disabled !== true
}

function workflowBlockedReason(status, item) {
  if (status?.runBlockedReason) return status.runBlockedReason
  if (status?.disabledReason) return status.disabledReason
  if (item?.licenseMode === 'closed_paid' && !status?.purchased) return '购买后可正式运行。'
  return ''
}

function workflowLifecycleSource(status, item) {
  return status || item || {}
}

function workflowLifecycleNote(status, item) {
  const source = workflowLifecycleSource(status, item)
  const purchased = Boolean(status?.purchased)
  if (source.disabled || source.visibility === 'disabled' || source.listingStatus === 'disabled') {
    return '该模板已被平台暂停运行，购买记录仍保留，待平台恢复或提供替代模型后再运行。'
  }
  if (source.deletedByAuthorAt) {
    return purchased
      ? '作者已停止公开展示该案例，已购权益仍保留，可继续运行该发布版本。'
      : '作者已停止公开展示该案例，暂不支持新的购买或公开访问。'
  }
  if (source.public === false || source.visibility === 'hidden' || source.listingStatus === 'hidden') {
    return purchased
      ? '作者已隐藏公开展示，已购权益仍保留，可继续运行该发布版本。'
      : '该案例当前已隐藏，暂不支持新的购买或公开访问。'
  }
  return ''
}

function canTrialRun(status, item) {
  return item?.licenseMode === 'closed_paid' && !status?.purchased && Boolean(status?.trialEnabled) && Number(status?.trialRemaining || 0) > 0
}

export default function WorkflowCases() {
  const routeCaseId = String(getCurrentInstance().router?.params?.id || '')
  const loggedIn = isLoggedIn()
  const [list, setList] = useState([])
  const [selectedId, setSelectedId] = useState(routeCaseId)
  const [detail, setDetail] = useState(null)
  const [status, setStatus] = useState(null)
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [caseQuery, setCaseQuery] = useState('')

  const filteredList = useMemo(() => {
    const keyword = caseQuery.trim().toLowerCase()
    if (!keyword) return list
    return list.filter((item) => caseSearchText(item).includes(keyword))
  }, [caseQuery, list])

  const selectedInFilter = filteredList.some((item) => item.id === selectedId)
  const selected = (
    selectedInFilter ? detail || list.find((item) => item.id === selectedId) : null
  ) || filteredList[0] || list[0]
  const canRun = workflowCanRun(status, selected)
  const blockedReason = workflowBlockedReason(status, selected)
  const lifecycleNote = workflowLifecycleNote(status, selected)
  const trialEnabled = canTrialRun(status, selected)

  const loadCases = () => {
    let mounted = true
    setLoading(true)
    fetchWorkflowCases({ pageSize: 30 })
      .then((data) => {
        if (!mounted) return
        const rows = data.list || []
        setList(rows)
        setError('')
        const requestedId = selectedId || routeCaseId
        const nextId = requestedId || rows[0]?.id || ''
        setSelectedId(nextId)
      })
      .catch((err) => mounted && setError(err?.message || 'Workflow 案例暂未同步，请稍后重试。'))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => loadCases(), [])

  useEffect(() => {
    if (!caseQuery.trim() || !filteredList.length) return
    if (filteredList.some((item) => item.id === selectedId)) return
    const next = filteredList[0]
    setSelectedId(next.id)
    setDetail(null)
    setStatus(null)
    setValues(initialWorkflowRunValues(runFormOf(next)))
  }, [caseQuery, filteredList, selectedId])

  useEffect(() => {
    if (!selectedId) return undefined
    let mounted = true
    setDetailLoading(true)
    const detailTask = fetchWorkflowCase(selectedId)
    const statusTask = loggedIn
      ? fetchWorkflowCasePurchaseStatus(selectedId).catch(() => null)
      : Promise.resolve(null)
    Promise.all([detailTask, statusTask])
      .then(([caseDetail, purchaseStatus]) => {
        if (!mounted) return
        setDetail(caseDetail)
        setStatus(purchaseStatus)
        setValues(initialWorkflowRunValues(runFormOf(caseDetail)))
      })
      .catch((err) => Taro.showToast({ title: err?.message || '案例详情加载失败', icon: 'none' }))
      .finally(() => mounted && setDetailLoading(false))
    return () => {
      mounted = false
    }
  }, [selectedId, loggedIn])

  const selectCase = (item) => {
    setSelectedId(item.id)
    setDetail(null)
    setStatus(null)
    setValues(initialWorkflowRunValues(runFormOf(item)))
  }

  const ensureLogin = () => {
    if (loggedIn) return true
    requireLogin('/pages/workflow-cases/index')
    return false
  }

  const refreshSelected = () => {
    if (!selectedId) return
    fetchWorkflowCase(selectedId)
      .then((caseDetail) => {
        setDetail(caseDetail)
        setValues(initialWorkflowRunValues(runFormOf(caseDetail)))
      })
      .catch(() => undefined)
    if (loggedIn) {
      fetchWorkflowCasePurchaseStatus(selectedId).then(setStatus).catch(() => undefined)
    }
  }

  const purchaseSelected = async () => {
    if (!selected || !ensureLogin()) return
    setBusy('purchase')
    Taro.showLoading({ title: '购买模板' })
    try {
      await purchaseWorkflowCase(selected.id)
      Taro.showToast({ title: '已购买', icon: 'success' })
      refreshSelected()
    } catch (err) {
      Taro.showModal({
        title: '购买失败',
        content: err?.message || '暂时无法购买该 Workflow。',
        showCancel: false,
        confirmText: '我知道了'
      })
    } finally {
      Taro.hideLoading()
      setBusy('')
    }
  }

  const submitRun = async (kind) => {
    if (!selected || !ensureLogin()) return
    if (kind === 'run' && !canRun) {
      Taro.showToast({ title: blockedReason || '该 Workflow 暂不可运行', icon: 'none' })
      return
    }
    const payloadResult = buildWorkflowRunPayload(runFormOf(selected), values)
    if (!payloadResult.ok) {
      Taro.showToast({ title: payloadResult.message, icon: 'none' })
      return
    }
    setBusy(kind)
    Taro.showLoading({ title: kind === 'trial' ? '提交试运行' : '提交运行' })
    try {
      const result = kind === 'trial'
        ? await trialRunWorkflowCase(selected.id, payloadResult.payload)
        : await runWorkflowCase(selected.id, payloadResult.payload)
      Taro.showToast({ title: kind === 'trial' ? '试运行已提交' : '运行已提交', icon: 'success' })
      refreshSelected()
      const runId = result?.run?.id || result?.id
      if (runId) goPage(`/pages/workflow-runs/detail/index?id=${encodeURIComponent(runId)}`)
    } catch (err) {
      Taro.showModal({
        title: kind === 'trial' ? '试运行失败' : '运行失败',
        content: err?.message || 'Workflow 暂未提交成功，请稍后重试。',
        showCancel: false,
        confirmText: '我知道了'
      })
    } finally {
      Taro.hideLoading()
      setBusy('')
    }
  }

  const headerNote = useMemo(() => {
    if (!selected) return '选择公开 Workflow 案例后，可查看权益并提交运行。'
    if (selected.licenseMode === 'closed_paid') {
      return status?.purchased ? '已购买该发布版本，可永久运行。' : '闭源付费模板购买后获得运行权，不开放 graph、克隆或导出。'
    }
    return '开源免费案例可登录后运行；复杂编辑请到 PC Dashboard。'
  }, [selected, status])

  return (
    <Shell title='Workflow 案例' showTab={false} backFallback='/pages/create-center/index'>
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>{loading ? '同步案例中' : 'Workflow 广场'}</Text>
            <Text className='section-title'>选择案例运行</Text>
          </View>
        </View>
        <View className='ghost-button glass-button compact' onClick={loadCases}>
          <AppIcon name='refresh' size={14} />
          <Text>刷新</Text>
        </View>
      </View>

      <InlineNotice>{headerNote}</InlineNotice>

      <View className='search-box workflow-case-search'>
        <Input
          className='search-input'
          value={caseQuery}
          placeholder='搜索案例名称、描述、分类或标签'
          placeholderClass='muted'
          onInput={(event) => setCaseQuery(event.detail.value)}
        />
        <View className={caseQuery ? 'ghost-button glass-button compact' : 'ghost-button glass-button compact disabled'} onClick={caseQuery ? () => setCaseQuery('') : undefined}>
          <AppIcon name='close' size={14} />
          <Text>清空</Text>
        </View>
      </View>

      {loading ? (
        <PageLoading title='正在同步 Workflow 案例' description='正在读取公开模板、运行表单和购买状态。' />
      ) : error ? (
        <ErrorState title='案例加载失败' description={error} onRetry={loadCases} />
      ) : !list.length ? (
        <EmptyState title='暂无 Workflow 案例' description='发布 open_free 或 closed_paid Workflow 后，会在这里展示。' icon='fusion' />
      ) : !filteredList.length ? (
        <EmptyState title='没有匹配案例' description='换一个关键词试试，支持搜索案例名称、描述、分类和标签。' icon='search' />
      ) : (
        <>
          <View className='case-grid workflow-case-grid'>
            {filteredList.map((item) => (
              <View key={item.id} className={selected?.id === item.id ? 'work-card workflow-case-card active' : 'work-card workflow-case-card'} onClick={() => selectCase(item)}>
                <Image className='work-image' src={item.coverUrl || fallbackCover} mode='aspectFill' />
                <View className='work-body'>
                  <View className='meta-row'>
                    <View className='status'>
                      <AppIcon name='fusion' size={11} />
                      <Text>{item.licenseMode === 'closed_paid' ? '闭源付费' : '开源免费'}</Text>
                    </View>
                    <Text className='tool-desc'>{item.pricePoints || 0} 点</Text>
                  </View>
                  <Text className='work-title'>{caseTitle(item)}</Text>
                  <Text className='tool-desc'>{caseSummary(item)}</Text>
                  <View className='meta-row'>
                    <Text className='tool-desc'>运行 {item.runCount || 0}</Text>
                    <Text className='tool-desc'>购买 {item.purchaseCount || 0}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {selected ? (
            <View className='form-panel compact-panel workflow-case-detail-panel'>
              <View className='section-head compact-head'>
                <View>
                  <Text className='section-kicker'>{detailLoading ? '同步权益中' : status?.purchased ? '已购买' : selected.licenseMode === 'closed_paid' ? '购买后运行' : '免费运行'}</Text>
                  <Text className='section-title'>{caseTitle(selected)}</Text>
                </View>
                <View className={canRun ? 'status success' : 'status failed'}>
                  <AppIcon name={canRun ? 'badge' : 'alert'} size={11} />
                  <Text>{canRun ? '可运行' : selected.licenseMode === 'closed_paid' && !status?.purchased ? '需购买' : '暂停'}</Text>
                </View>
              </View>
              <Text className='tool-desc'>{caseSummary(selected)}</Text>
              {lifecycleNote ? <InlineNotice tone={!canRun ? 'danger' : 'info'}>{lifecycleNote}</InlineNotice> : null}
              {blockedReason ? <InlineNotice tone={canRun ? 'info' : 'warning'}>{blockedReason}</InlineNotice> : null}
              <WorkflowRunFormFields
                runForm={runFormOf(selected)}
                values={values}
                disabled={Boolean(busy)}
                emptyText='作者未开放可调整运行参数，将使用发布版本中锁定的默认配置。'
                onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
              />
              <View className='hero-actions stacked-actions'>
                {selected.licenseMode === 'closed_paid' && !status?.purchased ? (
                  <View className={busy ? 'primary-button disabled' : 'primary-button'} onClick={busy ? undefined : purchaseSelected}>
                    <AppIcon name='coin' size={15} />
                    <Text>{busy === 'purchase' ? '购买中...' : `购买 ${selected.pricePoints || 0} 点`}</Text>
                  </View>
                ) : null}
                {trialEnabled ? (
                  <View className={busy ? 'ghost-button glass-button disabled' : 'ghost-button glass-button'} onClick={busy ? undefined : () => submitRun('trial')}>
                    <AppIcon name='play' size={15} />
                    <Text>{busy === 'trial' ? '提交中...' : `试运行 ${status?.trialRemaining || 0} 次`}</Text>
                  </View>
                ) : null}
                <View className={busy || !canRun ? 'primary-button disabled' : 'primary-button'} onClick={busy || !canRun ? undefined : () => submitRun('run')}>
                  <AppIcon name='play' size={15} />
                  <Text>{busy === 'run' ? '提交中...' : '正式运行'}</Text>
                </View>
                {status?.purchased ? (
                  <View className='ghost-button glass-button' onClick={() => goPage('/pages/workflow-purchases/index')}>
                    <AppIcon name='badge' size={15} />
                    <Text>已购模板库</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </>
      )}
    </Shell>
  )
}
