import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea, Input } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
import {
  createWorkflowDraft,
  estimateWorkflowDraft,
  fetchTools,
  fetchWorkflowComponents,
  runWorkflowDraft,
  validateWorkflowDraft
} from '../../services/api'
import { goPage } from '../../utils/navigation'
import { isLoggedIn, requireLogin } from '../../utils/storage'

function unique(values) {
  return [...new Set([].concat(values || []).map((value) => String(value || '').trim()).filter(Boolean))]
}

function componentTitle(component) {
  return component.displayName || component.label || component.componentKey || 'Workflow 组件'
}

function componentKind(component) {
  const text = `${component.category || ''} ${component.componentKey || ''} ${component.modelKey || ''} ${component.displayName || ''}`.toLowerCase()
  if (/video|视频|i2v|t2v/.test(text)) return 'video'
  if (/audio|voice|music|音频|音乐/.test(text)) return 'audio'
  if (/image|photo|picture|图像|图片|生图/.test(text)) return 'image'
  return 'utility'
}

function categoryLabel(component) {
  const kind = componentKind(component)
  if (kind === 'video') return '视频'
  if (kind === 'image') return '图像'
  if (kind === 'audio') return '音频'
  return component.category || '通用'
}

function schemaOptions(schema, key) {
  const source = schema || {}
  const field = source.properties?.[key] || source[key]
  const options = Array.isArray(field?.enum)
    ? field.enum
    : Array.isArray(field?.oneOf)
      ? field.oneOf.map((item) => item?.const || item?.value)
      : []
  return unique(options)
}

function ratioOptionsFor(component) {
  const fromMap = Object.keys(component.ratioResolutionMap || {})
  const fromSchema = schemaOptions(component.inputSchema, 'ratio')
  if (fromMap.length) return fromMap
  if (fromSchema.length) return fromSchema
  return componentKind(component) === 'video'
    ? ['16:9', '9:16', '1:1', '4:3', '3:4']
    : ['1:1', '16:9', '9:16', '4:3', '3:4']
}

function defaultRatioFor(component) {
  const ratios = ratioOptionsFor(component)
  const preferred = componentKind(component) === 'video' ? '16:9' : '1:1'
  return ratios.includes(preferred) ? preferred : ratios[0] || preferred
}

function resolutionOptionsFor(component, ratio = defaultRatioFor(component)) {
  const byRatio = component.ratioResolutionMap?.[ratio] || []
  const fromMap = Object.values(component.ratioResolutionMap || {}).flat()
  const fromSchema = schemaOptions(component.inputSchema, 'resolution').concat(schemaOptions(component.inputSchema, 'size'))
  return unique(byRatio.length ? byRatio : fromMap.length ? fromMap : fromSchema.length ? fromSchema : componentKind(component) === 'image' ? ['1024x1024'] : [])
}

function qualityOptionsFor(component) {
  const fromSchema = schemaOptions(component.inputSchema, 'quality').concat(schemaOptions(component.inputSchema, 'resolution'))
  const options = component.videoQualityOptions?.length ? component.videoQualityOptions : fromSchema
  return unique(options.length ? options : componentKind(component) === 'video' ? ['720P'] : [])
}

function resolveToolForComponent(component, tools) {
  const kind = componentKind(component)
  const modelKey = String(component.modelKey || '').toLowerCase()
  return (
    tools.find((tool) => String(tool.id || '').toLowerCase().includes(modelKey) && modelKey) ||
    tools.find((tool) => (tool.outputTypes || []).some((type) => String(type).toLowerCase() === kind)) ||
    tools.find((tool) => String(tool.category || '').toLowerCase().includes(kind)) ||
    tools.find((tool) => String(tool.id || '').toLowerCase().includes(kind)) ||
    tools[0]
  )
}

function stepKey() {
  return `linear_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createStep(component, tools) {
  const kind = componentKind(component)
  const ratio = defaultRatioFor(component)
  const resolutions = resolutionOptionsFor(component, ratio)
  const qualities = qualityOptionsFor(component)
  const tool = resolveToolForComponent(component, tools)
  return {
    key: stepKey(),
    component,
    ratio,
    resolution: kind === 'image' ? resolutions[0] || '1024x1024' : '',
    quality: kind === 'video' ? qualities[0] || '720P' : '',
    toolKey: tool?.id || '',
    modelKey: component.modelKey || ''
  }
}

function exposedFieldsForStep(step) {
  const kind = componentKind(step.component)
  const fields = ['prompt', 'ratio']
  if (kind === 'image') fields.push('resolution')
  if (kind === 'video') fields.push('quality')
  return fields
}

function buildLinearGraph(steps, tools) {
  const nodes = steps.map((step, index) => {
    const component = step.component
    const kind = componentKind(component)
    const tool = step.toolKey
      ? tools.find((item) => item.id === step.toolKey) || resolveToolForComponent(component, tools)
      : resolveToolForComponent(component, tools)
    const params = {
      modelKey: step.modelKey || component.modelKey || '',
      ratio: step.ratio
    }
    if (kind === 'image') params.resolution = step.resolution || resolutionOptionsFor(component, step.ratio)[0] || '1024x1024'
    if (kind === 'video') params.quality = step.quality || qualityOptionsFor(component)[0] || '720P'

    return {
      id: `node_${index + 1}`,
      type: component.componentKey,
      label: componentTitle(component),
      componentKey: component.componentKey,
      toolKey: tool?.id || '',
      modelKey: step.modelKey || component.modelKey || '',
      modeKey: kind === 'video' ? 'text_to_video' : kind === 'image' ? 'text_to_image' : 'utility',
      x: 120,
      y: 120 + index * 150,
      config: {
        componentKey: component.componentKey,
        toolKey: tool?.id || '',
        modelKey: step.modelKey || component.modelKey || '',
        modeKey: kind === 'video' ? 'text_to_video' : kind === 'image' ? 'text_to_image' : 'utility',
        promptTemplate: '{{prompt}}',
        params,
        costPoints: Number(tool?.cost || 5),
        exposedFields: exposedFieldsForStep(step)
      }
    }
  })
  const edges = nodes.slice(1).map((node, index) => ({
    id: `edge_${index + 1}`,
    source: `node_${index + 1}`,
    target: node.id,
    sourceHandle: 'output',
    targetHandle: 'input'
  }))
  return {
    schemaVersion: 'seeFactory.workflow.v1',
    nodes,
    edges
  }
}

function runIdFrom(result) {
  return result?.run?.id || result?.id || result?.runId || ''
}

export default function WorkflowLinear() {
  const loggedIn = isLoggedIn()
  const [components, setComponents] = useState([])
  const [tools, setTools] = useState([])
  const [steps, setSteps] = useState([])
  const [title, setTitle] = useState('我的线性 Workflow')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState('')
  const [estimate, setEstimate] = useState(null)

  const loadResources = () => {
    if (!loggedIn) return () => {}
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchWorkflowComponents({ pageSize: 80, allowedInLinear: true }),
      fetchTools()
    ])
      .then(([componentData, toolList]) => {
        if (!mounted) return
        setComponents(componentData.list || [])
        setTools(toolList || [])
        setError('')
      })
      .catch((err) => {
        if (mounted) setError(err?.message || '线性组件库暂未同步成功。')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    return loadResources()
  }, [loggedIn])

  const graph = useMemo(() => buildLinearGraph(steps, tools), [steps, tools])

  const addComponent = (component) => {
    setSteps((current) => {
      if (current.length >= 8) {
        Taro.showToast({ title: '小程序线性链最多 8 步', icon: 'none' })
        return current
      }
      const next = createStep(component, tools)
      return [...current, next]
    })
    setEstimate(null)
  }

  const removeStep = (key) => {
    setSteps((current) => current.filter((step) => step.key !== key))
    setEstimate(null)
  }

  const moveStep = (key, direction) => {
    setSteps((current) => {
      const index = current.findIndex((step) => step.key === key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
    setEstimate(null)
  }

  const updateStep = (key, patch) => {
    setSteps((current) => current.map((step) => {
      if (step.key !== key) return step
      const next = { ...step, ...patch }
      if (patch.ratio) {
        const resolutions = resolutionOptionsFor(step.component, patch.ratio)
        next.resolution = resolutions.includes(step.resolution) ? step.resolution : resolutions[0] || step.resolution
      }
      return next
    }))
    setEstimate(null)
  }

  const validateBeforeSubmit = () => {
    if (!requireLogin('/pages/workflow-linear/index')) return false
    if (!steps.length) {
      Taro.showToast({ title: '请先添加至少一个组件', icon: 'none' })
      return false
    }
    if (!prompt.trim()) {
      Taro.showToast({ title: '请填写本次运行提示词', icon: 'none' })
      return false
    }
    const missingTool = graph.nodes.find((node) => !node.toolKey)
    if (missingTool) {
      Taro.showModal({
        title: '组件未绑定工具',
        content: `${missingTool.label || missingTool.componentKey} 暂未匹配到可用平台工具，请先在后台配置工具与组件映射。`,
        showCancel: false,
        confirmText: '我知道了'
      })
      return false
    }
    return true
  }

  const saveOrRun = async (shouldRun = false) => {
    if (!validateBeforeSubmit()) return
    setSubmitting(shouldRun ? 'run' : 'save')
    Taro.showLoading({ title: shouldRun ? '提交运行' : '保存草稿' })
    try {
      const payload = {
        title: title.trim() || '我的线性 Workflow',
        description: '由小程序线性拼积木创建，支持顺序运行，不包含自由连线、条件分支或循环。',
        coverUrl: '',
        graph,
        editorMode: 'linear'
      }
      const draft = await createWorkflowDraft(payload)
      const validation = await validateWorkflowDraft(draft.id, graph)
      if (!validation.valid) {
        throw new Error((validation.errors || []).join('；') || 'Workflow 校验未通过')
      }
      const nextEstimate = await estimateWorkflowDraft(draft.id, graph).catch(() => validation)
      setEstimate(nextEstimate)
      if (!shouldRun) {
        Taro.showToast({ title: '草稿已保存', icon: 'success' })
        return
      }
      const runInput = { prompt: prompt.trim() }
      const result = await runWorkflowDraft(draft.id, { input: runInput, params: runInput })
      Taro.showToast({ title: '已提交运行', icon: 'success' })
      const runId = runIdFrom(result)
      if (runId) goPage(`/pages/workflow-runs/detail/index?id=${encodeURIComponent(runId)}`)
    } catch (err) {
      Taro.showModal({
        title: shouldRun ? '运行失败' : '保存失败',
        content: err?.message || '线性 Workflow 暂未处理成功，请稍后重试。',
        showCancel: false,
        confirmText: '我知道了'
      })
    } finally {
      Taro.hideLoading()
      setSubmitting('')
    }
  }

  if (!loggedIn) {
    return (
      <Shell title='线性拼积木' showTab={false} backFallback='/pages/create-center/index'>
        <EmptyState
          title='请先登录'
          description='登录后可从零创建线性 Workflow，并提交运行。'
          icon='lock'
          actionText='前往登录'
          onAction={() => requireLogin('/pages/workflow-linear/index')}
        />
      </Shell>
    )
  }

  return (
    <Shell title='线性拼积木' showTab={false} backFallback='/pages/create-center/index'>
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>Linear Workflow</Text>
            <Text className='section-title'>线性拼积木</Text>
          </View>
        </View>
        <View className='ghost-button glass-button compact' onClick={loadResources}>
          <AppIcon name='refresh' size={14} />
          <Text>刷新</Text>
        </View>
      </View>

      <InlineNotice>
        小程序端只支持顺序拼接组件，不开放自由连线、条件分支、循环或 .seeflow 导入导出。
      </InlineNotice>

      <View className='form-panel'>
        <Text className='input-label'>Workflow 名称</Text>
        <View className='text-input'>
          <Input
            value={title}
            placeholder='例如：商品图到短视频链路'
            placeholderClass='muted'
            onInput={(event) => setTitle(event.detail.value)}
          />
        </View>

        <Text className='input-label'>本次运行提示词</Text>
        <View className='text-area'>
          <Textarea
            value={prompt}
            maxlength={1200}
            placeholder='描述主体、风格、场景和最终想要的输出。这个提示词会传给线性链中的生成节点。'
            placeholderClass='muted'
            onInput={(event) => setPrompt(event.detail.value)}
          />
        </View>
      </View>

      <View className='section-head compact-head'>
        <Text className='section-title'>组件库</Text>
        <Text className='small'>{components.length} 个可用组件</Text>
      </View>

      {loading ? (
        <PageLoading title='正在同步组件库' description='正在读取允许小程序线性拼积木使用的组件。' />
      ) : error ? (
        <ErrorState title='组件库加载失败' description={error} onRetry={loadResources} />
      ) : !components.length ? (
        <EmptyState title='暂无线性组件' description='请先在后台启用允许线性链使用的组件。' icon='fusion' />
      ) : (
        <View className='linear-component-grid'>
          {components.map((component) => (
            <View key={component.id || component.componentKey} className='linear-component-card' onClick={() => addComponent(component)}>
              <View className='profile-icon'><AppIcon name={componentKind(component) === 'video' ? 'video' : componentKind(component) === 'image' ? 'image' : 'fusion'} size={20} /></View>
              <View className='linear-component-copy'>
                <Text className='profile-name'>{componentTitle(component)}</Text>
                <Text className='tool-desc'>{categoryLabel(component)} · {component.modelKey || '默认模型'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View className='section-head compact-head'>
        <Text className='section-title'>运行链路</Text>
        <Text className='small'>{steps.length}/8 步</Text>
      </View>

      {!steps.length ? (
        <EmptyState compact title='还没有组件' description='从上方组件库添加节点，小程序端会按顺序运行。' icon='fusion' />
      ) : (
        <View className='linear-step-list'>
          {steps.map((step, index) => {
            const kind = componentKind(step.component)
            const ratioOptions = ratioOptionsFor(step.component)
            const resolutionOptions = resolutionOptionsFor(step.component, step.ratio)
            const qualityOptions = qualityOptionsFor(step.component)
            return (
              <View key={step.key} className='linear-step-card'>
                <View className='linear-step-head'>
                  <View className='linear-step-index'>{index + 1}</View>
                  <View className='linear-step-copy'>
                    <Text className='work-title'>{componentTitle(step.component)}</Text>
                    <Text className='tool-desc'>{categoryLabel(step.component)} · {step.toolKey || '未匹配工具'}</Text>
                  </View>
                  <View className='status'>
                    <AppIcon name='fusion' size={11} />
                    <Text>{kind === 'video' ? '视频' : kind === 'image' ? '图像' : '通用'}</Text>
                  </View>
                </View>

                <Text className='input-label compact-label'>比例</Text>
                <View className='option-row linear-option-row'>
                  {ratioOptions.map((item) => (
                    <View key={item} className={step.ratio === item ? 'option-chip active' : 'option-chip'} onClick={() => updateStep(step.key, { ratio: item })}>
                      <Text>{item}</Text>
                    </View>
                  ))}
                </View>

                {kind === 'image' && resolutionOptions.length ? (
                  <>
                    <Text className='input-label compact-label'>图像分辨率</Text>
                    <View className='option-row linear-option-row'>
                      {resolutionOptions.map((item) => (
                        <View key={item} className={step.resolution === item ? 'option-chip active' : 'option-chip'} onClick={() => updateStep(step.key, { resolution: item })}>
                          <Text>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {kind === 'video' && qualityOptions.length ? (
                  <>
                    <Text className='input-label compact-label'>视频精度</Text>
                    <View className='option-row linear-option-row'>
                      {qualityOptions.map((item) => (
                        <View key={item} className={step.quality === item ? 'option-chip active' : 'option-chip'} onClick={() => updateStep(step.key, { quality: item })}>
                          <Text>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                <View className='linear-step-actions'>
                  <View className={index === 0 ? 'ghost-button compact disabled' : 'ghost-button compact'} onClick={index === 0 ? undefined : () => moveStep(step.key, -1)}>
                    <Text>上移</Text>
                  </View>
                  <View className={index === steps.length - 1 ? 'ghost-button compact disabled' : 'ghost-button compact'} onClick={index === steps.length - 1 ? undefined : () => moveStep(step.key, 1)}>
                    <Text>下移</Text>
                  </View>
                  <View className='danger-button compact' onClick={() => removeStep(step.key)}>
                    <AppIcon name='delete' size={13} />
                    <Text>移除</Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {estimate ? (
        <InlineNotice>
          预估 {estimate.estimatedPoints || 0} 点，{estimate.nodeEstimates?.length || steps.length} 个生成节点。实际扣点以后端运行结算为准。
        </InlineNotice>
      ) : null}

      <View className='linear-submit-bar'>
        <View className={submitting ? 'ghost-button full-width-button disabled' : 'ghost-button full-width-button'} onClick={submitting ? undefined : () => saveOrRun(false)}>
          <AppIcon name='center' size={15} />
          <Text>{submitting === 'save' ? '保存中...' : '保存草稿'}</Text>
        </View>
        <View className={submitting ? 'primary-button full-width-button disabled' : 'primary-button full-width-button'} onClick={submitting ? undefined : () => saveOrRun(true)}>
          <AppIcon name='play' size={15} />
          <Text>{submitting === 'run' ? '提交中...' : '保存并运行'}</Text>
        </View>
      </View>
    </Shell>
  )
}
