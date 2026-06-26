import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { AUTH_CHANGED_EVENT, getCurrentUser, isLoggedIn } from '../utils/storage'

function authSnapshot(detail = {}) {
  return {
    loggedIn: typeof detail.loggedIn === 'boolean' ? detail.loggedIn : isLoggedIn(),
    user: detail.user !== undefined ? detail.user : getCurrentUser(),
    changedAt: detail.changedAt || Date.now()
  }
}

export function useAuthStatus() {
  const [auth, setAuth] = useState(() => authSnapshot())

  useEffect(() => {
    let disposed = false
    let appResumeListener
    const refresh = (eventOrDetail = {}) => {
      if (disposed) return
      const detail = eventOrDetail?.detail || eventOrDetail || {}
      setAuth(authSnapshot(detail))
    }
    const refreshFromStorage = () => refresh({})
    const refreshOnVisible = () => {
      if (typeof document === 'undefined' || !document.hidden) refreshFromStorage()
    }

    try {
      Taro.eventCenter?.on?.(AUTH_CHANGED_EVENT, refresh)
    } catch (_) {}

    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_CHANGED_EVENT, refresh)
      window.addEventListener('focus', refreshFromStorage)
      window.addEventListener('pageshow', refreshFromStorage)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', refreshOnVisible)
    }

    refreshFromStorage()

    Promise.all([
      import('@capacitor/app'),
      import('@capacitor/core')
    ])
      .then(([{ App }, { Capacitor }]) => {
        if (disposed || !Capacitor.isNativePlatform?.()) return
        return App.addListener('resume', refreshFromStorage)
      })
      .then((listener) => {
        if (disposed) {
          listener?.remove?.()
          return
        }
        appResumeListener = listener
      })
      .catch(() => {})

    return () => {
      disposed = true
      appResumeListener?.remove?.()
      try {
        Taro.eventCenter?.off?.(AUTH_CHANGED_EVENT, refresh)
      } catch (_) {}
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_CHANGED_EVENT, refresh)
        window.removeEventListener('focus', refreshFromStorage)
        window.removeEventListener('pageshow', refreshFromStorage)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', refreshOnVisible)
      }
    }
  }, [])

  return auth
}
