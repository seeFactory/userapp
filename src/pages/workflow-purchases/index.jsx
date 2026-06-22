import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
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

function statusText(item) {
  if (item.status === 'disabled' || item.runnable === false) return '暂停运行'
  if (item.replacementAvailable) return '可替代'
  return '可运行'
}

function templateTitle(item) {
  return item.case?.title || item.version?.title || 'Workflow 模板'
}

function templateSummary(item) {
  return item.case?.summary || item.version?.summary || '已购买的闭源模板，可在权限可用时继续调度运行。'
}

export default function WorkflowPurchases() {
  const loggedIn = isLoggedIn()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [runningId, setRunningId] = useState('')

  const loadPurchases = () => {
    let mounted = true
    setLoading(true)
    fetchWorkflowPurchases({ pageSize: 50 })
      .then((data) => {
        if (!mounted) return
        setList(data.list || [])
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
    if (!item.runnable || item.status === 'disabled') {
      Taro.showToast({ title: item.disabledReason || '该模板已暂停运行', icon: 'none' })
      return
    }
    const caseId = item.caseContentId || item.case?.id
    if (!caseId) {
      Taro.showToast({ title: '模板缺少案例信息', icon: 'none' })
      return
    }
    setRunningId(item.id)
    Taro.showLoading({ title: '准备运行' })
    try {
      const result = await runWorkflowCase(caseId, { input: {}, params: {} })
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
                    <Text>{item.pricePoints || 0} 点 · {formatDate(item.purchasedAt)}</Text>
                  </View>
                  <View className={item.runnable === false || item.status === 'disabled' ? 'status failed' : 'status'}>
                    <AppIcon name={item.runnable === false || item.status === 'disabled' ? 'alert' : 'badge'} size={11} />
                    <Text>{statusText(item)}</Text>
                  </View>
                </View>
                {item.disabledReason ? <Text className='tool-desc'>{item.disabledReason}</Text> : null}
                <View
                  className={runningId === item.id || item.runnable === false ? 'primary-button full-width-button disabled' : 'primary-button full-width-button'}
                  onClick={runningId === item.id ? undefined : () => runTemplate(item)}
                >
                  <AppIcon name='play' size={15} />
                  <Text>{runningId === item.id ? '提交中...' : item.runnable === false ? '暂停运行' : '运行模板'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Shell>
  )
}
