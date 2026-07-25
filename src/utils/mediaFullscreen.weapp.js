import Taro from '@tarojs/taro'

export function previewImagesFullscreen({ current, urls }) {
  if (!current || !Array.isArray(urls) || !urls.length) return
  Taro.previewImage({
    current,
    urls,
    showmenu: true,
    fail: () => Taro.showToast({ title: '图片暂时无法全屏预览', icon: 'none' })
  })
}
