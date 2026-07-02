import { useEffect, useMemo, useRef, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import AppIcon from '../../components/AppIcon'
import AgreementModal from '../../components/AgreementModal'
import BrandLogo from '../../components/BrandLogo'
import PageBackButton from '../../components/PageBackButton'
import { captureInviteFromParams } from '../../platform/invite'
import { useAppConfig } from '../../hooks/useAppConfig'
import { formatAgreementContent } from '../../utils/agreement'
import { goPage, goTab } from '../../utils/navigation'
import { acceptAgreement, saveAuth } from '../../utils/storage'
import {
  createXAuthorizeUrl,
  fetchAgreement,
  getClientRuntime,
  getFrontendLoginConfig,
  loginDev,
  loginRuntime
} from '../../services/api'

const X_CODE_VERIFIER_KEY = 'seeFactoryXCodeVerifier'
const X_REDIRECT_URI_KEY = 'seeFactoryXRedirectUri'
const X_RETURN_TO_KEY = 'seeFactoryXReturnTo'
const X_ACCEPTED_AGREEMENTS_KEY = 'seeFactoryXAcceptedAgreements'
const REQUIRED_AGREEMENTS = [
  { type: 'user', label: '鐢ㄦ埛鍗忚' },
  { type: 'privacy', label: '闅愮鏀跨瓥' },
  { type: 'creator', label: '鍒涗綔涓庣敓鎴愭湇鍔℃潯娆? }
]

const runtimeMeta = {
  'telegram-tma': {
    title: 'Telegram Mini App 鐧诲綍',
    subtitle: '閫氳繃 Telegram 鎺堟潈杩涘叆 seeFactory',
    action: '缁х画浣跨敤 Telegram',
    icon: 'login'
  },
  'wechat-miniapp': {
    title: '寰俊灏忕▼搴忕櫥褰?,
    subtitle: '浣跨敤寰俊鐧诲綍鍑瘉鎹㈠彇 seeFactory 璐﹀彿',
    action: '寰俊涓€閿櫥褰?,
    icon: 'login'
  },
  'alipay-miniapp': {
    title: '鏀粯瀹濆皬绋嬪簭鐧诲綍',
    subtitle: '浣跨敤鏀粯瀹濇巿鏉冪爜鎹㈠彇 seeFactory 璐﹀彿',
    action: '鏀粯瀹濅竴閿櫥褰?,
    icon: 'login'
  },
  'douyin-miniapp': {
    title: '鎶栭煶灏忕▼搴忕櫥褰?,
    subtitle: '浣跨敤鎶栭煶鐧诲綍鍑瘉鎹㈠彇 seeFactory 璐﹀彿',
    action: '鎶栭煶涓€閿櫥褰?,
    icon: 'login'
  },
  'qq-miniapp': {
    title: 'QQ 灏忕▼搴忕櫥褰?,
    subtitle: '浣跨敤 QQ 鐧诲綍鍑瘉鎹㈠彇 seeFactory 璐﹀彿',
    action: 'QQ 涓€閿櫥褰?,
    icon: 'login'
  },
  'h5-google': {
    title: 'H5 璐︽埛鐧诲綍',
    subtitle: '鍙娇鐢?Google 鎴?X 璐︽埛杩涘叆 seeFactory',
    action: 'Google 璐︽埛鐧诲綍',
    icon: 'login'
  }
}

function readWindowParams() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search || '')
  const hash = window.location.hash || ''
  const hashQuery = hash.includes('?') ? new URLSearchParams(hash.slice(hash.indexOf('?') + 1)) : null
  return {
    code: params.get('code') || hashQuery?.get('code') || '',
    state: params.get('state') || hashQuery?.get('state') || '',
    error: params.get('error') || hashQuery?.get('error') || ''
  }
}

function randomBase64Url(byteLength = 48) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength)
    window.crypto.getRandomValues(bytes)
    return Array.from(bytes).map((byte) => chars[byte % chars.length]).join('')
  }
  return Array.from({ length: byteLength }).map(() => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function sha256Base64Url(value) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('褰撳墠娴忚鍣ㄤ笉鏀寔瀹夊叏鎺堟潈鐧诲綍')
  }
  const bytes = new TextEncoder().encode(value)
  const digest = await window.crypto.subtle.digest('SHA-256', bytes)
  const binary = String.fromCharCode(...new Uint8Array(digest))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function loadScript(src) {
  if (typeof document === 'undefined') return Promise.reject(new Error('褰撳墠鐜涓嶆敮鎸佺綉椤电櫥褰?))
  const existed = document.querySelector(`script[src="${src}"]`)
  if (existed) {
    return existed.dataset.loaded === 'true'
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
        existed.addEventListener('load', resolve, { once: true })
        existed.addEventListener('error', reject, { once: true })
      })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export default function Login() {
  const router = getCurrentInstance().router || {}
  const params = router.params || {}
  const { redirect } = params
  const [agreed, setAgreed] = useState(false)
  const [account, setAccount] = useState('demo@seefactory.ai')
  const [loading, setLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [agreementCache, setAgreementCache] = useState({})
  const [agreementModal, setAgreementModal] = useState(null)
  const googleHostId = useRef(`google-login-${Date.now()}`)
  const loginPullStartYRef = useRef(0)
  const { config } = useAppConfig()
  const runtime = getClientRuntime()
  const loginConfig = getFrontendLoginConfig()
  const target = redirect ? decodeURIComponent(redirect) : '/pages/index/index'
  const meta = runtimeMeta[runtime] || runtimeMeta['h5-google']
  const isH5 = runtime === 'h5-google'
  const isTelegram = runtime === 'telegram-tma'
  const isDevLoginVisible = loginConfig.devLoginEnabled

  const xRedirectUri = useMemo(() => {
    if (loginConfig.xRedirectUri) return loginConfig.xRedirectUri
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}${window.location.pathname}`
  }, [loginConfig.xRedirectUri])

  useEffect(() => {
    captureInviteFromParams(params || {})
  }, [params])

  const loadAgreement = async (type) => {
    const cached = agreementCache[type]
    const agreement = cached || await fetchAgreement(type)
    if (!cached) {
      setAgreementCache((current) => ({ ...current, [type]: agreement }))
    }
    return agreement
  }

  const showAgreement = async (type) => {
    Taro.showLoading({ title: '鍔犺浇鍗忚' })
    try {
      const agreement = await loadAgreement(type)
      Taro.hideLoading()
      const meta = REQUIRED_AGREEMENTS.find((item) => item.type === type)
      setAgreementModal({
        title: agreement.title || meta?.label || '鍗忚',
        content: formatAgreementContent(agreement, config?.legal),
      })
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: error.message || '鍗忚鏆傛湭鍙戝竷', icon: 'none' })
    }
  }

  const ensureLoginAgreements = async () => {
    const agreements = []
    for (const item of REQUIRED_AGREEMENTS) {
      agreements.push(await loadAgreement(item.type))
    }
    return agreements
  }

  const completeLogin = async (runner, successTarget = target, options = {}) => {
    if (!options.skipAgreement && !agreed) {
      Taro.showToast({ title: '璇峰厛鍚屾剰鐢ㄦ埛鍗忚銆侀殣绉佹斂绛栧拰鍒涗綔涓庣敓鎴愭湇鍔℃潯娆?, icon: 'none' })
      return
    }
    setLoading(true)
    Taro.showLoading({ title: '鐧诲綍涓? })
    try {
      const acceptedAgreements = options.skipAgreement ? [] : await ensureLoginAgreements()
      const data = await runner()
      saveAuth(data)
      const agreementsToStore = options.acceptedAgreements || acceptedAgreements
      agreementsToStore.forEach((agreement) => {
        const version = agreement?.version || agreement?.id || agreement?.updatedAt
        acceptAgreement(agreement?.type, version)
      })
      Taro.showToast({ title: '鐧诲綍鎴愬姛', icon: 'success' })
      await Promise.resolve(goPage(successTarget, { replace: true }))
    } catch (error) {
      Taro.showToast({ title: error.message || '鐧诲綍澶辫触锛岃閲嶈瘯', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setLoading(false)
    }
  }

  useEffect(() => {
    const callback = readWindowParams()
    if (callback.error) {
      Taro.showToast({ title: 'X 鎺堟潈宸插彇娑堟垨澶辫触', icon: 'none' })
      return
    }
    if (!callback.code || !callback.state) return
    const codeVerifier = Taro.getStorageSync(X_CODE_VERIFIER_KEY)
    const redirectUri = Taro.getStorageSync(X_REDIRECT_URI_KEY) || xRedirectUri
    const returnTo = Taro.getStorageSync(X_RETURN_TO_KEY) || target
    const acceptedAgreements = Taro.getStorageSync(X_ACCEPTED_AGREEMENTS_KEY) || []
    if (!codeVerifier) {
      Taro.showToast({ title: 'X 鐧诲綍鐘舵€佸凡杩囨湡锛岃閲嶆柊鎺堟潈', icon: 'none' })
      return
    }
    Taro.removeStorageSync(X_CODE_VERIFIER_KEY)
    Taro.removeStorageSync(X_REDIRECT_URI_KEY)
    Taro.removeStorageSync(X_RETURN_TO_KEY)
    Taro.removeStorageSync(X_ACCEPTED_AGREEMENTS_KEY)
    setAgreed(true)
    completeLogin(() => loginRuntime({
      clientRuntime: 'h5-x',
      code: callback.code,
      state: callback.state,
      codeVerifier,
      redirectUri
    }), returnTo, { skipAgreement: true, acceptedAgreements })
  }, [])

  useEffect(() => {
    if (!isH5 || !loginConfig.googleClientId) return
    let cancelled = false
    loadScript('https://accounts.google.com/gsi/client?hl=zh-CN')
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return
        window.google.accounts.id.initialize({
          client_id: loginConfig.googleClientId,
          callback: (response) => {
            if (!response?.credential) {
              Taro.showToast({ title: 'Google 鎺堟潈澶辫触锛岃閲嶈瘯', icon: 'none' })
              return
            }
            completeLogin(() => loginRuntime({ clientRuntime: 'h5-google', idToken: response.credential }))
          }
        })
        const host = document.getElementById(googleHostId.current)
        if (host) {
          host.innerHTML = ''
          window.google.accounts.id.renderButton(host, {
            theme: 'filled_black',
            size: 'large',
            type: 'standard',
            shape: 'pill',
            text: 'signin_with',
            locale: 'zh-CN',
            width: Math.min(320, Math.max(260, host.clientWidth || 300))
          })
          setGoogleReady(true)
        }
      })
      .catch(() => {
        Taro.showToast({ title: 'Google 鐧诲綍缁勪欢鍔犺浇澶辫触', icon: 'none' })
      })
    return () => {
      cancelled = true
    }
  }, [isH5, loginConfig.googleClientId, agreed])

  const handleRuntimeLogin = () => {
    if (isTelegram && typeof window !== 'undefined') {
      try {
        window.Telegram?.WebApp?.ready?.()
        window.Telegram?.WebApp?.expand?.()
      } catch (_) {}
    }
    completeLogin(() => loginRuntime())
  }

  const handleDevLogin = () => {
    if (!account) {
      Taro.showToast({ title: '璇疯緭鍏ュ紑鍙戣处鍙?, icon: 'none' })
      return
    }
    completeLogin(() => loginDev(account))
  }

  const refreshLoginPage = () => {
    setAgreementCache({})
    if (isTelegram && typeof window !== 'undefined') {
      try {
        window.Telegram?.WebApp?.ready?.()
        window.Telegram?.WebApp?.expand?.()
      } catch (_) {}
    }
    Taro.showToast({ title: '鐧诲綍椤靛凡鍒锋柊', icon: 'none' })
  }

  const handleLoginTouchStart = (event) => {
    loginPullStartYRef.current = Number(event?.touches?.[0]?.clientY || 0)
  }

  const handleLoginTouchEnd = (event) => {
    if (!loginPullStartYRef.current) return
    const endY = Number(event?.changedTouches?.[0]?.clientY || loginPullStartYRef.current)
    const pulledDistance = endY - loginPullStartYRef.current
    loginPullStartYRef.current = 0
    if (pulledDistance >= 72) refreshLoginPage()
  }

  const handleXLogin = async () => {
    if (!agreed) {
      Taro.showToast({ title: '璇峰厛鍚屾剰鐢ㄦ埛鍗忚銆侀殣绉佹斂绛栧拰鍒涗綔涓庣敓鎴愭湇鍔℃潯娆?, icon: 'none' })
      return
    }
    if (!xRedirectUri) {
      Taro.showToast({ title: '璇峰厛閰嶇疆 X 鐧诲綍鍥炶皟鍦板潃', icon: 'none' })
      return
    }
    setLoading(true)
    Taro.showLoading({ title: '鍑嗗鎺堟潈' })
    try {
      const acceptedAgreements = await ensureLoginAgreements()
      const codeVerifier = randomBase64Url()
      const codeChallenge = await sha256Base64Url(codeVerifier)
      const result = await createXAuthorizeUrl({ codeChallenge, redirectUri: xRedirectUri })
      Taro.setStorageSync(X_CODE_VERIFIER_KEY, codeVerifier)
      Taro.setStorageSync(X_REDIRECT_URI_KEY, xRedirectUri)
      Taro.setStorageSync(X_RETURN_TO_KEY, target)
      Taro.setStorageSync(X_ACCEPTED_AGREEMENTS_KEY, acceptedAgreements.map((agreement) => ({
        type: agreement.type,
        version: agreement.version || agreement.id || agreement.updatedAt
      })))
      if (typeof window !== 'undefined') {
        window.location.href = result.authorizeUrl
      }
    } catch (error) {
      Taro.showToast({ title: error.message || 'X 鎺堟潈鍚姩澶辫触', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setLoading(false)
    }
  }

  return (
    <View className='login-wrap page-transition' onTouchStart={handleLoginTouchStart} onTouchEnd={handleLoginTouchEnd}>
      <PageBackButton fallbackUrl='/pages/index/index' />
      <BrandLogo size={58} className='login-logo' />
      <View className='login-card'>
        <Text className='hero-kicker'>seeFactory</Text>
        <Text className='hero-title'>seeFactory</Text>
        <Text className='hero-subtitle'>{meta.subtitle}銆傛渚嬪畬鏁存彁绀鸿瘝鏃犻渶鐧诲綍銆?/Text>

        <View className='platform-panel'>
          <View className='platform-badge'>
            <AppIcon name={meta.icon} size={16} />
            <Text>{meta.title}</Text>
          </View>
          {isTelegram && (
            <Text className='platform-hint'>璇峰湪 Telegram 鍐呮墦寮€ seeFactory锛屾巿鏉冧俊鎭粎鐢ㄤ簬瀹屾垚鐧诲綍銆?/Text>
          )}
          {!isH5 && (
            <View className={loading ? 'primary-button disabled' : 'primary-button'} onClick={handleRuntimeLogin}>
              <AppIcon name='login' size={16} />
              <Text>{meta.action}</Text>
            </View>
          )}
          {isH5 && (
            <View className='h5-login-stack'>
              <View id={googleHostId.current} className='google-button-host' />
              {!loginConfig.googleClientId && (
                <View className='login-warning'>
                  <Text>Google 鐧诲綍鏆傛湭寮€鏀俱€?/Text>
                </View>
              )}
              {loginConfig.googleClientId && !googleReady && (
                <View className='ghost-button glass-button'>
                  <AppIcon name='refresh' size={16} />
                  <Text>鍑嗗 Google 鐧诲綍</Text>
                </View>
              )}
              <View className={loading ? 'ghost-button glass-button disabled' : 'ghost-button glass-button'} onClick={handleXLogin}>
                <AppIcon name='login' size={16} />
                <Text>浣跨敤 X 璐︽埛鐧诲綍</Text>
              </View>
            </View>
          )}
        </View>

        {isDevLoginVisible && (
          <View className='dev-login-panel'>
            <Text className='input-label'>寮€鍙戣处鍙?/Text>
            <Input className='text-input' value={account} onInput={(event) => setAccount(event.detail.value)} />
            <View className='ghost-button glass-button block-gap' onClick={handleDevLogin}>
              <AppIcon name='lock' size={16} />
              <Text>璐﹀彿鐧诲綍</Text>
            </View>
          </View>
        )}

        <View className='checkbox-row'>
          <View className={agreed ? 'fake-check checked' : 'fake-check'} onClick={() => setAgreed(!agreed)}>{agreed ? '鉁? : ''}</View>
          <View className='agreement-copy'>
            <Text onClick={() => setAgreed(!agreed)}>鎴戝凡闃呰骞跺悓鎰?/Text>
            {REQUIRED_AGREEMENTS.map((item) => (
              <Text key={item.type} className='agreement-link' onClick={() => showAgreement(item.type)}>銆妠item.label}銆?/Text>
            ))}
          </View>
        </View>

        <View className='ghost-button glass-button block-gap' onClick={() => goTab('/pages/index/index')}>
          <AppIcon name='home' size={16} />
          <Text>鍏堥€涢€?/Text>
        </View>
        <AgreementModal
          open={Boolean(agreementModal)}
          title={agreementModal?.title}
          content={agreementModal?.content}
          onClose={() => setAgreementModal(null)}
        />
      </View>
    </View>
  )
}
