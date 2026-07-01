import { useEffect, useRef, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Video, ScrollView } from '@tarojs/components'
import { captureInviteFromParams } from '../platform/invite'
import { isFeatureEnabled, useAppConfig } from '../hooks/useAppConfig'
import { goTab } from '../utils/navigation'
import AppIcon from './AppIcon'
import BrandLogo from './BrandLogo'
import PageBackButton from './PageBackButton'

const fallbackHomeVideo = 'https://videos.pexels.com/video-files/16998437/16998437-hd_1080_1920_30fps.mp4'
const tabs = [
  { key: 'home', label: '首页', icon: 'home', path: '/pages/index/index' },
  { key: 'center', label: '创作', icon: 'center', path: '/pages/create-center/index' },
  { key: 'gallery', label: '广场', icon: 'gallery', path: '/pages/gallery/index' },
  { key: 'works', label: '作品', icon: 'works', path: '/pages/works/index' },
  { key: 'mine', label: '我的', icon: 'user', path: '/pages/mine/index' }
]

function featureForTab(key) {
  if (key === 'center') return 'generation'
  if (key === 'gallery') return 'gallery'
  return ''
}

function normalizeOpacity(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 0), 1)
}

export default function Shell({ active, children, fixedFooter, showTab = true, showBack, backFallback, transitionKey, onRefresh }) {
  const isH5Runtime = process.env.TARO_ENV === 'h5'
  const { config } = useAppConfig()
  const homeConfig = config?.home || {}
  const videoUrl = homeConfig.videoUrl || fallbackHomeVideo
  const videoFixed = homeConfig.videoFixed !== false
  const videoMuted = homeConfig.videoMuted !== false
  const videoLoop = homeConfig.videoLoop !== false
  const overlayOpacity = normalizeOpacity(homeConfig.overlayOpacity, 0.58)
  const mainCardOpacity = normalizeOpacity(homeConfig.mainCardOpacity, 0.46)
  const homeStyle = active === 'home'
    ? `--sf-home-overlay-opacity: ${overlayOpacity}; --sf-home-card-opacity: ${mainCardOpacity};`
    : ''
  const visibleTabs = tabs.filter((tab) => {
    const feature = featureForTab(tab.key)
    return !feature || isFeatureEnabled(config, feature) || tab.key === active
  })
  const wantsTopBack = showBack ?? !showTab
  const hasTopBack = isH5Runtime && wantsTopBack
  const shellClass = [
    active === 'home' ? 'app-shell home-shell' : 'app-shell',
    isH5Runtime ? 'h5-shell' : 'miniapp-shell',
    fixedFooter ? 'has-fixed-footer' : ''
  ].filter(Boolean).join(' ')
  const contentClass = [
    'page-content',
    showTab ? 'with-tab' : '',
    showTab ? 'tab-page-content' : '',
    hasTopBack ? 'has-top-back' : '',
    'page-transition'
  ].filter(Boolean).join(' ')

  const refreshEnabled = typeof onRefresh === 'function'
  const [refreshing, setRefreshing] = useState(false)
  const mountedRef = useRef(true)
  const scrollTopRef = useRef(0)
  const pullStartYRef = useRef(0)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const finishRefresh = () => {
    setTimeout(() => {
      if (mountedRef.current) setRefreshing(false)
    }, 180)
  }

  const triggerRefresh = async () => {
    if (!refreshEnabled || refreshing) {
      Taro.stopPullDownRefresh?.()
      return
    }
    setRefreshing(true)
    Taro.showNavigationBarLoading?.()
    try {
      await Promise.resolve(onRefresh())
    } catch (error) {
      Taro.showToast({ title: error?.message || '刷新失败', icon: 'none' })
    } finally {
      Taro.hideNavigationBarLoading?.()
      Taro.stopPullDownRefresh?.()
      finishRefresh()
    }
  }


  const handleScroll = (event) => {
    scrollTopRef.current = Number(event?.detail?.scrollTop || 0)
  }

  const handleTouchStart = (event) => {
    if (!refreshEnabled || scrollTopRef.current > 2) return
    pullStartYRef.current = Number(event?.touches?.[0]?.clientY || 0)
  }

  const handleTouchEnd = (event) => {
    if (!refreshEnabled || !pullStartYRef.current || scrollTopRef.current > 2) {
      pullStartYRef.current = 0
      return
    }
    const endY = Number(event?.changedTouches?.[0]?.clientY || pullStartYRef.current)
    const pulledDistance = endY - pullStartYRef.current
    pullStartYRef.current = 0
    if (pulledDistance >= 72) triggerRefresh()
  }

  useEffect(() => {
    captureInviteFromParams(getCurrentInstance()?.router?.params || {})
  }, [])

  useEffect(() => {
    if (!showTab) return
    try {
      Taro.hideTabBar?.({ animation: false })
    } catch (_) {}
  }, [showTab])

  useEffect(() => {
    if (active !== 'home') return undefined

    let attempts = 0
    const startVideo = () => {
      attempts += 1

      if (process.env.TARO_ENV === 'h5' && typeof document !== 'undefined') {
        const video = document.querySelector('#home-background-video video') || document.querySelector('video')
        if (video?.play) {
          video.muted = videoMuted
          video.loop = videoLoop
          video.autoplay = true
          video.playsInline = true
          video.play().catch(() => {})
        }
        return
      }

      try {
        const context = Taro.createVideoContext('home-background-video')
        context?.play?.()
      } catch (error) {
        // Non-H5 runtimes may delay context availability while the page mounts.
      }
    }

    startVideo()
    const timer = setInterval(() => {
      startVideo()
      if (attempts >= 6) clearInterval(timer)
    }, 700)

    return () => clearInterval(timer)
  }, [active, videoUrl, videoMuted, videoLoop])

  const go = (tab) => {
    if (tab.key === active) return
    goTab(tab.path)
  }

  return (
    <View className={shellClass} style={homeStyle}>
      {active === 'home' && (
        <View className={videoFixed ? 'home-video-layer fixed' : 'home-video-layer scroll-bound'}>
          <Video
            id='home-background-video'
            className='home-bg-video'
            src={videoUrl}
            autoplay
            loop={videoLoop}
            muted={videoMuted}
            playsInline
            controls={false}
            showCenterPlayBtn={false}
            showPlayBtn={false}
            showFullscreenBtn={false}
            enableProgressGesture={false}
            objectFit='cover'
          />
        </View>
      )}
      {active === 'home' && <View className='home-video-overlay' />}
      <View className='factory-grid' />
      {hasTopBack && <PageBackButton fallbackUrl={backFallback} />}
      <ScrollView
        key={transitionKey || active || 'page'}
        className={contentClass}
        scrollY
        enhanced
        showScrollbar={false}
        enableFlex
        refresherEnabled={refreshEnabled}
        refresherTriggered={refreshing}
        refresherDefaultStyle='white'
        refresherBackground='transparent'
        onRefresherRefresh={triggerRefresh}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </ScrollView>
      {fixedFooter}
      {showTab && (
        <View className='bottom-tabs'>
          {visibleTabs.map((tab) => (
            <View
              key={tab.key}
              className={tab.key === active ? 'tab-item active' : 'tab-item'}
              onClick={() => go(tab)}
            >
              <View className='tab-icon'>
                {tab.key === 'home' ? <BrandLogo size={30} className='tab-brand-logo' /> : <AppIcon name={tab.icon} size={30} />}
              </View>
              <Text>{tab.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
