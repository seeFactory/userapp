import { useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Textarea, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { durations, models, ratios, styles, tools } from '../../data/mock'
import { addWork, requireLogin } from '../../utils/storage'

function firstValue(list) {
  return list[0]
}

export default function ToolPage() {
  const params = getCurrentInstance().router.params
  const tool = tools.find((entry) => entry.id === params.id) || tools[0]
  const [prompt, setPrompt] = useState(params.prompt ? decodeURIComponent(params.prompt) : '')
  const [style, setStyle] = useState(firstValue(styles))
  const [ratio, setRatio] = useState('9:16')
  const [duration, setDuration] = useState(firstValue(durations))
  const [model, setModel] = useState(firstValue(models))
  const [uploaded, setUploaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const needs = (field) => tool.fields.includes(field)

  const submit = () => {
    if (!requireLogin(`/pages/tool/index?id=${tool.id}`)) return
    if (!prompt.trim()) {
      Taro.showToast({ title: '请输入提示词', icon: 'none' })
      return
    }
    if ((needs('upload') || needs('multiUpload')) && !uploaded) {
      Taro.showToast({ title: '请先添加模拟素材', icon: 'none' })
      return
    }
    setBusy(true)
    setTimeout(() => {
      const work = {
        id: `work-${Date.now()}`,
        title: `${tool.name}生成结果`,
        category: tool.category,
        toolName: tool.name,
        status: 'success',
        date: '2026/6/18 13:40',
        image: tool.category === 'video'
          ? 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=80'
          : 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=900&q=80',
        prompt,
        style,
        ratio,
        duration,
        model
      }
      addWork(work)
      setBusy(false)
      Taro.showToast({ title: '生成成功', icon: 'success' })
      Taro.navigateTo({ url: `/pages/work-detail/index?id=${work.id}` })
    }, 600)
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
            <View className='upload-box' onClick={() => setUploaded(true)}>
              <AppIcon name={uploaded ? 'badge' : 'image'} size={18} />
              <Text>{uploaded ? '已添加模拟素材，可继续生成' : '点击添加模拟图片素材'}</Text>
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
    </Shell>
  )
}
