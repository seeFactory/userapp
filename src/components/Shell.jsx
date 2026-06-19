import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Video, ScrollView } from '@tarojs/components'
import { homeVideo, tabs } from '../data/mock'
import { fetchAppConfig } from '../services/api'
import AppIcon from './AppIcon'
import BrandLogo from './BrandLogo'

export default function Shell({ active, children, showTab = true }) {
  const [videoUrl, setVideoUrl] = useState(homeVideo)

  useEffect(() => {
    if (active !== 'home') return undefined
    let mounted = true
    fetchAppConfig()
      .then((config) => {
        if (mounted && config?.home?.videoUrl) setVideoUrl(config.home.videoUrl)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [active])

  useEffect(() => {
    if (active !== 'home') return undefined

    let attempts = 0
    const startVideo = () => {
      attempts += 1

      if (process.env.TARO_ENV === 'h5' && typeof document !== 'undefined') {
        const video = document.querySelector('#home-background-video video') || document.querySelector('video')
        if (video?.play) {
          video.muted = true
          video.loop = true
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
  }, [active, videoUrl])

  const go = (tab) => {
    if (tab.key === active) return
    Taro.redirectTo({ url: tab.path })
  }

  return (
    <View className={active === 'home' ? 'app-shell home-shell' : 'app-shell'}>
      {active === 'home' && (
        <View className='home-video-layer'>
          <Video
            id='home-background-video'
            className='home-bg-video'
            src={videoUrl}
            autoplay
            loop
            muted
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
      <View className='factory-grid' />
      <ScrollView
        className={showTab ? 'page-content with-tab' : 'page-content'}
        scrollY
        enhanced
        showScrollbar={false}
        enableFlex
      >
        {children}
      </ScrollView>
      {showTab && (
        <View className='bottom-tabs'>
          {tabs.map((tab) => (
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
