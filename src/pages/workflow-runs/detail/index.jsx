import { useEffect, useMemo, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Shell from '../../../components/Shell'
import AppIcon from '../../../components/AppIcon'
import BrandLogo from '../../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../../components/PageState'
import { fetchWorkflowRun } from '../../../services/api'
import { goPage } from '../../../utils/navigation'

const terminalStatuses = ['success', 'failed', 'canceled']

function statusText(status) {
  if (status === 'success') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'canceled') return '已取消'
  if (status === 'processing') return '生成中'
  return '排队中'
}

function statusIcon(status) {
  if (status === 'success') return 'badge'
  if (status === 'failed' || status === 'canceled') return 'alert'
  return 'sparkles'
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function compactId(value) {
  if (!value) return '--'
  const text = String(value)
  return text.length > 10 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text
}

export default function WorkflowRunDetail() {
  const params = getCurrentInstance().router?.params || {}
  const runId = params.id
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDetail = (silent = false) => {
    if (!runId) {
      setLoading(false)
      setError('缺少运行记录 ID')
      return Promise.resolve()
    }
    if (!silent) setLoading(true)
    return fetchWorkflowRun(runId)
      .then((data) => {
        setDetail(data)
        setError('')
      })
      .catch((err) => {
        setError(err?.message || 'Workflow 运行记录暂未同步成功。')
      })
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }

  useEffect(() => {
    loadDetail()
  }, [runId])

  useEffect(() => {
    const status = detail?.run?.status
    if (!status || terminalStatuses.includes(status)) return undefined
    const timer = setInterval(() => {
      loadDetail(true)
    }, 3000)
    return () => clearInterval(timer)
  }, [detail?.run?.status, runId])

  const nodes = detail?.nodes || []
  const run = detail?.run
  const progress = useMemo(() => {
    if (!nodes.length) return '0/0'
    const done = nodes.filter((node) => terminalStatuses.includes(node.status) || node.status === 'skipped').length
    return `${done}/${nodes.length}`
  }, [nodes])

  if (loading) {
    return (
      <Shell title='Workflow 运行' showTab={false} backFallback='/pages/workflow-purchases/index'>
        <PageLoading title='正在同步运行记录' description='正在读取 Workflow 节点状态和生成任务。' />
      </Shell>
    )
  }

  if (error && !detail) {
    return (
      <Shell title='Workflow 运行' showTab={false} backFallback='/pages/workflow-purchases/index'>
        <ErrorState title='运行记录加载失败' description={error} onRetry={() => loadDetail()} />
      </Shell>
    )
  }

  if (!run) {
    return (
      <Shell title='Workflow 运行' showTab={false} backFallback='/pages/workflow-purchases/index'>
        <EmptyState title='暂无运行记录' description='没有找到对应的 Workflow run。' icon='center' />
      </Shell>
    )
  }

  return (
    <Shell title='Workflow 运行' showTab={false} backFallback='/pages/workflow-purchases/index'>
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>{run.isTrial ? '试运行' : '正式运行'} · {progress}</Text>
            <Text className='section-title'>Workflow 运行详情</Text>
          </View>
        </View>
        <View className='ghost-button glass-button compact' onClick={() => loadDetail()}>
          <AppIcon name='refresh' size={14} />
          <Text>刷新</Text>
        </View>
      </View>

      {error ? <InlineNotice tone='danger'>{error}</InlineNotice> : null}

      <View className='work-card'>
        <View className='work-body'>
          <View className='meta-row'>
            <View className={run.status === 'failed' ? 'status failed' : 'status'}>
              <AppIcon name={statusIcon(run.status)} size={12} />
              <Text>{statusText(run.status)}</Text>
            </View>
            <View className='meta-icon-text'>
              <AppIcon name='fusion' size={12} />
              <Text>预估 {run.estimatedPoints || 0} 点 · 实际 {run.actualPoints || 0} 点</Text>
            </View>
          </View>
          <Text className='tool-desc'>运行 ID：{compactId(run.id)} · 创建时间：{formatDate(run.createdAt)}</Text>
          {run.failureReason ? <Text className='tool-desc'>{run.failureReason}</Text> : null}
          <View className='primary-button full-width-button' onClick={() => goPage('/pages/works/index')}>
            <AppIcon name='gallery' size={15} />
            <Text>查看作品库</Text>
          </View>
        </View>
      </View>

      <View className='section-head compact-head'>
        <Text className='section-title'>节点状态</Text>
      </View>

      {!nodes.length ? (
        <EmptyState compact title='暂无节点明细' description='运行记录已创建，节点明细稍后同步。' icon='center' />
      ) : (
        <View className='case-grid'>
          {nodes.map((node) => (
            <View key={node.id} className='work-card'>
              <View className='work-body'>
                <View className='meta-row'>
                  <Text className='work-title'>{node.label || node.nodeId}</Text>
                  <View className={node.status === 'failed' ? 'status failed' : 'status'}>
                    <AppIcon name={statusIcon(node.status)} size={11} />
                    <Text>{statusText(node.status)}</Text>
                  </View>
                </View>
                <Text className='tool-desc'>
                  {node.componentKey || 'workflow-node'} · {node.costPoints || 0} 点 · {node.isIntermediateOutput ? '中间结果' : node.isTerminalOutput ? '最终输出' : '流程节点'}
                </Text>
                {node.generationTaskId ? <Text className='tool-desc'>任务：{compactId(node.generationTaskId)}</Text> : null}
                {node.workId ? <Text className='tool-desc'>作品：{compactId(node.workId)}</Text> : null}
                {node.errorMessage ? <Text className='tool-desc'>{node.errorMessage}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </Shell>
  )
}
