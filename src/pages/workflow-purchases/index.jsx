import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Input, Picker, Switch, Textarea } from '@tarojs/components'
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

function canRunWorkflowPurchase(item) {
  if (item?.canRun !== undefined) return Boolean(item.canRun)
  if (item?.runnable !== undefined) return Boolean(item.runnable)
  return item?.status !== 'disabled' && item?.disabled !== true
}

function workflowBlockedReason(item) {
  return item?.runBlockedReason || item?.disabledReason || ''
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

function runFormOf(item) {
  return item?.case?.runForm || item?.version?.runForm || {}
}

function workflowRunFields(runForm) {
  return Array.isArray(runForm?.fields)
    ? runForm.fields.filter((field) => field && String(field.key || '').trim())
    : []
}

function fieldLabel(field) {
  return field.label || field.title || field.name || field.key
}

function fieldType(field) {
  const raw = String(field.type || field.component || field.inputType || '').toLowerCase()
  if (raw === 'checkbox') return 'boolean'
  if (raw === 'select' || raw === 'radio') return 'select'
  if (raw === 'textarea' || raw === 'prompt') return 'textarea'
  if (raw === 'number' || raw === 'integer') return 'number'
  return raw || 'text'
}

function fieldOptions(field) {
  const source = Array.isArray(field.options)
    ? field.options
    : Array.isArray(field.enum)
      ? field.enum
      : Array.isArray(field.choices)
        ? field.choices
        : []
  return source.map((item) => {
    if (item && typeof item === 'object') {
      const value = String(item.value ?? item.key ?? item.id ?? item.label ?? '')
      return { label: String(item.label ?? item.name ?? value), value }
    }
    return { label: String(item), value: String(item) }
  }).filter((item) => item.value)
}

function isUnsupportedRunField(field) {
  const type = fieldType(field)
  const key = String(field.key || '').toLowerCase()
  return ['upload', 'file', 'image', 'video', 'audio', 'asset'].some((token) => type.includes(token) || key.includes(token))
}

function defaultRunValue(field) {
  if (field.defaultValue !== undefined) return field.defaultValue
  if (field.default !== undefined) return field.default
  if (fieldType(field) === 'boolean') return false
  const options = fieldOptions(field)
  if (options.length && field.required) return options[0].value
  return ''
}

function initialWorkflowRunValues(runForm) {
  return workflowRunFields(runForm).reduce((values, field) => ({
    ...values,
    [field.key]: defaultRunValue(field)
  }), {})
}

function normalizeRunValue(field, value) {
  if (fieldType(field) === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : ''
  }
  if (fieldType(field) === 'boolean') return Boolean(value)
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  return typeof value === 'string' ? value.trim() : value ?? ''
}

function buildWorkflowRunPayload(runForm, values = {}) {
  const input = {}
  const params = {}
  for (const field of workflowRunFields(runForm)) {
    if (isUnsupportedRunField(field)) {
      if (field.required) {
        return {
          ok: false,
          message: `${fieldLabel(field)} 需要素材上传，请到 PC Dashboard 运行该模板。`
        }
      }
      continue
    }
    const value = normalizeRunValue(field, values[field.key])
    const empty = value === '' || value === undefined || value === null || (Array.isArray(value) && value.length === 0)
    if (field.required && empty) {
      return { ok: false, message: `请填写 ${fieldLabel(field)}。` }
    }
    if (empty && fieldType(field) !== 'boolean') continue
    input[field.key] = value
    if (field.key !== 'prompt') params[field.key] = value
  }
  return { ok: true, payload: { input, params } }
}

function WorkflowRunFormFields({ runForm, values, disabled, onChange }) {
  const fields = workflowRunFields(runForm)
  if (!fields.length) {
    return <InlineNotice>该模板没有开放可调运行参数，将使用作者发布时锁定的默认参数。</InlineNotice>
  }
  return (
    <View className='workflow-run-form'>
      {fields.map((field) => {
        const type = fieldType(field)
        const label = fieldLabel(field)
        const value = values[field.key] ?? defaultRunValue(field)
        const options = fieldOptions(field)
        if (isUnsupportedRunField(field)) {
          return (
            <View key={field.key} className='workflow-run-field'>
              <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
              <InlineNotice tone={field.required ? 'warning' : 'info'}>小程序暂不支持该素材字段，请到 PC Dashboard 运行需要上传素材的模板。</InlineNotice>
            </View>
          )
        }
        if (type === 'boolean') {
          return (
            <View key={field.key} className='workflow-run-switch-field'>
              <View>
                <Text className='input-label'>{label}</Text>
                {field.help ? <Text className='tool-desc'>{field.help}</Text> : null}
              </View>
              <Switch checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(field.key, event.detail.value)} />
            </View>
          )
        }
        if (type === 'select' || options.length) {
          const selectedIndex = options.findIndex((option) => option.value === String(value))
          const pickerIndex = Math.max(0, selectedIndex)
          const selectedLabel = selectedIndex >= 0 ? options[selectedIndex]?.label : field.placeholder || '请选择'
          return (
            <View key={field.key} className='workflow-run-field'>
              <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
              <Picker
                mode='selector'
                range={options.map((option) => option.label)}
                value={pickerIndex}
                disabled={disabled}
                onChange={(event) => onChange(field.key, options[Number(event.detail.value)]?.value || '')}
              >
                <View className='workflow-run-picker'>
                  <Text className='workflow-run-picker-value'>{selectedLabel}</Text>
                  <Text className='workflow-run-picker-action'>选择</Text>
                </View>
              </Picker>
              {field.help ? <Text className='tool-desc'>{field.help}</Text> : null}
            </View>
          )
        }
        if (type === 'textarea') {
          return (
            <View key={field.key} className='workflow-run-field'>
              <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
              <Textarea
                value={String(value || '')}
                disabled={disabled}
                maxlength={Number(field.maxLength || 1200)}
                placeholder={field.placeholder || '请输入运行参数'}
                onInput={(event) => onChange(field.key, event.detail.value)}
              />
              {field.help ? <Text className='tool-desc'>{field.help}</Text> : null}
            </View>
          )
        }
        return (
          <View key={field.key} className='workflow-run-field'>
            <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
            <Input
              type={type === 'number' ? 'number' : 'text'}
              value={String(value ?? '')}
              disabled={disabled}
              placeholder={field.placeholder || '请输入运行参数'}
              onInput={(event) => onChange(field.key, event.detail.value)}
            />
            {field.help ? <Text className='tool-desc'>{field.help}</Text> : null}
          </View>
        )
      })}
    </View>
  )
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
                    <Text>{item.pricePoints || 0} 点 · {formatDate(item.purchasedAt)}</Text>
                  </View>
                  <View className={!canRunWorkflowPurchase(item) ? 'status failed' : 'status'}>
                    <AppIcon name={!canRunWorkflowPurchase(item) ? 'alert' : 'badge'} size={11} />
                    <Text>{statusText(item)}</Text>
                  </View>
                </View>
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
