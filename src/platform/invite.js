import Taro from '@tarojs/taro'

const INVITE_KEY = 'seeFactoryInviteCode'
const SOURCE_KEY = 'seeFactoryInviteSource'

function normalize(value) {
  const text = String(value || '').trim().replace(/\s+/g, '')
  return text ? text.slice(0, 64) : ''
}

function readFromParamText(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  if (raw.includes('=')) {
    const query = raw.startsWith('?') ? raw.slice(1) : raw
    const params = new URLSearchParams(query)
    return normalize(params.get('inviteCode') || params.get('invite') || params.get('ref') || params.get('scene'))
  }
  return normalize(raw)
}

function readTelegramStartParam() {
  if (typeof window === 'undefined') return ''
  const webApp = window.Telegram?.WebApp
  return normalize(webApp?.initDataUnsafe?.start_param || webApp?.initDataUnsafe?.startParam)
}

function readH5Query() {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search || '')
  return normalize(params.get('inviteCode') || params.get('invite') || params.get('ref') || params.get('start_param'))
}

export function getStoredInviteCode() {
  return normalize(Taro.getStorageSync(INVITE_KEY))
}

export function captureInviteFromParams(params = {}) {
  const inviteCode = normalize(params.inviteCode || params.invite || params.ref)
    || readFromParamText(params.scene)
    || readFromParamText(params.startParam || params.start_param)
    || readTelegramStartParam()
    || readH5Query()

  if (inviteCode) {
    Taro.setStorageSync(INVITE_KEY, inviteCode)
    Taro.setStorageSync(SOURCE_KEY, params.source || params.channel || 'entry')
  }
  return inviteCode || getStoredInviteCode()
}

export function withInvitePayload(payload = {}) {
  const inviteCode = getStoredInviteCode()
  if (!inviteCode) return payload
  return {
    ...payload,
    inviteCode
  }
}
