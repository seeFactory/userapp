import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Textarea, Image, Video } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import PaymentSheet from '../../components/PaymentSheet'
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
  getClientRuntime,
  getUploadToken
} from '../../services/api'
import { requireLogin } from '../../utils/storage'

const PLATFORM_PAY_RUNTIMES = ['wechat-miniapp', 'alipay-miniapp', 'douyin-miniapp', 'qq-miniapp']

const defaultStyles = ['深空电影感', '冷调商业摄影', '品牌漫画', '赛博霓虹']
const defaultRatios = ['1:1', '3:4', '9:16', '16:9']
const defaultDurations = ['5 秒', '8 秒', '12 秒']
const defaultModels = ['seeFactory Core', 'Sora 风格', 'Veo 风格']
const uploadLimits = {
  image: {
    label: '图片',
    maxSize: 20 * 1024 * 1024,
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
    icon: 'image',
    tip: '支持 JPG / PNG / WebP，单张最大 20 MB'
  },
  video: {
    label: '视频',
    maxSize: 500 * 1024 * 1024,
    extensions: ['mp4', 'mov', 'webm'],
    icon: 'video',
    tip: '支持 MP4 / MOV / WebM，单个最大 500 MB'
  },
  audio: {
    label: '音频',
    maxSize: 100 * 1024 * 1024,
    extensions: ['mp3', 'wav', 'm4a', 'aac'],
    icon: 'music',
    tip: '支持 MP3 / WAV / M4A / AAC，单个最大 100 MB'
  }
}

function firstValue(list) {
  return list[0]
}

function fallbackTool(id) {
  return {
    id: id || 'factory-painter',
    name: 'AI 创作工具',
    label: '工具',
    desc: '正在同步 Admin 配置的工具参数。',
    cost: 0,
    fields: ['prompt', 'style', 'ratio', 'model'],
    options: {}
  }
}

function optionList(tool, key, fallback) {
  const list = tool?.options?.[key]
  return Array.isArray(list) && list.length ? list : fallback
}

function nextSelected(tool, key, fallback, current) {
  const list = optionList(tool, key, fallback)
  return list.includes(current) ? current : firstValue(list)
}

function formatFileSize(size = 0) {
  if (!size) return '未知大小'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(size > 10 * 1024 * 1024 ? 0 : 1)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function getExt(input = '') {
  const clean = String(input).split('?')[0].split('#')[0]
  const name = clean.split(/[\\/]/).pop() || ''
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
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

function inferFileType(file, fallbackType = 'image') {
  const fileType = file.fileType || file.kind || ''
  const rawMimeType = file.mimeType || file.type || file.originalFileObj?.type || ''
  const mimeType = String(rawMimeType).includes('/') ? rawMimeType : ''
  const filePath = file.tempFilePath || file.path || ''
  const name = file.name || filePath
  const ext = getExt(name || filePath)
  if (fileType === 'image' || mimeType.startsWith('image/') || uploadLimits.image.extensions.includes(ext)) return 'image'
  if (fileType === 'video' || mimeType.startsWith('video/') || uploadLimits.video.extensions.includes(ext)) return 'video'
  if (fileType === 'audio' || mimeType.startsWith('audio/') || uploadLimits.audio.extensions.includes(ext)) return 'audio'
  return fallbackType
}

function normalizeFile(file, fallbackType, index) {
  const filePath = file.tempFilePath || file.path || file.url || ''
  const name = file.name || file.originalFileObj?.name || filePath.split(/[\\/]/).pop() || `${fallbackType}-${Date.now()}-${index}`
  const type = inferFileType(file, fallbackType)
  const rawMimeType = file.mimeType || file.type || file.originalFileObj?.type || ''
  return {
    key: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name,
    filePath,
    previewPath: file.thumbTempFilePath || filePath,
    size: Number(file.size || file.originalFileObj?.size || 0),
    mimeType: String(rawMimeType).includes('/') ? rawMimeType : ''
  }
}

function validateFile(file, config) {
  if (!file.filePath) return '素材文件读取失败，请重新选择'
  if (!config.acceptTypes.includes(file.type)) return `当前工具不支持上传${uploadLimits[file.type]?.label || '该类型'}素材`
  const limit = uploadLimits[file.type]
  const ext = getExt(file.name || file.filePath)
  if (ext && !limit.extensions.includes(ext)) return `${limit.label}格式不支持，请上传 ${limit.extensions.join(' / ')}`
  if (file.size && file.size > limit.maxSize) return `${limit.label}超过大小限制，最大 ${formatFileSize(limit.maxSize)}`
  return ''
}

async function chooseTypedFiles(config) {
  let acceptTypes = config.acceptTypes
  if (acceptTypes.length > 1) {
    const itemList = acceptTypes.map((type) => uploadLimits[type].label)
    const action = await Taro.showActionSheet({ itemList })
    acceptTypes = [acceptTypes[action.tapIndex]]
  }
  const chosenType = acceptTypes[0]
  if (chosenType === 'image') {
    if (typeof Taro.chooseMedia === 'function') {
      const result = await Taro.chooseMedia({
        count: config.maxCount,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      return (result.tempFiles || []).map((file, index) => normalizeFile({ ...file, fileType: 'image' }, 'image', index))
    }
    const result = await Taro.chooseImage({
      count: config.maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    })
    return (result.tempFiles || []).map((file, index) => normalizeFile(file, 'image', index))
  }
  if (chosenType === 'video') {
    if (typeof Taro.chooseMedia === 'function') {
      const result = await Taro.chooseMedia({
        count: config.maxCount,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back'
      })
      return (result.tempFiles || []).map((file, index) => normalizeFile({ ...file, fileType: 'video' }, 'video', index))
    }
    if (typeof Taro.chooseVideo === 'function') {
      const result = await Taro.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back'
      })
      return [normalizeFile({ ...result, fileType: 'video' }, 'video', 0)]
    }
  }
  if (chosenType === 'audio' && typeof Taro.chooseMessageFile === 'function') {
    const result = await Taro.chooseMessageFile({
      count: config.maxCount,
      type: 'file',
      extension: uploadLimits.audio.extensions
    })
    return (result.tempFiles || []).map((file, index) => normalizeFile(file, 'audio', index))
  }
  throw new Error('当前平台暂不支持选择该类型素材')
}

function uploadToOss(policy, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = Taro.uploadFile({
      url: policy.uploadUrl,
      filePath: file.filePath,
      name: 'file',
      formData: policy.fields,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res)
          return
        }
        reject(new Error('OSS 上传失败，请稍后重试'))
      },
      fail: () => reject(new Error('素材上传失败，请检查网络或上传域名配置'))
    })
    if (task?.progress) {
      task.progress((event) => onProgress(Math.max(1, Math.min(95, event.progress || 1))))
    }
  })
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
  const [duration, setDuration] = useState(firstValue(defaultDurations))
  const [model, setModel] = useState(firstValue(defaultModels))
  const [uploadItems, setUploadItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [payment, setPayment] = useState(null)
  const [formErrors, setFormErrors] = useState({})

  useEffect(() => {
    let mounted = true
    fetchTool(params.id)
      .then((data) => {
        if (!mounted || !data) return
        setTool(data)
        setStyle((current) => nextSelected(data, 'styles', defaultStyles, current))
        setRatio((current) => nextSelected(data, 'ratios', defaultRatios, current))
        setDuration((current) => nextSelected(data, 'durations', defaultDurations, current))
        setModel((current) => nextSelected(data, 'models', defaultModels, current))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [params.id])

  const needs = (field) => (tool.fields || []).includes(field)
  const styleOptions = optionList(tool, 'styles', defaultStyles)
  const ratioOptions = optionList(tool, 'ratios', defaultRatios)
  const durationOptions = optionList(tool, 'durations', defaultDurations)
  const modelOptions = optionList(tool, 'models', defaultModels)
  const uploadConfig = inferUploadConfig(tool)
  const assetIds = uploadItems.filter((item) => item.status === 'ready' && item.assetId).map((item) => item.assetId)
  const uploaded = assetIds.length > 0

  const updateUploadItem = (key, patch) => {
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

  const removeUploadItem = (key) => {
    if (uploading) return
    clearFieldError('inputAssetIds')
    setUploadItems((prev) => prev.filter((item) => item.key !== key))
  }

  const chooseUpload = async () => {
    if (uploading) return
    if (!requireLogin(`/pages/tool/index?id=${tool.id}`)) return
    const existingCount = uploadConfig.maxCount === 1 ? 0 : uploadItems.filter((item) => item.status !== 'failed').length
    const remaining = uploadConfig.maxCount - existingCount
    if (remaining <= 0) {
      Taro.showToast({ title: `最多上传 ${uploadConfig.maxCount} 个素材`, icon: 'none' })
      return
    }
    setUploading(true)
    try {
      const files = await chooseTypedFiles({ ...uploadConfig, maxCount: remaining })
      clearFieldError('inputAssetIds')
      const validFiles = []
      const invalidMessages = []
      files.forEach((file) => {
        const message = validateFile(file, uploadConfig)
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
      setUploadItems((prev) => (uploadConfig.maxCount === 1 ? pendingItems : prev.concat(pendingItems)))
      Taro.showLoading({ title: '上传素材' })
      let successCount = 0
      for (const file of pendingItems) {
        try {
          updateUploadItem(file.key, { status: 'uploading', progress: 5, message: '上传中' })
          const policy = await getUploadToken({
            type: file.type,
            filename: file.name,
            mimeType: file.mimeType,
            size: file.size
          })
          if (policy.configured) {
            await uploadToOss(policy, file, (progress) => updateUploadItem(file.key, { progress }))
          }
          updateUploadItem(file.key, { progress: 96, message: '写入素材记录' })
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
          })
        } catch (error) {
          updateUploadItem(file.key, {
            status: 'failed',
            progress: 0,
            message: error.message || '上传失败'
          })
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
        clientRuntime
      })
      const order = paymentPayload.order
      const nextPayment = { order, runtime: clientRuntime, afterPaid: 'generate' }
      if (clientRuntime === 'telegram-tma') {
        nextPayment.starsOrder = await createTelegramStarsOrder({ paymentOrderId: order.id })
      } else if (PLATFORM_PAY_RUNTIMES.includes(clientRuntime)) {
        nextPayment.platformPayment = await createPlatformPaymentOrder({ paymentOrderId: order.id })
      } else {
        nextPayment.cryptoOrder = await createCryptoOrder({
          paymentOrderId: order.id,
          chainName: 'TRON',
          token: 'USDT'
        })
      }
      setPayment(nextPayment)
      Taro.showToast({ title: '请完成支付后刷新状态', icon: 'none' })
    } catch (error) {
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
    if (!requireLogin(`/pages/tool/index?id=${tool.id}`)) return
    let nextErrors = {}
    if (!prompt.trim()) {
      nextErrors = mergeFieldError(nextErrors, 'prompt', '请输入提示词')
      setFormErrors(nextErrors)
      Taro.showToast({ title: '请输入提示词', icon: 'none' })
      return
    }
    if ((needs('upload') || needs('multiUpload')) && !uploaded) {
      nextErrors = mergeFieldError(nextErrors, 'inputAssetIds', '请先添加参考素材')
      setFormErrors(nextErrors)
      Taro.showToast({ title: '请先添加参考素材', icon: 'none' })
      return
    }
    if (needs('multiUpload') && assetIds.length < uploadConfig.minCount) {
      nextErrors = mergeFieldError(nextErrors, 'inputAssetIds', `请至少添加 ${uploadConfig.minCount} 张参考素材`)
      setFormErrors(nextErrors)
      Taro.showToast({ title: `请至少添加 ${uploadConfig.minCount} 张参考素材`, icon: 'none' })
      return
    }
    if (uploadItems.some((item) => item.status === 'pending' || item.status === 'uploading')) {
      nextErrors = mergeFieldError(nextErrors, 'inputAssetIds', '素材仍在上传中')
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
        params: { style, ratio, duration, model, count: 1 },
        inputAssetIds: assetIds
      })
      const work = result.work
      Taro.showToast({ title: '任务已提交', icon: 'success' })
      Taro.navigateTo({ url: `/pages/work-detail/index?id=${work.id}` })
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

  return (
    <Shell title={tool.name} showTab={false}>
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
        {(needs('upload') || needs('multiUpload')) && (
          <>
            <Text className='input-label'>{uploadConfig.label}</Text>
            <View className={`${uploading ? 'upload-box uploading' : 'upload-box'}${fieldError(formErrors, 'inputAssetIds') ? ' has-error' : ''}`} onClick={chooseUpload}>
              <AppIcon name={uploaded ? 'badge' : uploadLimits[uploadConfig.acceptTypes[0]]?.icon || 'image'} size={18} />
              <View className='upload-copy'>
                <Text>{uploaded ? `已添加 ${assetIds.length} 个参考素材` : uploading ? '素材上传中...' : uploadConfig.actionText}</Text>
                <Text className='upload-hint'>{uploadConfig.tip}</Text>
              </View>
            </View>
            {fieldError(formErrors, 'inputAssetIds') ? <Text className='field-error'>{fieldError(formErrors, 'inputAssetIds')}</Text> : null}
            {uploadItems.length > 0 && (
              <View className='upload-preview-grid'>
                {uploadItems.map((item) => (
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
                          removeUploadItem(item.key)
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
        )}

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
                <View key={item} className={ratio === item ? 'option-chip active' : 'option-chip'} onClick={() => {
                  clearFieldError('ratio')
                  setRatio(item)
                }}>
                  {item}
                </View>
              ))}
            </View>
            {fieldError(formErrors, 'ratio') ? <Text className='field-error'>{fieldError(formErrors, 'ratio')}</Text> : null}
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
          <View className='ghost-button glass-button' onClick={() => Taro.navigateBack()}>
            <AppIcon name='back' size={16} />
            <Text>返回</Text>
          </View>
        </View>
      </View>

      <PaymentSheet
        open={Boolean(payment)}
        title='本次生成支付'
        payment={payment}
        onClose={() => setPayment(null)}
        onRefresh={refreshPayment}
      />
    </Shell>
  )
}
