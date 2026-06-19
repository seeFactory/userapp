import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Textarea, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import PaymentSheet from '../../components/PaymentSheet'
import { durations, models, ratios, styles, tools } from '../../data/mock'
import {
  createAsset,
  createCryptoOrder,
  createGenerationPaymentOrder,
  createGenerationTask,
  createTelegramStarsOrder,
  fetchCryptoOrder,
  fetchPaymentOrder,
  fetchTelegramStarsOrder,
  fetchTool,
  getClientRuntime,
  getUploadToken
} from '../../services/api'
import { requireLogin } from '../../utils/storage'

function firstValue(list) {
  return list[0]
}

export default function ToolPage() {
  const params = getCurrentInstance().router.params
  const [tool, setTool] = useState(tools.find((entry) => entry.id === params.id) || tools[0])
  const [prompt, setPrompt] = useState(params.prompt ? decodeURIComponent(params.prompt) : '')
  const [style, setStyle] = useState(firstValue(styles))
  const [ratio, setRatio] = useState('9:16')
  const [duration, setDuration] = useState(firstValue(durations))
  const [model, setModel] = useState(firstValue(models))
  const [uploaded, setUploaded] = useState(false)
  const [assetIds, setAssetIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [payment, setPayment] = useState(null)

  useEffect(() => {
    let mounted = true
    fetchTool(params.id)
      .then((data) => {
        if (mounted && data) setTool(data)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [params.id])

  const needs = (field) => tool.fields.includes(field)

  const chooseUpload = async () => {
    if (uploading) return
    if (!requireLogin(`/pages/tool/index?id=${tool.id}`)) return
    setUploading(true)
    try {
      const result = await Taro.chooseImage({
        count: needs('multiUpload') ? 6 : 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      const files = result.tempFiles || []
      if (!files.length) return
      Taro.showLoading({ title: '上传素材' })
      const created = []
      for (const file of files) {
        const filePath = file.path || file.tempFilePath || ''
        const filename = filePath.split('/').pop() || 'reference.png'
        const policy = await getUploadToken({ type: 'image', filename })
        if (policy.configured && process.env.TARO_ENV !== 'h5') {
          await Taro.uploadFile({
            url: policy.uploadUrl,
            filePath,
            name: 'file',
            formData: policy.fields
          })
        }
        const asset = await createAsset({
          type: 'image',
          url: policy.publicUrl,
          ossKey: policy.ossKey,
          size: file.size
        })
        created.push(asset.id)
      }
      setAssetIds((prev) => prev.concat(created))
      setUploaded(true)
      Taro.showToast({ title: '素材已添加', icon: 'success' })
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
      const order = await fetchPaymentOrder(payment.order.id)
      const nextPayment = { ...payment, order }
      if (payment.cryptoOrder?.id) {
        nextPayment.cryptoOrder = await fetchCryptoOrder(payment.cryptoOrder.id)
      }
      if (payment.starsOrder?.id) {
        nextPayment.starsOrder = await fetchTelegramStarsOrder(payment.starsOrder.id)
      }
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
    if (!prompt.trim()) {
      Taro.showToast({ title: '请输入提示词', icon: 'none' })
      return
    }
    if ((needs('upload') || needs('multiUpload')) && !uploaded) {
      Taro.showToast({ title: '请先添加参考素材', icon: 'none' })
      return
    }
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
            <Text className='input-label'>{needs('multiUpload') ? '参考素材，多图融合' : '参考素材'}</Text>
            <View className='upload-box' onClick={chooseUpload}>
              <AppIcon name={uploaded ? 'badge' : 'image'} size={18} />
              <Text>{uploaded ? `已添加 ${assetIds.length || 1} 个参考素材` : uploading ? '素材上传中...' : '点击添加图片素材'}</Text>
            </View>
          </>
        )}

        <Text className='input-label'>提示词</Text>
        <Textarea
          className='text-area'
          value={prompt}
          maxlength={500}
          placeholder='描述你想生成的画面、镜头、风格或营销场景'
          placeholderClass='muted'
          onInput={(event) => setPrompt(event.detail.value)}
        />

        {needs('style') && (
          <>
            <Text className='input-label'>风格</Text>
            <View className='option-row'>
              {styles.map((item) => (
                <View key={item} className={style === item ? 'option-chip active' : 'option-chip'} onClick={() => setStyle(item)}>
                  {item}
                </View>
              ))}
            </View>
          </>
        )}

        {needs('ratio') && (
          <>
            <Text className='input-label'>画面比例</Text>
            <View className='option-row'>
              {ratios.map((item) => (
                <View key={item} className={ratio === item ? 'option-chip active' : 'option-chip'} onClick={() => setRatio(item)}>
                  {item}
                </View>
              ))}
            </View>
          </>
        )}

        {needs('duration') && (
          <>
            <Text className='input-label'>视频时长</Text>
            <View className='option-row'>
              {durations.map((item) => (
                <View key={item} className={duration === item ? 'option-chip active' : 'option-chip'} onClick={() => setDuration(item)}>
                  {item}
                </View>
              ))}
            </View>
          </>
        )}

        {needs('model') && (
          <>
            <Text className='input-label'>模型</Text>
            <View className='option-row'>
              {models.map((item) => (
                <View key={item} className={model === item ? 'option-chip active' : 'option-chip'} onClick={() => setModel(item)}>
                  {item}
                </View>
              ))}
            </View>
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

      {uploaded && (
        <Image
          className='detail-image preview-image'
          src='https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80'
          mode='aspectFill'
        />
      )}

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
