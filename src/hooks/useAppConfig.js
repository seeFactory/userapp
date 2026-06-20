import { useEffect, useState } from 'react'
import { fetchAppConfig } from '../services/api'

export const DEFAULT_APP_CONFIG = {
  brand: {
    name: 'seeFactory',
    logoUrl: 'docs/logo.png'
  },
  home: {
    videoFixed: true,
    videoMuted: true,
    videoLoop: true,
    overlayOpacity: 0.58,
    mainCardOpacity: 0.46
  },
  feature: {
    generationEnabled: true,
    rechargeEnabled: true,
    galleryEnabled: true,
    agentEnabled: true
  },
  customer: {},
  legal: {
    operatorName: 'seeFactory 平台运营方',
    contactEmail: 'support@seefactory.ai',
    contactAddress: '中国北京市海淀区 seeFactory 运营中心',
    jurisdiction: '中华人民共和国法律'
  },
  generation: {
    maxActiveTasksPerUser: 5,
    resultCount: 1
  }
}

let cachedConfig = DEFAULT_APP_CONFIG
let configLoaded = false
let configPromise = null

function mergeConfig(config) {
  return {
    ...DEFAULT_APP_CONFIG,
    ...(config || {}),
    brand: { ...DEFAULT_APP_CONFIG.brand, ...(config?.brand || {}) },
    home: { ...DEFAULT_APP_CONFIG.home, ...(config?.home || {}) },
    feature: { ...DEFAULT_APP_CONFIG.feature, ...(config?.feature || {}) },
    customer: { ...DEFAULT_APP_CONFIG.customer, ...(config?.customer || {}) },
    legal: { ...DEFAULT_APP_CONFIG.legal, ...(config?.legal || {}) },
    generation: { ...DEFAULT_APP_CONFIG.generation, ...(config?.generation || {}) }
  }
}

export function isFeatureEnabled(config, feature) {
  return mergeConfig(config).feature?.[`${feature}Enabled`] !== false
}

export function loadAppConfig({ force = false } = {}) {
  if (!force && configLoaded) return Promise.resolve(cachedConfig)
  if (!force && configPromise) return configPromise
  configPromise = fetchAppConfig()
    .then((config) => {
      cachedConfig = mergeConfig(config)
      configLoaded = true
      return cachedConfig
    })
    .finally(() => {
      configPromise = null
    })
  return configPromise
}

export function useAppConfig() {
  const [config, setConfig] = useState(cachedConfig)
  const [loading, setLoading] = useState(!configLoaded)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    loadAppConfig()
      .then((nextConfig) => {
        if (!mounted) return
        setConfig(nextConfig)
        setError('')
      })
      .catch((err) => {
        if (!mounted) return
        setError(err.message || '应用配置同步失败')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { config, loading, error }
}
