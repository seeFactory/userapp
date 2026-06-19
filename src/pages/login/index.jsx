import { useEffect, useState } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import AppIcon from '../../components/AppIcon'
import BrandLogo from '../../components/BrandLogo'
import { captureInviteFromParams } from '../../platform/invite'
import { login, saveAuth } from '../../utils/storage'
import { loginDev, loginRuntime } from '../../services/api'

export default function Login() {
  const params = getCurrentInstance().router.params
  const { redirect } = params
  const [agreed, setAgreed] = useState(false)
  const [mode, setMode] = useState('wechat')
  const [account, setAccount] = useState('demo@seefactory.ai')
  const [password, setPassword] = useState('123456')

  useEffect(() => {
    captureInviteFromParams(params || {})
  }, [params])

  const finishLogin = () => {
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' })
      return
    }
    if (mode === 'account' && (!account || !password)) {
      Taro.showToast({ title: '请输入账号和密码', icon: 'none' })
      return
    }
    const target = redirect ? decodeURIComponent(redirect) : '/pages/index/index'
    const remoteLogin = mode === 'account' ? loginDev(account) : loginRuntime(`wechat-${Date.now()}`)
    remoteLogin
      .then((data) => saveAuth(data))
      .catch(() => login())
      .finally(() => {
        Taro.showToast({ title: '登录成功', icon: 'success' })
        Taro.redirectTo({ url: target })
      })
  }

  return (
    <View className='login-wrap'>
      <BrandLogo size={58} className='login-logo' />
      <View className='login-card'>
        <Text className='hero-kicker'>seeFactory</Text>
        <Text className='hero-title'>AI 创作工厂</Text>
        <Text className='hero-subtitle'>登录后可提交生成、查看作品记录和进入代理中心。案例完整提示词无需登录。</Text>

        <View className='filter-row login-mode-row'>
          <View className={mode === 'wechat' ? 'filter-chip active' : 'filter-chip'} onClick={() => setMode('wechat')}>一键登录</View>
          <View className={mode === 'account' ? 'filter-chip active' : 'filter-chip'} onClick={() => setMode('account')}>账号密码</View>
        </View>

        {mode === 'account' && (
          <View>
            <Text className='input-label'>账号</Text>
            <Input className='text-input' value={account} onInput={(event) => setAccount(event.detail.value)} />
            <Text className='input-label'>密码</Text>
            <Input className='text-input' password value={password} onInput={(event) => setPassword(event.detail.value)} />
          </View>
        )}

        <View className='checkbox-row' onClick={() => setAgreed(!agreed)}>
          <View className={agreed ? 'fake-check checked' : 'fake-check'}>{agreed ? '✓' : ''}</View>
          <Text>我已阅读并同意《用户协议》和《隐私政策》</Text>
        </View>

        <View className='primary-button' onClick={finishLogin}>
          <AppIcon name='login' size={16} />
          <Text>{mode === 'wechat' ? '一键登录' : '账号密码登录'}</Text>
        </View>
        <View className='ghost-button glass-button block-gap' onClick={() => Taro.redirectTo({ url: '/pages/index/index' })}>
          <AppIcon name='home' size={16} />
          <Text>先逛逛</Text>
        </View>
      </View>
    </View>
  )
}
