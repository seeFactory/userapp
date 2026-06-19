import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Shell from '../../components/Shell'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { getWorks, removeWork } from '../../utils/storage'
import { getDownloadUrl, publishGalleryWork, unpublishGalleryWork } from '../../services/api'

export default function WorkDetail() {
  const { id } = getCurrentInstance().router.params
  const work = getWorks().find((item) => item.id === id) || getWorks()[0]

  const remove = () => {
    Taro.showModal({
      title: '删除作品',
      content: '确认删除这条作品记录吗？',
      success: (res) => {
        if (res.confirm) {
          removeWork(work.id)
          Taro.showToast({ title: '已删除', icon: 'success' })
          Taro.redirectTo({ url: '/pages/works/index' })
        }
      }
    })
  }

  const retry = () => {
    Taro.navigateTo({ url: `/pages/tool/index?id=factory-painter&prompt=${encodeURIComponent(work.prompt || '')}` })
  }

  const saveWork = async () => {
    try {
      const data = await getDownloadUrl(work.id)
      const url = data?.url || work.image
      if (process.env.TARO_ENV === 'h5') {
        Taro.showToast({ title: '已获取下载地址', icon: 'success' })
        return
      }
      Taro.saveImageToPhotosAlbum({
        filePath: url,
        success: () => Taro.showToast({ title: '已保存', icon: 'success' }),
        fail: () => Taro.showModal({ title: '保存失败', content: '请确认已允许保存到相册。', showCancel: false })
      })
    } catch (error) {
      Taro.showToast({ title: '已使用本地预览保存', icon: 'none' })
    }
  }

  const publish = async () => {
    try {
      await publishGalleryWork(work.id)
      Taro.showToast({ title: '已发布到广场', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: '后端连接后可发布', icon: 'none' })
    }
  }

  const unpublish = async () => {
    try {
      await unpublishGalleryWork(work.id)
      Taro.showToast({ title: '已取消发布', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: '后端连接后可取消', icon: 'none' })
    }
  }

  return (
    <Shell title='作品详情' showTab={false}>
      <Image className='detail-image' src={work.image} mode='aspectFill' />
      <View className='section-head'>
        <View className='panel-brand-row section-brand-row'>
          <BrandLogo size={42} />
          <View className='brand-title-copy'>
          <Text className='section-kicker'>{work.toolName}</Text>
          <Text className='section-title'>{work.title}</Text>
          </View>
        </View>
        <View className={work.status === 'failed' ? 'status failed' : 'status'}>
          <AppIcon name={work.status === 'failed' ? 'alert' : 'badge'} size={12} />
          <Text>{work.status === 'failed' ? '失败' : '成功'}</Text>
        </View>
      </View>

      <View className='prompt-box'>
        <Text>{work.prompt}</Text>
        {work.failReason && <Text className='tool-desc'>失败原因：{work.failReason}</Text>}
      </View>

      <View className='hero-actions'>
        <View className='primary-button' onClick={saveWork}>
          <AppIcon name='download' size={16} />
          <Text>保存</Text>
        </View>
        <View className='ghost-button glass-button' onClick={() => Taro.showShareMenu({})}>
          <AppIcon name='share' size={16} />
          <Text>分享</Text>
        </View>
      </View>
      <View className='hero-actions'>
        <View className='primary-button' onClick={publish}>
          <AppIcon name='gallery' size={16} />
          <Text>发布广场</Text>
        </View>
        <View className='ghost-button glass-button' onClick={unpublish}>
          <AppIcon name='close' size={16} />
          <Text>取消发布</Text>
        </View>
      </View>
      <View className='hero-actions'>
        <View className='ghost-button glass-button' onClick={retry}>
          <AppIcon name='refresh' size={16} />
          <Text>重新生成</Text>
        </View>
        <View className='danger-button transparent-button' onClick={remove}>
          <AppIcon name='delete' size={16} />
          <Text>删除</Text>
        </View>
      </View>
    </Shell>
  )
}
