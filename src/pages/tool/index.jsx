import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Textarea, Image, Video } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { EmptyState, ErrorState, InlineNotice, PageLoading } from '../../components/PageState'
import PaymentSheet from '../../components/PaymentSheet'
import { firstCryptoRoute } from '../../components/CryptoRoutePicker'
import { isFeatureEnabled, useAppConfig } from '../../hooks/useAppConfig'
import { isPlatformPaymentRuntime, isTelegramStarsRuntime } from '../../platform/payment'
import { goPage } from '../../utils/navigation'
import { chooseTypedFiles, formatFileSize, uploadLimits, uploadToOss, validateUploadFile } from '../../utils/upload'
import {
  createAsset,
  createCryptoOrder,
  createGenerationPaymentOrder,
  createGenerationTask,
  createPlatformPaymentOrder,
  createTelegramStarsOrder,
  fetchCryptoOrder,
  fetchPaymentOrder,
  fetchTelegramStarsOrder,
  fetchTool,
  fetchWalletRechargeOptions,
  getClientRuntime,
  getUploadToken
} from '../../services/api'
import { requireLogin } from '../../utils/storage'

const defaultStyles = ['电影质感', '商业摄影', '品牌漫画', '潮流海报']
const defaultRatios = ['1:1', '3:4', '9:16', '16:9']
const defaultResolutions = ['1024x1024', '1024x1365', '1024x1792', '1792x1024']
const defaultDurations = ['5 秒', '8 秒', '12 秒']
const defaultModels = []

function firstValue(list) {
  return list[0]
}

function fallbackTool(id) {
  return {
    id: id || 'factory-painter',
    name: 'AI 创作工具',
    label: '工具',
    desc: '正在同步工具参数。',
    cost: 0,
    fields: ['prompt', 'style', 'ratio', 'resolution', 'model'],
    options: {}
  }
}

function optionList(tool, key, fallback) {
  const list = tool?.options?.[key]
  return Array.isArray(list) && list.length ? list : fallback
}

function normalizeResolution(value = '') {
  const match = String(value).trim().toLowerCase().replace(/[×*]/g, 'x').match(/^(\d{2,5})x(\d{2,5})$/)
  if (!match) {
    const quality = String(value).trim().toLowerCase().match(/^(480|720|1080)p$/)
    return quality ? `${quality[1]}P` : ''
  }
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return ''
  return `${Math.floor(width)}x${Math.floor(height)}`
}

function ratioValue(value = '') {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) return 0
  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? width / height : 0
}

function ratioFrameClass(value = '') {
  const key = String(value).trim().replace(':', '-')
  if (['4-3', '3-4', '16-9', '9-16', '1-1'].includes(key)) {
    return `ratio-frame ratio-${key}`
  }
  return 'ratio-frame ratio-1-1'
}

function resolutionRatio(value = '') {
  const normalized = normalizeResolution(value)
  if (!normalized || !normalized.includes('x')) return 0
  const [width, height] = normalized.split('x').map(Number)
  return width / height
}

function resolutionTolerance(tool) {
  const optionValue = Number(tool?.options?.ratioTolerance)
  return Number.isFinite(optionValue) && optionValue > 0 ? optionValue : 0.04
}

function uniqueValues(list) {
  return Array.from(new Set((list || []).filter(Boolean)))
}

function resolutionOptionsForRatio(tool, ratio, fallback) {
  const all = optionList(tool, 'resolutions', fallback).map(normalizeResolution).filter(Boolean)
  const map = tool?.options?.ratioResolutionMap || tool?.options?.ratioResolutions
  const mapped = map && ratio && Array.isArray(map[ratio])
    ? map[ratio].map(normalizeResolution).filter(Boolean)
    : []
  if (mapped.length) return uniqueValues(mapped)
  if (all.some((item) => !item.includes('x'))) return all
  const expected = ratioValue(ratio)
  if (!expected) return all
  return uniqueValues(all.filter((item) => {
    const actual = resolutionRatio(item)
    return actual && Math.abs(expected - actual) / expected <= resolutionTolerance(tool)
  }))
}

function nextSelected(tool, key, fallback, current) {
  const list = optionList(tool, key, fallback)
  return list.includes(current) ? current : firstValue(list)
}

function nextResolution(tool, ratio, current) {
  const list = resolutionOptionsForRatio(tool, ratio, defaultResolutions)
  const normalized = normalizeResolution(current)
  if (list.includes(normalized)) return normalized
  const configuredDefault = normalizeResolution(tool?.options?.defaultResolution)
  if (configuredDefault && list.includes(configuredDefault)) return configuredDefault
  return firstValue(list) || ''
}

function isVideoTool(tool) {
  const category = String(tool?.category || '').toLowerCase()
  if (category === 'video') return true
  return optionList(tool, 'resolutions', []).some((item) => /^[0-9]+p$/i.test(String(item).trim()))
}

function inferUploadConfig(tool) {
  const fields = tool?.fields || []
  const text = `${tool?.id || ''} ${tool?.category || ''} ${tool?.name || ''}`.toLowerCase()
  if (fields.includes('multiUpload')) {
    return {
      acceptTypes: ['image'],
      maxCount: 6,
      minCount: 2,
      label: '参考素材，多图融合',
      actionText: '点击添加图片素材',
      tip: '支持 JPG / PNG / WebP，单张最大 20 MB，至少 2 张，最多 6 张'
    }
  }
  if (text.includes('audio') || text.includes('音')) {
    return {
      acceptTypes: ['audio', 'video', 'image'],
      maxCount: 1,
      minCount: 1,
      label: '音视频素材',
      actionText: '点击添加音频 / 视频 / 图片素材',
      tip: '支持音频、视频或图片素材；音频最大 100 MB，视频最大 500 MB，图片最大 20 MB'
    }
  }
  if (text.includes('image-to-video') || text.includes('图生') || text.includes('portrait') || text.includes('头像') || text.includes('写真')) {
    return {
      acceptTypes: ['image'],
      maxCount: 1,
      minCount: 1,
      label: '参考图片',
      actionText: '点击添加图片素材',
      tip: uploadLimits.image.tip
    }
  }
  if (text.includes('video') || text.includes('视频')) {
    return {
      acceptTypes: ['video', 'image'],
      maxCount: 1,
      minCount: 1,
      label: '参考素材',
      actionText: '点击添加视频 / 图片素材',
      tip: '支持视频或图片素材；视频最大 500 MB，图片最大 20 MB'
    }
  }
  return {
    acceptTypes: ['image'],
    maxCount: 1,
    minCount: 1,
    label: '参考素材',
    actionText: '点击添加图片素材',
    tip: uploadLimits.image.tip
  }
}

function listOf(value) {
  return [].concat(value || []).map((item) => String(item || '').trim()).filter(Boolean)
}

function modeKeyOf(mode) {
  return String(mode?.modeKey || mode?.key || mode?.id || '').trim()
}

function enabledModes(tool) {
  return Array.isArray(tool?.modes) ? tool.modes.filter((mode) => mode && mode.enabled !== false) : []
}

function modeForKey(tool, key) {
  const modes = enabledModes(tool)
  if (!modes.length) return null
  const requested = String(key || '').trim()
  if (requested) return modes.find((mode) => modeKeyOf(mode) === requested) || modes[0]
  return modes.find((mode) => mode.default) || modes[0]
}

function fieldsForMode(tool, mode) {
  const fields = Array.isArray(mode?.fields) ? mode.fields : tool?.fields
  return Array.isArray(fields) ? fields : []
}

function toolWithMode(tool, mode) {
  if (!mode) return tool
  const modeModelOptions = {}
  const allowedModels = listOf(mode.allowedModels)
  if (allowedModels.length) modeModelOptions.models = allowedModels
  if (mode.defaultModelKey) modeModelOptions.defaultModelKey = mode.defaultModelKey
  return {
    ...tool,
    fields: fieldsForMode(tool, mode),
    options: {
      ...(tool?.options || {}),
      ...modeModelOptions,
      ...(mode?.options || {})
    },
    cost: mode.costPoints ?? mode.cost ?? tool?.cost
  }
}

function slotsForMode(tool, mode) {
  const slots = Array.isArray(mode?.assetSlots) ? mode.assetSlots : Array.isArray(tool?.assetSlots) ? tool.assetSlots : []
  return slots
    .map((slot) => ({ ...slot, slotKey: String(slot?.slotKey || slot?.key || slot?.name || '').trim() }))
    .filter((slot) => slot.slotKey)
}

function slotMinCount(slot) {
  if (slot.required === false) return Number(slot.minCount ?? slot.min ?? 0) || 0
  return Math.max(1, Number(slot.minCount ?? slot.min ?? 1) || 1)
}

function slotMaxCount(slot) {
  const fallback = slot.multiple ? 6 : 1
  return Math.max(slotMinCount(slot), Number(slot.maxCount ?? slot.max ?? fallback) || fallback)
}

function slotUploadConfig(slot) {
  const acceptTypes = listOf(slot.acceptTypes || slot.types || slot.type).map((type) => type.toLowerCase())
  const primaryType = acceptTypes[0] || 'image'
  const limit = uploadLimits[primaryType] || uploadLimits.image
  return {
    acceptTypes: acceptTypes.length ? acceptTypes : ['image'],
    maxCount: slotMaxCount(slot),
    minCount: slotMinCount(slot),
    label: slot.label || slot.name || '参考素材',
    actionText: `点击添加${slot.label || slot.name || limit.label}`,
    tip: slot.tip || limit.tip
  }
}

function fieldError(errors, field) {
  if (!errors) return ''
  if (errors[field]) return errors[field]
  const nestedKey = Object.keys(errors).find((key) => key === field || key.startsWith(`${field}.`))
  return nestedKey ? errors[nestedKey] : ''
}

function mergeFieldError(errors, field, message) {
  return {
    ...(errors || {}),
    [field]: message
  }
}

export default function ToolPage() {
  const params = getCurrentInstance().router?.params || {}
  const [tool, setTool] = useState(fallbackTool(params.id))
  const [prompt, setPrompt] = useState(params.prompt ? decodeURIComponent(params.prompt) : '')
  const [style, setStyle] = useState(firstValue(defaultStyles))
  const [ratio, setRatio] = useState('9:16')
  const [resolution, setResolution] = useState('1024x1792')
  const [duration, setDuration] = useState(firstValue(defaultDurations))
  const [model, setModel] = useState(firstValue(defaultModels))
  const [activeModeKey, setActiveModeKey] = useState('')
  const [uploadItems, setUploadItems] = useState([])
  const [slotUploadItems, setSlotUploadItems] = useState({})
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [payment, setPayment] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [toolLoading, setToolLoading] = useState(true)
  const [toolError, setToolError] = useState('')
  const { config, loading: configLoading } = useAppConfig()
  const generationEnabled = isFeatureEnabled(config, 'generation')

  const loadTool = () => {
    if (configLoading) {
      setToolLoading(true)
      return () => {}
    }
    if (!generationEnabled) {
      setToolLoading(false)
      setToolError('')
      return () => {}
    }
    let mounted = true
    setToolLoading(true)
    fetchTool(params.id)
      .then((data) => {
        if (!mounted) return
        if (!data) {
          setToolError('工具配置不存在或已下架，请稍后重试。')
          return
        }
        setTool(data)
        const nextMode = modeForKey(data)
        setActiveModeKey(nextMode ? modeKeyOf(nextMode) : '')
        setUploadItems([])
        setSlotUploadItems({})
        setStyle((current) => nextSelected(data, 'styles', defaultStyles, current))
        setRatio((current) => {
          const nextRatio = nextSelected(data, 'ratios', defaultRatios, current)
          setResolution((resolutionValue) => nextResolution(data, nextRatio, resolutionValue))
          return nextRatio
        })
        setDuration((current) => nextSelected(data, 'durations', defaultDurations, current))
        setModel((current) => nextSelected(data, 'models', defaultModels, current))
        setToolError('')
      })
      .catch((error) => {
        if (mounted) setToolError(error.message || '工具配置暂未同步，请稍后重试。')
      })
      .finally(() => mounted && setToolLoading(false))
    return () => {
      mounted = false
    }
  }

  useEffect(() => {
    const cleanup = loadTool()
    return cleanup
  }, [params.id, configLoading, generationEnabled])

  useEffect(() => {
    setResolution((current) => nextResolution(tool, ratio, current))
  }, [tool, ratio])

  const availableModes = enabledModes(tool)
  const activeMode = modeForKey(tool, activeModeKey)
  const activeTool = toolWithMode(tool, activeMode)
  const activeFields = fieldsForMode(tool, activeMode)
  const assetSlots = slotsForMode(tool, activeMode)
  const usesAssetSlots = assetSlots.length > 0
  const needs = (field) => activeFields.includes(field)
  const styleOptions = optionList(activeTool, 'styles', defaultStyles)
  const ratioOptions = optionList(activeTool, 'ratios', defaultRatios)
  const resolutionOptions = resolutionOptionsForRatio(activeTool, ratio, defaultResolutions)
  const durationOptions = optionList(activeTool, 'durations', defaultDurations)
  const modelOptions = optionList(activeTool, 'models', defaultModels)
  const normalizedResolution = normalizeResolution(resolution)
  const selectedResolution = resolutionOptions.includes(normalizedResolution) ? normalizedResolution : ''
  const effectiveResolution = selectedResolution || firstValue(resolutionOptions) || normalizedResolution
  const resolutionLabel = isVideoTool(activeTool) ? '精度' : '分辨率'
  const uploadConfig = inferUploadConfig(activeTool)
  const inputAssets = usesAssetSlots
    ? Object.fromEntries(assetSlots.map((slot) => [
      slot.slotKey,
      (slotUploadItems[slot.slotKey] || []).filter((item) => item.status === 'ready' && item.assetId).map((item) => item.assetId)
    ]))
    : {}
  const assetIds = usesAssetSlots
    ? Object.values(inputAssets).flat()
    : uploadItems.filter((item) => item.status === 'ready' && item.assetId).map((item) => item.assetId)
  const uploaded = usesAssetSlots
    ? assetSlots.every((slot) => (inputAssets[slot.slotKey] || []).length >= slotMinCount(slot))
    : assetIds.length > 0

  if (!generationEnabled) {
    return (
      <Shell title='创作工具' showTab={false} onRefresh={loadTool}>
        <EmptyState title='生成服务已关闭' description='生成服务暂未开放，请稍后再试。' icon='wand' />
      </Shell>
    )
  }

  if (toolLoading) {
    return (
      <Shell title='创作工具' showTab={false} onRefresh={loadTool}>
        <PageLoading title='正在同步工具配置' description='正在读取工具字段、模型、比例和素材规则。' />
      </Shell>
    )
  }

  if (toolError) {
    return (
      <Shell title='创作工具' showTab={false} onRefresh={loadTool}>
        <ErrorState title='工具配置加载失败' description={toolError} onRetry={loadTool} />
      </Shell>
    )
  }

  const updateUploadItem = (key, patch, slotKey = '') => {
    if (slotKey) {
      setSlotUploadItems((prev) => ({
        ...prev,
        [slotKey]: (prev[slotKey] || []).map((item) => (item.key === key ? { ...item, ...patch } : item))
      }))
      return
    }
    setUploadItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  const clearFieldError = (field) => {
    setFormErrors((current) => {
      if (!current || !Object.keys(current).length) return current
      const next = { ...current }
      Object.keys(next).forEach((key) => {
        if (key === field || key.startsWith(`${field}.`)) delete next[key]
      })
      return next
    })
  }

  const removeUploadItem = (key, slotKey = '') => {
    if (uploading) return
    clearFieldError(slotKey ? `inputAssets.${slotKey}` : 'inputAssetIds')
    if (slotKey) {
      setSlotUploadItems((prev) => ({
        ...prev,
        [slotKey]: (prev[slotKey] || []).filter((item) => item.key !== key)
      }))
      return
    }
    setUploadItems((prev) => prev.filter((item) => item.key !== key))
  }

  const updatePaymentCryptoRoute = (route) => {
    setPayment((current) => current ? { ...current, cryptoRoute: route } : current)
  }

  const createPaymentCryptoOrder = async (route) => {
    if (!payment?.order?.id || payment.cryptoCreating) return
    setPayment((current) => current ? { ...current, cryptoCreating: true } : current)
    Taro.showLoading({ title: '创建 Crypto 支付' })
    try {
      const cryptoOrder = await createCryptoOrder({
        paymentOrderId: payment.order.id,
        chainName: route.chain,
        token: route.token
      })
      setPayment((current) => current ? {
        ...current,
        cryptoOrder,
        cryptoOrderRequired: false,
        cryptoCreating: false
      } : current)
      Taro.showToast({ title: '打币订单已创建', icon: 'success' })
    } catch (error) {
      setPayment((current) => current ? { ...current, cryptoCreating: false } : current)
      Taro.showToast({ title: error.message || 'Crypto 支付创建失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const chooseUpload = async (slot = null) => {
    if (uploading) return
    if (!requireLogin(`/pages/tool/index?id=${tool.id}`)) return
    const slotKey = slot?.slotKey || ''
    const currentUploadConfig = slot ? slotUploadConfig(slot) : uploadConfig
    const sourceItems = slotKey ? (slotUploadItems[slotKey] || []) : uploadItems
    const existingCount = currentUploadConfig.maxCount === 1 ? 0 : sourceItems.filter((item) => item.status !== 'failed').length
    const remaining = currentUploadConfig.maxCount - existingCount
    if (remaining <= 0) {
      Taro.showToast({ title: `最多上传 ${currentUploadConfig.maxCount} 个素材`, icon: 'none' })
      return
    }
    setUploading(true)
    try {
      const files = await chooseTypedFiles({ ...currentUploadConfig, maxCount: remaining })
      clearFieldError(slotKey ? `inputAssets.${slotKey}` : 'inputAssetIds')
      const validFiles = []
      const invalidMessages = []
      files.forEach((file) => {
        const message = validateUploadFile(file, currentUploadConfig, '当前工具')
        if (message) {
          invalidMessages.push(`${file.name}：${message}`)
          return
        }
        validFiles.push(file)
      })
      if (invalidMessages.length) {
        Taro.showModal({
          title: '素材不符合要求',
          content: invalidMessages.slice(0, 3).join('\n'),
          showCancel: false
        })
      }
      if (!validFiles.length) return
      const pendingItems = validFiles.map((file) => ({
        ...file,
        status: 'pending',
        progress: 0,
        message: '等待上传'
      }))
      if (slotKey) {
        setSlotUploadItems((prev) => ({
          ...prev,
          [slotKey]: currentUploadConfig.maxCount === 1 ? pendingItems : (prev[slotKey] || []).concat(pendingItems)
        }))
      } else {
        setUploadItems((prev) => (currentUploadConfig.maxCount === 1 ? pendingItems : prev.concat(pendingItems)))
      }
      Taro.showLoading({ title: '上传素材' })
      let successCount = 0
      for (const file of pendingItems) {
        try {
          updateUploadItem(file.key, { status: 'uploading', progress: 5, message: '上传中' }, slotKey)
          const policy = await getUploadToken({
            type: file.type,
            filename: file.name,
            mimeType: file.mimeType,
            size: file.size
          })
          if (policy.configured) {
            await uploadToOss(policy, file, (progress) => updateUploadItem(file.key, { progress }, slotKey))
          }
          updateUploadItem(file.key, { progress: 96, message: '写入素材记录' }, slotKey)
          const asset = await createAsset({
            type: file.type,
            url: policy.publicUrl,
            ossKey: policy.ossKey,
            mimeType: file.mimeType,
            size: file.size
          })
          successCount += 1
          updateUploadItem(file.key, {
            assetId: asset.id,
            remoteUrl: policy.publicUrl,
            status: 'ready',
            progress: 100,
            message: '已上传'
          }, slotKey)
        } catch (error) {
          updateUploadItem(file.key, {
            status: 'failed',
            progress: 0,
            message: error.message || '上传失败'
          }, slotKey)
        }
      }
      Taro.showToast({ title: successCount ? `已上传 ${successCount} 个素材` : '素材上传失败', icon: successCount ? 'success' : 'none' })
    } catch (error) {
      Taro.showToast({ title: error.message || '素材添加失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setUploading(false)
    }
  }

  const beginGenerationPayment = async () => {
    const clientRuntime = getClientRuntime()
    Taro.showLoading({ title: '创建支付' })
    try {
      const paymentPayload = await createGenerationPaymentOrder({
        toolKey: tool.id,
        modeKey: activeMode ? modeKeyOf(activeMode) : undefined,
        modelKey: model,
        prompt,
        params: { style, ratio, resolution: effectiveResolution, size: effectiveResolution, duration, model, count: 1 },
        ...(usesAssetSlots ? { inputAssets } : { inputAssetIds: assetIds }),
        clientRuntime
      })
      const order = paymentPayload.order
      const nextPayment = { order, runtime: clientRuntime, afterPaid: 'generate' }
      if (isTelegramStarsRuntime(clientRuntime)) {
        nextPayment.starsOrder = await createTelegramStarsOrder({ paymentOrderId: order.id })
      } else if (isPlatformPaymentRuntime(clientRuntime)) {
        nextPayment.platformPayment = await createPlatformPaymentOrder({ paymentOrderId: order.id })
      } else {
        const cryptoOptions = await fetchWalletRechargeOptions()
        nextPayment.cryptoOrderRequired = true
        nextPayment.cryptoOptions = cryptoOptions
        nextPayment.cryptoRoute = firstCryptoRoute(cryptoOptions.chains || [])
      }
      setPayment(nextPayment)
      Taro.showToast({
        title: nextPayment.cryptoOrderRequired ? '请选择支付链并创建订单' : '请完成支付后刷新状态',
        icon: 'none'
      })
    } catch (error) {
      if (error?.action === 'login' || error?.statusCode === 401) {
        Taro.showToast({ title: '请重新登录后再创建订单', icon: 'none' })
        return
      }
      Taro.showToast({ title: error.message || '创建支付失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const refreshPayment = async () => {
    if (!payment?.order?.id) return
    Taro.showLoading({ title: '刷新状态' })
    try {
      const nextPayment = { ...payment }
      if (payment.cryptoOrder?.id) {
        nextPayment.cryptoOrder = await fetchCryptoOrder(payment.cryptoOrder.id)
      }
      if (payment.starsOrder?.id) {
        nextPayment.starsOrder = await fetchTelegramStarsOrder(payment.starsOrder.id)
      }
      const order = await fetchPaymentOrder(payment.order.id)
      nextPayment.order = order
      setPayment(nextPayment)
      if (order.status === 'paid') {
        setPayment(null)
        Taro.showToast({ title: '支付完成，继续生成', icon: 'success' })
        setTimeout(() => submit(), 300)
      } else {
        Taro.showToast({ title: '订单仍在处理中', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: error.message || '状态刷新失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const submit = async () => {
    if (busy) return
    if (!generationEnabled) {
      Taro.showToast({ title: '生成服务暂未开放', icon: 'none' })
      return
    }
    if (!requireLogin(`/pages/tool/index?id=${tool.id}`)) return
    let nextErrors = {}
    if (!prompt.trim()) {
      nextErrors = mergeFieldError(nextErrors, 'prompt', '请输入提示词')
      setFormErrors(nextErrors)
      Taro.showToast({ title: '请输入提示词', icon: 'none' })
      return
    }
    if (usesAssetSlots) {
      for (const slot of assetSlots) {
        const count = (inputAssets[slot.slotKey] || []).length
        const min = slotMinCount(slot)
        if (count < min) {
          const message = `请添加${slot.label || slot.name || '参考素材'}`
          nextErrors = mergeFieldError(nextErrors, `inputAssets.${slot.slotKey}`, message)
          setFormErrors(nextErrors)
          Taro.showToast({ title: message, icon: 'none' })
          return
        }
      }
    }
    if (!usesAssetSlots && (needs('upload') || needs('multiUpload')) && !uploaded) {
      nextErrors = mergeFieldError(nextErrors, 'inputAssetIds', '请先添加参考素材')
      setFormErrors(nextErrors)
      Taro.showToast({ title: '请先添加参考素材', icon: 'none' })
      return
    }
    if (!usesAssetSlots && needs('multiUpload') && assetIds.length < uploadConfig.minCount) {
      nextErrors = mergeFieldError(nextErrors, 'inputAssetIds', `请至少添加 ${uploadConfig.minCount} 张参考素材`)
      setFormErrors(nextErrors)
      Taro.showToast({ title: `请至少添加 ${uploadConfig.minCount} 张参考素材`, icon: 'none' })
      return
    }
    const hasPendingUpload = usesAssetSlots
      ? Object.values(slotUploadItems).flat().some((item) => item.status === 'pending' || item.status === 'uploading')
      : uploadItems.some((item) => item.status === 'pending' || item.status === 'uploading')
    if (hasPendingUpload) {
      nextErrors = mergeFieldError(nextErrors, usesAssetSlots ? 'inputAssets' : 'inputAssetIds', '素材仍在上传中')
      setFormErrors(nextErrors)
      Taro.showToast({ title: '素材仍在上传中', icon: 'none' })
      return
    }
    setFormErrors({})
    setBusy(true)
    try {
      const result = await createGenerationTask({
        toolKey: tool.id,
        prompt,
        modeKey: activeMode ? modeKeyOf(activeMode) : undefined,
        params: { style, ratio, resolution: effectiveResolution, size: effectiveResolution, duration, model, count: 1 },
        ...(usesAssetSlots ? { inputAssets } : { inputAssetIds: assetIds })
      })
      const work = result.work
      Taro.showToast({ title: '任务已提交', icon: 'success' })
      goPage(`/pages/work-detail/index?id=${work.id}`)
    } catch (error) {
      if (error.code === 'INSUFFICIENT_CREDITS' || error.action === 'refresh_payment') {
        await beginGenerationPayment()
        return
      }
      if (error.fieldErrors && Object.keys(error.fieldErrors).length) {
        setFormErrors(error.fieldErrors)
        const firstMessage = Object.values(error.fieldErrors)[0]
        Taro.showToast({ title: firstMessage || error.message || '请检查表单内容', icon: 'none' })
        return
      }
      Taro.showToast({ title: error.message || '提交生成失败', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  const renderUploadBlock = ({ blockKey = '', label, config, items, errorKey, onClick }) => {
    const readyIds = items.filter((item) => item.status === 'ready' && item.assetId).map((item) => item.assetId)
    const hasReady = readyIds.length > 0
    return (
      <>
        <Text className='input-label'>{label || config.label}</Text>
        <View className={`${uploading ? 'upload-box uploading' : 'upload-box'}${fieldError(formErrors, errorKey) ? ' has-error' : ''}`} onClick={onClick}>
          <AppIcon name={hasReady ? 'badge' : uploadLimits[config.acceptTypes[0]]?.icon || 'image'} size={18} />
          <View className='upload-copy'>
            <Text>{hasReady ? `已添加 ${readyIds.length} 个素材` : uploading ? '素材上传中...' : config.actionText}</Text>
            <Text className='upload-hint'>{config.tip}</Text>
          </View>
        </View>
        {fieldError(formErrors, errorKey) ? <Text className='field-error'>{fieldError(formErrors, errorKey)}</Text> : null}
        {items.length > 0 && (
          <View className='upload-preview-grid'>
            {items.map((item) => (
              <View key={item.key} className={item.status === 'failed' ? 'upload-preview-card failed' : 'upload-preview-card'}>
                {item.type === 'image' ? (
                  <Image className='upload-preview-media' src={item.previewPath} mode='aspectFill' />
                ) : item.type === 'video' ? (
                  <Video className='upload-preview-media' src={item.filePath} poster={item.previewPath} controls={false} muted />
                ) : (
                  <View className='upload-file-preview'>
                    <AppIcon name='music' size={22} />
                    <Text>音频素材</Text>
                  </View>
                )}
                <View className='upload-preview-meta'>
                  <Text className='upload-preview-name'>{item.name}</Text>
                  <Text>{formatFileSize(item.size)} · {uploadLimits[item.type]?.label || '素材'}</Text>
                </View>
                <View className='upload-status'>{item.message}</View>
                {item.status === 'uploading' && (
                  <View className='upload-progress'>
                    <View className='upload-progress-bar' style={{ width: `${item.progress || 4}%` }} />
                  </View>
                )}
                {item.status !== 'uploading' && (
                  <View
                    className='upload-remove'
                    onClick={(event) => {
                      event.stopPropagation()
                      removeUploadItem(item.key, blockKey)
                    }}
                  >
                    <AppIcon name='close' size={12} />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </>
    )
  }

  return (
    <Shell title={tool.name} showTab={false} onRefresh={loadTool}>
      <View className='panel'>
        <View className='panel-brand-row'>
          <BrandLogo size={50} />
          <View>
            <Text className='section-kicker'>{tool.label} · 消耗 {tool.cost} 点额度</Text>
            <Text className='section-title'>{tool.name}</Text>
          </View>
        </View>
        <Text className='tool-desc'>{tool.desc}</Text>
      </View>

      <View className='form-panel'>
        {!tool.fields?.length ? (
          <InlineNotice tone='danger'>当前工具暂不可用，请稍后再试或联系客服。</InlineNotice>
        ) : null}
        {availableModes.length > 1 ? (
          <>
            <Text className='input-label'>生成模式</Text>
            <View className='option-row'>
              {availableModes.map((mode) => {
                const key = modeKeyOf(mode)
                return (
                  <View
                    key={key}
                    className={activeMode && modeKeyOf(activeMode) === key ? 'option-chip active' : 'option-chip'}
                    onClick={() => {
                      setActiveModeKey(key)
                      setUploadItems([])
                      setSlotUploadItems({})
                      setFormErrors({})
                    }}
                  >
                    {mode.label || mode.name || key}
                  </View>
                )
              })}
            </View>
          </>
        ) : null}

        {usesAssetSlots ? (
          <>
            {assetSlots.map((slot) => renderUploadBlock({
              blockKey: slot.slotKey,
              label: slot.label || slot.name,
              config: slotUploadConfig(slot),
              items: slotUploadItems[slot.slotKey] || [],
              errorKey: `inputAssets.${slot.slotKey}`,
              onClick: () => chooseUpload(slot)
            }))}
          </>
        ) : (needs('upload') || needs('multiUpload')) ? (
          renderUploadBlock({
            config: uploadConfig,
            items: uploadItems,
            errorKey: 'inputAssetIds',
            onClick: () => chooseUpload()
          })
        ) : null}
        <Text className='input-label'>提示词</Text>
        <Textarea
          className={fieldError(formErrors, 'prompt') ? 'text-area has-error' : 'text-area'}
          value={prompt}
          maxlength={500}
          placeholder='描述你想生成的画面、镜头、风格或营销场景'
          placeholderClass='muted'
          onInput={(event) => {
            clearFieldError('prompt')
            setPrompt(event.detail.value)
          }}
        />
        {fieldError(formErrors, 'prompt') ? <Text className='field-error'>{fieldError(formErrors, 'prompt')}</Text> : null}

        {needs('style') && (
          <>
            <Text className='input-label'>风格</Text>
            <View className={fieldError(formErrors, 'style') ? 'option-row has-error' : 'option-row'}>
              {styleOptions.map((item) => (
                <View key={item} className={style === item ? 'option-chip active' : 'option-chip'} onClick={() => {
                  clearFieldError('style')
                  setStyle(item)
                }}>
                  {item}
                </View>
              ))}
            </View>
            {fieldError(formErrors, 'style') ? <Text className='field-error'>{fieldError(formErrors, 'style')}</Text> : null}
          </>
        )}

        {needs('ratio') && (
          <>
            <Text className='input-label'>画面比例</Text>
            <View className={fieldError(formErrors, 'ratio') ? 'option-row has-error' : 'option-row'}>
              {ratioOptions.map((item) => (
                <View key={item} className={ratio === item ? 'option-chip ratio-option-chip active' : 'option-chip ratio-option-chip'} onClick={() => {
                  clearFieldError('ratio')
                  clearFieldError('resolution')
                  setResolution((current) => nextResolution(tool, item, current))
                  setRatio(item)
                }}>
                  <View className={ratioFrameClass(item)} />
                  <Text className='ratio-option-label'>{item}</Text>
                </View>
              ))}
            </View>
            {fieldError(formErrors, 'ratio') ? <Text className='field-error'>{fieldError(formErrors, 'ratio')}</Text> : null}
          </>
        )}

        {needs('resolution') && (
          <>
            <Text className='input-label'>{resolutionLabel}</Text>
            <View className={fieldError(formErrors, 'resolution') ? 'option-row has-error' : 'option-row'}>
              {resolutionOptions.map((item) => (
                <View key={item} className={selectedResolution === item ? 'option-chip active' : 'option-chip'} onClick={() => {
                  clearFieldError('resolution')
                  setResolution(item)
                }}>
                  {item}
                </View>
              ))}
            </View>
            {fieldError(formErrors, 'resolution') ? <Text className='field-error'>{fieldError(formErrors, 'resolution')}</Text> : null}
          </>
        )}

        {needs('duration') && (
          <>
            <Text className='input-label'>视频时长</Text>
            <View className={fieldError(formErrors, 'duration') ? 'option-row has-error' : 'option-row'}>
              {durationOptions.map((item) => (
                <View key={item} className={duration === item ? 'option-chip active' : 'option-chip'} onClick={() => {
                  clearFieldError('duration')
                  setDuration(item)
                }}>
                  {item}
                </View>
              ))}
            </View>
            {fieldError(formErrors, 'duration') ? <Text className='field-error'>{fieldError(formErrors, 'duration')}</Text> : null}
          </>
        )}

        {needs('model') && (
          <>
            <Text className='input-label'>模型</Text>
            <View className={fieldError(formErrors, 'model') ? 'option-row has-error' : 'option-row'}>
              {modelOptions.map((item) => (
                <View key={item} className={model === item ? 'option-chip active' : 'option-chip'} onClick={() => {
                  clearFieldError('model')
                  setModel(item)
                }}>
                  {item}
                </View>
              ))}
            </View>
            {fieldError(formErrors, 'model') ? <Text className='field-error'>{fieldError(formErrors, 'model')}</Text> : null}
          </>
        )}

        <View className='hero-actions'>
          <View className='primary-button' onClick={submit}>
            <AppIcon name='wand' size={16} />
            <Text>{busy ? '生成中...' : '生成'}</Text>
          </View>
        </View>
      </View>

      <PaymentSheet
        open={Boolean(payment)}
        title='本次生成支付'
        payment={payment}
        onClose={() => setPayment(null)}
        onRefresh={refreshPayment}
        onCryptoRouteChange={updatePaymentCryptoRoute}
        onCreateCryptoOrder={createPaymentCryptoOrder}
      />
    </Shell>
  )
}
