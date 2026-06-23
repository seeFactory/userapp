import { ScrollView, View, Text } from '@tarojs/components'
import AppIcon from './AppIcon'

export default function AgreementModal({ open, title, content, onClose }) {
  if (!open) return null

  const stopPanelClick = (event) => {
    if (event?.stopPropagation) event.stopPropagation()
  }

  return (
    <View className='modal-mask legal-modal-mask' onClick={onClose}>
      <View className='modal-panel legal-modal-panel' onClick={stopPanelClick}>
        <View className='modal-head legal-modal-head'>
          <View>
            <Text className='section-kicker'>Legal</Text>
            <Text className='modal-title'>{title || '协议'}</Text>
          </View>
          <View className='close-btn legal-close-btn' onClick={onClose}>
            <AppIcon name='close' size={20} />
          </View>
        </View>
        <ScrollView scrollY className='legal-modal-scroll'>
          <Text className='legal-modal-content'>{content || '协议正文待后台发布'}</Text>
        </ScrollView>
        <View className='primary-button full-width-button legal-modal-action' onClick={onClose}>
          <Text>我知道了</Text>
        </View>
      </View>
    </View>
  )
}
