import { useEffect, useState } from 'react'
import { getCurrentUser, isLoggedIn, subscribeAuthChange } from '../utils/storage'

function readAuthState() {
  return {
    loggedIn: isLoggedIn(),
    user: getCurrentUser()
  }
}

export function useAuthState() {
  const [authState, setAuthState] = useState(readAuthState)

  useEffect(() => {
    const syncAuthState = () => {
      setAuthState(readAuthState())
    }
    const unsubscribe = subscribeAuthChange(syncAuthState)
    syncAuthState()

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', syncAuthState)
      window.addEventListener('pageshow', syncAuthState)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', syncAuthState)
    }

    return () => {
      unsubscribe?.()
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', syncAuthState)
        window.removeEventListener('pageshow', syncAuthState)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', syncAuthState)
      }
    }
  }, [])

  return authState
}
