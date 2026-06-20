import { useEffect, useMemo, useRef, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { captureInviteFromParams } from '../../platform/invite'
import { useAppConfig } from '../../hooks/useAppConfig'
import { formatAgreementContent } from '../../utils/agreement'
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
  { type: 'user', label: '用户协议' },
  { type: 'privacy', label: '隐私政策' },
  { type: 'creator', label: '创作与生成服务条款' }
]

const runtimeMeta = {
  'telegram-tma': {
    title: 'Telegram Mini App 登录',
    subtitle: '使用 Telegram initData 完成安全登录',
    action: '继续使用 Telegram',
    icon: 'login'
  },
  'wechat-miniapp': {
    title: '微信小程序登录',
    subtitle: '使用微信登录凭证换取 seeFactory 账号',
    action: '微信一键登录',
    icon: 'login'
  },
  'alipay-miniapp': {
    title: '支付宝小程序登录',
    subtitle: '使用支付宝授权码换取 seeFactory 账号',
    action: '支付宝一键登录',
    icon: 'login'
  },
  'douyin-miniapp': {
    title: '抖音小程序登录',
    subtitle: '使用抖音登录凭证换取 seeFactory 账号',
    action: '抖音一键登录',
    icon: 'login'
  },
  'qq-miniapp': {
    title: 'QQ 小程序登录',
    subtitle: '使用 QQ 登录凭证换取 seeFactory 账号',
    action: 'QQ 一键登录',
    icon: 'login'
  },
  'h5-google': {
    title: 'H5 账户登录',
    subtitle: '可使用 Google 或 X 账户进入 seeFactory',
    action: 'Google 账户登录',
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
    throw new Error('当前浏览器不支持安全 OAuth 登录')
  }
  const bytes = new TextEncoder().encode(value)
  const digest = await window.crypto.subtle.digest('SHA-256', bytes)
  const binary = String.fromCharCode(...new Uint8Array(digest))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function loadScript(src) {
  if (typeof document === 'undefined') return Promise.reject(new Error('当前环境不支持网页登录'))
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
  const googleHostId = useRef(`google-login-${Date.now()}`)
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
    Taro.showLoading({ title: '加载协议' })
    try {
      const agreement = await loadAgreement(type)
      Taro.hideLoading()
      const meta = REQUIRED_AGREEMENTS.find((item) => item.type === type)
      Taro.showModal({
        title: agreement.title || meta?.label || '协议',
        content: formatAgreementContent(agreement, config?.legal),
        showCancel: false,
        confirmText: '我知道了'
      })
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: error.message || '协议暂未发布', icon: 'none' })
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
      Taro.showToast({ title: '请先同意用户协议、隐私政策和创作与生成服务条款', icon: 'none' })
      return
    }
    setLoading(true)
    Taro.showLoading({ title: '登录中' })
    try {
      const acceptedAgreements = options.skipAgreement ? [] : await ensureLoginAgreements()
      const data = await runner()
      saveAuth(data)
      const agreementsToStore = options.acceptedAgreements || acceptedAgreements
      agreementsToStore.forEach((agreement) => {
        const version = agreement?.version || agreement?.id || agreement?.updatedAt
        acceptAgreement(agreement?.type, version)
      })
      Taro.showToast({ title: '登录成功', icon: 'success' })
      Taro.redirectTo({ url: successTarget })
    } catch (error) {
      Taro.showToast({ title: error.message || '登录失败，请重试', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setLoading(false)
    }
  }

  useEffect(() => {
    const callback = readWindowParams()
    if (callback.error) {
      Taro.showToast({ title: 'X 授权已取消或失败', icon: 'none' })
      return
    }
    if (!callback.code || !callback.state) return
    const codeVerifier = Taro.getStorageSync(X_CODE_VERIFIER_KEY)
    const redirectUri = Taro.getStorageSync(X_REDIRECT_URI_KEY) || xRedirectUri
    const returnTo = Taro.getStorageSync(X_RETURN_TO_KEY) || target
    const acceptedAgreements = Taro.getStorageSync(X_ACCEPTED_AGREEMENTS_KEY) || []
    if (!codeVerifier) {
      Taro.showToast({ title: 'X 登录状态已过期，请重新授权', icon: 'none' })
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
              Taro.showToast({ title: 'Google 授权失败，请重试', icon: 'none' })
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
        Taro.showToast({ title: 'Google 登录组件加载失败', icon: 'none' })
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
      Taro.showToast({ title: '请输入开发账号', icon: 'none' })
      return
    }
    completeLogin(() => loginDev(account))
  }

  const handleXLogin = async () => {
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议、隐私政策和创作与生成服务条款', icon: 'none' })
      return
    }
    if (!xRedirectUri) {
      Taro.showToast({ title: '请先配置 X 登录回调地址', icon: 'none' })
      return
    }
    setLoading(true)
    Taro.showLoading({ title: '准备授权' })
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
      Taro.showToast({ title: error.message || 'X 授权启动失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setLoading(false)
    }
  }

  return (
    <View className='login-wrap'>
      <BrandLogo size={58} className='login-logo' />
      <View className='login-card'>
        <Text className='hero-kicker'>seeFactory</Text>
        <Text className='hero-title'>AI 创作工厂</Text>
        <Text className='hero-subtitle'>{meta.subtitle}。案例完整提示词无需登录。</Text>

        <View className='platform-panel'>
          <View className='platform-badge'>
            <AppIcon name={meta.icon} size={16} />
            <Text>{meta.title}</Text>
          </View>
          {isTelegram && (
            <Text className='platform-hint'>请在 Telegram 内打开本页面。登录时只会提交 Telegram initData 原始字符串。</Text>
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
                  <Text>Google 登录需配置 SEEFACTORY_GOOGLE_CLIENT_ID。</Text>
                </View>
              )}
              {loginConfig.googleClientId && !googleReady && (
                <View className='ghost-button glass-button'>
                  <AppIcon name='refresh' size={16} />
                  <Text>加载 Google 登录</Text>
                </View>
              )}
              <View className={loading ? 'ghost-button glass-button disabled' : 'ghost-button glass-button'} onClick={handleXLogin}>
                <AppIcon name='login' size={16} />
                <Text>使用 X 账户登录</Text>
              </View>
            </View>
          )}
        </View>

        {isDevLoginVisible && (
          <View className='dev-login-panel'>
            <Text className='input-label'>开发账号</Text>
            <Input className='text-input' value={account} onInput={(event) => setAccount(event.detail.value)} />
            <View className='ghost-button glass-button block-gap' onClick={handleDevLogin}>
              <AppIcon name='lock' size={16} />
              <Text>开发环境账号登录</Text>
            </View>
          </View>
        )}

        <View className='checkbox-row'>
          <View className={agreed ? 'fake-check checked' : 'fake-check'} onClick={() => setAgreed(!agreed)}>{agreed ? '✓' : ''}</View>
          <View className='agreement-copy'>
            <Text onClick={() => setAgreed(!agreed)}>我已阅读并同意</Text>
            {REQUIRED_AGREEMENTS.map((item) => (
              <Text key={item.type} className='agreement-link' onClick={() => showAgreement(item.type)}>《{item.label}》</Text>
            ))}
          </View>
        </View>

        <View className='ghost-button glass-button block-gap' onClick={() => Taro.redirectTo({ url: '/pages/index/index' })}>
          <AppIcon name='home' size={16} />
          <Text>先逛逛</Text>
        </View>
      </View>
    </View>
  )
}
