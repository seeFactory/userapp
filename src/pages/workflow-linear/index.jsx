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
  publishWorkflowDraftCase,
  runWorkflowDraft,
  validateWorkflowDraft
} from '../../services/api'
import { useAppConfig } from '../../hooks/useAppConfig'
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

function buildLinearRunForm(steps) {
  const ratios = unique(steps.flatMap((step) => ratioOptionsFor(step.component)))
  const resolutions = unique(steps.filter((step) => componentKind(step.component) === 'image').flatMap((step) => resolutionOptionsFor(step.component, step.ratio)))
  const qualities = unique(steps.filter((step) => componentKind(step.component) === 'video').flatMap((step) => qualityOptionsFor(step.component)))
  const fields = [{
    key: 'prompt',
    label: '提示词',
    type: 'textarea',
    required: true,
    placeholder: '描述你希望这个 Workflow 生成的主体、风格、场景和细节'
  }]
  if (ratios.length) fields.push({ key: 'ratio', label: '比例', type: 'select', options: ratios, defaultValue: ratios[0], required: false })
  if (resolutions.length) fields.push({ key: 'resolution', label: '图像分辨率', type: 'select', options: resolutions, defaultValue: resolutions[0], required: false })
  if (qualities.length) fields.push({ key: 'quality', label: '视频精度', type: 'select', options: qualities, defaultValue: qualities[0], required: false })
  return {
    schemaVersion: 'seeFactory.runForm.v1',
    fields,
    nodes: steps.map((step, index) => ({
      nodeId: `node_${index + 1}`,
      componentKey: step.component.componentKey,
      label: componentTitle(step.component),
      category: componentKind(step.component),
      exposedFields: exposedFieldsForStep(step)
    }))
  }
}

function runIdFrom(result) {
  return result?.run?.id || result?.id || result?.runId || ''
}

function caseIdFromPublishResult(result) {
  return result?.case?.id || result?.caseContent?.id || result?.id || ''
}

function splitTags(text) {
  return unique(String(text || '').split(/[\s,，、#]+/)).slice(0, 12)
}

export default function WorkflowLinear() {
  const loggedIn = isLoggedIn()
  const { config } = useAppConfig()
  const workflowPolicy = config?.workflowPolicy || {}
  const priceMinPoints = Number(workflowPolicy.priceMinPoints || 7)
  const priceMaxPoints = Number(workflowPolicy.priceMaxPoints || 7000)
  const trialLimitMaxPerUser = Math.max(0, Number(workflowPolicy.trialLimitMaxPerUser || 20))
  const [components, setComponents] = useState([])
  const [tools, setTools] = useState([])
  const [steps, setSteps] = useState([])
  const [title, setTitle] = useState('我的 AI 模板')
  const [prompt, setPrompt] = useState('')
  const [publishMode, setPublishMode] = useState('open_free')
  const [publishSummary, setPublishSummary] = useState('')
  const [publishCategory, setPublishCategory] = useState('AI 模板')
  const [publishTags, setPublishTags] = useState('AI 模板')
  const [pricePoints, setPricePoints] = useState(35)
  const [trialEnabled, setTrialEnabled] = useState(true)
  const [trialLimitPerUser, setTrialLimitPerUser] = useState(1)
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
        if (mounted) setError(err?.message || '模板组件暂未同步成功。')
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
        Taro.showToast({ title: 'AI 模板最多 8 个步骤', icon: 'none' })
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

  const validateBeforeSubmit = ({ requirePrompt = false } = {}) => {
    if (!requireLogin('/pages/workflow-linear/index')) return false
    if (!steps.length) {
      Taro.showToast({ title: '请先添加至少一个组件', icon: 'none' })
      return false
    }
    if (requirePrompt && !prompt.trim()) {
      Taro.showToast({ title: '请填写本次运行提示词', icon: 'none' })
      return false
    }
    const missingTool = graph.nodes.find((node) => !node.toolKey)
    if (missingTool) {
      Taro.showModal({
        title: '组件未绑定工具',
        content: `${missingTool.label || missingTool.componentKey} 暂未匹配到可用平台工具，请联系平台完善工具配置。`,
        showCancel: false,
        confirmText: '我知道了'
      })
      return false
    }
    return true
  }

  const createValidatedDraft = async () => {
    const payload = {
      title: title.trim() || '我的 AI 模板',
      description: publishSummary.trim() || '由 AI 模板创建，按顺序运行多个生成步骤。',
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
    return draft
  }

  const saveOrRun = async (shouldRun = false) => {
    if (!validateBeforeSubmit({ requirePrompt: shouldRun })) return
    setSubmitting(shouldRun ? 'run' : 'save')
    Taro.showLoading({ title: shouldRun ? '提交运行' : '保存草稿' })
    try {
      const draft = await createValidatedDraft()
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
        content: err?.message || 'AI 模板暂未处理成功，请稍后重试。',
        showCancel: false,
        confirmText: '我知道了'
      })
    } finally {
      Taro.hideLoading()
      setSubmitting('')
    }
  }

  const publishLinearWorkflow = async () => {
    if (!validateBeforeSubmit({ requirePrompt: false })) return
    const normalizedPrice = Math.max(0, Number(pricePoints || 0))
    const normalizedTrialLimit = Math.max(0, Number(trialLimitPerUser || 0))
    if (publishMode === 'closed_paid' && (normalizedPrice < priceMinPoints || normalizedPrice > priceMaxPoints)) {
      Taro.showToast({ title: `售价需在 ${priceMinPoints}-${priceMaxPoints} 点`, icon: 'none' })
      return
    }
    if (publishMode === 'closed_paid' && normalizedTrialLimit > trialLimitMaxPerUser) {
      Taro.showToast({ title: `试运行最多 ${trialLimitMaxPerUser} 次`, icon: 'none' })
      return
    }
    const confirm = await Taro.showModal({
      title: '确认发布 Workflow',
      content: publishMode === 'closed_paid'
        ? `将发布为闭源付费模板，售价 ${normalizedPrice} 点。购买者仅获得运行权。`
        : '将发布为开源免费模板，其他用户可查看流程结构、克隆并复用。',
      confirmText: '确认发布',
      cancelText: '再检查'
    })
    if (!confirm.confirm) return
    setSubmitting('publish')
    Taro.showLoading({ title: '发布案例' })
    try {
      const draft = await createValidatedDraft()
      const result = await publishWorkflowDraftCase(draft.id, {
        title: title.trim() || '我的 AI 模板',
        summary: publishSummary.trim() || '由 AI 模板发布的创作案例。',
        coverUrl: '',
        tags: splitTags(publishTags),
        category: publishCategory.trim() || 'AI 模板',
        licenseMode: publishMode,
        pricePoints: publishMode === 'closed_paid' ? normalizedPrice : 0,
        runForm: buildLinearRunForm(steps),
        trialEnabled: publishMode === 'closed_paid' && trialEnabled,
        trialLimitPerUser: publishMode === 'closed_paid' && trialEnabled ? normalizedTrialLimit : 0,
        publishAgreementAccepted: true
      })
      Taro.showToast({ title: 'Workflow 已发布', icon: 'success' })
      const caseId = caseIdFromPublishResult(result)
      if (caseId) goPage(`/pages/workflow-cases/index?id=${encodeURIComponent(caseId)}`)
    } catch (err) {
      Taro.showModal({
        title: '发布失败',
        content: err?.message || '线性 Workflow 暂未发布成功，请稍后重试。',
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
      <Shell title='AI模板' showTab={false} backFallback='/pages/create-center/index'>
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
    <Shell title='AI模板' showTab={false} backFallback='/pages/create-center/index'>
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
            <Text className='section-kicker'>Linear Workflow</Text>
            <Text className='section-title'>AI模板</Text>
          </View>
        </View>
        <View className='ghost-button glass-button compact' onClick={loadResources}>
          <AppIcon name='refresh' size={14} />
          <Text>刷新</Text>
        </View>
      </View>

      <InlineNotice>
        当前支持按顺序组合组件，暂不开放分支、循环或文件导入导出。
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
        <PageLoading title='正在同步组件库' description='正在读取可用于 AI 模板的组件。' />
      ) : error ? (
        <ErrorState title='组件库加载失败' description={error} onRetry={loadResources} />
      ) : !components.length ? (
        <EmptyState title='暂无可用组件' description='组件上线后会显示在这里。' icon='fusion' />
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
          预估 {estimate.estimatedPoints || 0} 点，{estimate.nodeEstimates?.length || steps.length} 个生成节点。实际扣点以生成完成后的结算为准。
        </InlineNotice>
      ) : null}

      <View className='form-panel'>
        <Text className='input-label'>发布模式</Text>
        <View className='option-row linear-option-row'>
          <View className={publishMode === 'open_free' ? 'option-chip active' : 'option-chip'} onClick={() => setPublishMode('open_free')}>
            <Text>开源免费</Text>
          </View>
          <View className={publishMode === 'closed_paid' ? 'option-chip active' : 'option-chip'} onClick={() => setPublishMode('closed_paid')}>
            <Text>闭源付费</Text>
          </View>
        </View>

        <Text className='input-label compact-label'>案例摘要</Text>
        <View className='text-area'>
          <Textarea
            value={publishSummary}
            maxlength={240}
            placeholder='写给其他用户看的模板说明，例如适合什么素材、会生成什么结果。'
            placeholderClass='muted'
            onInput={(event) => setPublishSummary(event.detail.value)}
          />
        </View>

        <Text className='input-label compact-label'>分类</Text>
        <View className='text-input'>
          <Input
            value={publishCategory}
            placeholder='例如：商品营销、头像写真、短视频脚本'
            placeholderClass='muted'
            onInput={(event) => setPublishCategory(event.detail.value)}
          />
        </View>

        <Text className='input-label compact-label'>标签</Text>
        <View className='text-input'>
          <Input
            value={publishTags}
            placeholder='用空格或逗号分隔，例如：电商 海报 视频'
            placeholderClass='muted'
            onInput={(event) => setPublishTags(event.detail.value)}
          />
        </View>

        {publishMode === 'closed_paid' ? (
          <>
            <Text className='input-label compact-label'>模板售价</Text>
            <View className='text-input'>
              <Input
                type='number'
                value={String(pricePoints)}
                placeholder={`${priceMinPoints}-${priceMaxPoints} 点，以平台规则为准`}
                placeholderClass='muted'
                onInput={(event) => setPricePoints(Number(event.detail.value || 0))}
              />
            </View>

            <Text className='input-label compact-label'>购买前试运行</Text>
            <View className='option-row linear-option-row'>
              <View className={trialEnabled ? 'option-chip active' : 'option-chip'} onClick={() => setTrialEnabled(true)}>
                <Text>开放</Text>
              </View>
              <View className={!trialEnabled ? 'option-chip active' : 'option-chip'} onClick={() => setTrialEnabled(false)}>
                <Text>不开放</Text>
              </View>
            </View>

            {trialEnabled ? (
              <>
                <Text className='input-label compact-label'>每人试运行次数</Text>
                <View className='text-input'>
                  <Input
                    type='number'
                    value={String(trialLimitPerUser)}
                    placeholder={`最多 ${trialLimitMaxPerUser} 次`}
                    placeholderClass='muted'
                    onInput={(event) => setTrialLimitPerUser(Number(event.detail.value || 0))}
                  />
                </View>
              </>
            ) : null}
          </>
        ) : null}

        <InlineNotice tone={publishMode === 'closed_paid' ? 'warning' : 'info'}>
          {publishMode === 'closed_paid'
            ? '闭源付费发布后购买者只获得运行权，不会看到流程结构、节点提示词或导出文件。'
            : '开源免费发布后将公开流程结构、节点提示词和公开参数，并允许其他用户克隆。'}
        </InlineNotice>
      </View>

      <View className='linear-submit-bar'>
        <View className={submitting ? 'ghost-button full-width-button disabled' : 'ghost-button full-width-button'} onClick={submitting ? undefined : () => saveOrRun(false)}>
          <AppIcon name='center' size={15} />
          <Text>{submitting === 'save' ? '保存中...' : '保存草稿'}</Text>
        </View>
        <View className={submitting ? 'primary-button full-width-button disabled' : 'primary-button full-width-button'} onClick={submitting ? undefined : () => saveOrRun(true)}>
          <AppIcon name='play' size={15} />
          <Text>{submitting === 'run' ? '提交中...' : '保存并运行'}</Text>
        </View>
        <View className={submitting ? 'primary-button full-width-button linear-publish-action disabled' : 'primary-button full-width-button linear-publish-action'} onClick={submitting ? undefined : publishLinearWorkflow}>
          <AppIcon name='badge' size={15} />
          <Text>{submitting === 'publish' ? '发布中...' : '保存并发布'}</Text>
        </View>
      </View>
    </Shell>
  )
}
