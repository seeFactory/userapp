import { View, Text } from '@tarojs/components'
import AppIcon from './AppIcon'

export function PageLoading({ title = '正在加载', description = '请稍候，seeFactory 正在同步最新数据。' }) {
  return (
    <View className='page-state page-state-loading'>
      <View className='loading-ring' />
      <Text className='page-state-title'>{title}</Text>
      {description ? <Text className='page-state-desc'>{description}</Text> : null}
    </View>
  )
}

export function EmptyState({
  title = '暂无数据',
  description = '当前还没有可展示的内容。',
  icon = 'center',
  actionText,
  onAction,
  compact = false
}) {
  return (
    <View className={`page-state page-state-empty${compact ? ' compact-state' : ''}`}>
      <View className='page-state-icon'>
        <AppIcon name={icon} size={22} />
      </View>
      <Text className='page-state-title'>{title}</Text>
      {description ? <Text className='page-state-desc'>{description}</Text> : null}
      {actionText && onAction ? (
        <View className='ghost-button glass-button state-action' onClick={onAction}>
          <Text>{actionText}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function ErrorState({
  title = '加载失败',
  description = '数据暂时没有同步成功，请稍后重试。',
  actionText = '重新加载',
  onRetry
}) {
  return (
    <View className='page-state page-state-error'>
      <View className='page-state-icon danger'>
        <AppIcon name='alert' size={22} />
      </View>
      <Text className='page-state-title'>{title}</Text>
      {description ? <Text className='page-state-desc'>{description}</Text> : null}
      {onRetry ? (
        <View className='primary-button state-action' onClick={onRetry}>
          <AppIcon name='refresh' size={15} />
          <Text>{actionText}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function InlineNotice({ children, tone = 'info' }) {
  return (
    <View className={`inline-notice ${tone === 'danger' ? 'danger' : ''}`}>
      <AppIcon name={tone === 'danger' ? 'alert' : 'sparkles'} size={14} />
      <Text>{children}</Text>
    </View>
  )
}
