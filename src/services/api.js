import Taro from '@tarojs/taro'
import { getAuthToken, saveAuth } from '../utils/storage'

const API_BASE = 'http://127.0.0.1:10087/api/v1'

function token() {
  return getAuthToken()
}

export function toApiWork(item) {
  return {
    id: item.id,
    title: item.galleryTitle || item.title || item.prompt?.slice(0, 18) || 'seeFactory 作品',
    category: item.type || item.category || 'image',
    toolName: item.toolName || item.toolKey || 'AI 工具',
    toolKey: item.toolKey,
    status: item.status || 'success',
    date: item.galleryPublishedAt || item.createdAt || '',
    image: item.coverUrl || item.resultUrls?.[0] || item.image,
    coverUrl: item.coverUrl,
    resultUrls: item.resultUrls || [],
    generationTaskId: item.generationTaskId,
    prompt: item.prompt,
    params: item.params || {},
    failureReason: item.failureReason || item.failReason,
    failReason: item.failureReason || item.failReason,
    downloadEnabled: item.downloadEnabled !== false,
    galleryVisible: item.galleryVisible,
    galleryStatus: item.galleryStatus,
    author: item.author
  }
}

export function getClientRuntime() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) return 'telegram-tma'
  if (process.env.TARO_ENV === 'weapp') return 'wechat-miniapp'
  if (process.env.TARO_ENV === 'alipay') return 'alipay-miniapp'
  if (process.env.TARO_ENV === 'tt') return 'douyin-miniapp'
  if (process.env.TARO_ENV === 'qq') return 'qq-miniapp'
  return 'h5-google'
}

export async function request(path, options = {}) {
  const header = {
    'content-type': 'application/json',
    ...(token() ? { authorization: `Bearer ${token()}` } : {}),
    ...(options.header || {})
  }
  const response = await Taro.request({
    url: `${API_BASE}${path}`,
    method: options.method || 'GET',
    data: options.data,
    header
  })
  const body = response.data || {}
  if (response.statusCode >= 400 || body.success === false) {
    const error = new Error(body.userMessage || body.message || '请求失败')
    error.code = body.code
    error.action = body.action
    error.fieldErrors = body.fieldErrors
    error.response = body
    throw error
  }
  return body.data
}

export async function fetchGalleryWorks(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 20)
  })
  if (params.featured) query.set('featured', 'true')
  if (params.toolKey) query.set('toolKey', params.toolKey)
  const data = await request(`/gallery/works?${query.toString()}`)
  return {
    ...data,
    list: (data.list || []).map(toApiWork)
  }
}

export async function fetchGalleryWork(id) {
  return toApiWork(await request(`/gallery/works/${id}`))
}

export async function fetchAppConfig() {
  return request('/app/config')
}

export async function fetchTools(params = {}) {
  const query = new URLSearchParams()
  if (params.featured) query.set('featured', 'true')
  if (params.category && params.category !== 'all') query.set('category', params.category)
  const list = await request(`/tools${query.toString() ? `?${query.toString()}` : ''}`)
  return (list || []).map((item) => ({
    id: item.toolKey || item.id,
    category: item.category,
    name: item.name,
    label: item.featured ? '推荐' : '工具',
    tone: 'cyan',
    featured: item.featured,
    icon: item.icon || 'wand',
    desc: item.description || item.desc,
    cost: item.cost,
    fields: item.fields || [],
    options: item.options || {}
  }))
}

export async function fetchToolCategories() {
  const list = await request('/tools/categories')
  return [{ key: 'all', label: '全部产品' }].concat((list || []).map((item) => ({
    key: item.key,
    label: item.name || item.label
  })))
}

export async function fetchTool(toolKey) {
  const item = await request(`/tools/${toolKey}`)
  return {
    id: item.toolKey || item.id,
    category: item.category,
    name: item.name,
    label: item.featured ? '推荐' : '工具',
    tone: 'cyan',
    featured: item.featured,
    icon: item.icon || 'wand',
    desc: item.description || item.desc,
    cost: item.cost,
    fields: item.fields || [],
    options: item.options || {}
  }
}

export async function fetchPromptCases(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 20)
  })
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.category && params.category !== 'all') query.set('category', params.category)
  const data = await request(`/prompt-cases?${query.toString()}`)
  return {
    ...data,
    list: (data.list || []).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      toolId: item.toolKey,
      date: item.createdAt,
      tags: item.tags || [],
      image: item.coverUrl || item.outputUrl,
      prompt: item.prompt
    }))
  }
}

export async function fetchPromptCase(id) {
  const item = await request(`/prompt-cases/${id}`)
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    toolId: item.toolKey,
    date: item.createdAt,
    tags: item.tags || [],
    image: item.coverUrl || item.outputUrl,
    prompt: item.prompt
  }
}

export async function fetchWorks(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 20)
  })
  if (params.status) query.set('status', params.status)
  const data = await request(`/works?${query.toString()}`)
  return {
    ...data,
    list: (data.list || []).map(toApiWork)
  }
}

export async function fetchWork(id) {
  return toApiWork(await request(`/works/${id}`))
}

export async function createGenerationTask(payload) {
  return request('/generation-tasks', {
    method: 'POST',
    data: payload
  })
}

export async function fetchGenerationTask(id) {
  return request(`/generation-tasks/${id}`)
}

export async function cancelGenerationTask(id) {
  return request(`/generation-tasks/${id}/cancel`, { method: 'POST' })
}

export async function retryGenerationTask(id) {
  return request(`/generation-tasks/${id}/retry`, { method: 'POST' })
}

export async function deleteWorkRemote(id) {
  return request(`/works/${id}`, { method: 'DELETE' })
}

export async function clearFailedWorksRemote() {
  return request('/works/clear-failed', { method: 'POST' })
}

export async function loginDev(account = 'demo@seefactory.ai') {
  const data = await request('/auth/dev-account-login', {
    method: 'POST',
    data: { account, nickname: 'seeFactory 创作者' }
  })
  saveAuth(data)
  return data
}

export async function loginRuntime(providerUserId = 'demo-user') {
  const data = await request('/auth/wechat-miniapp-login', {
    method: 'POST',
    data: { providerUserId, nickname: 'seeFactory 创作者' }
  })
  saveAuth(data)
  return data
}

export async function fetchMe() {
  return request('/auth/me')
}

export async function fetchCreditBalance() {
  return request('/credits/balance')
}

export async function fetchCreditTransactions(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 20)
  })
  return request(`/credits/transactions?${query.toString()}`)
}

export async function fetchRechargeSettings() {
  return request('/credits/recharge-settings')
}

export async function fetchPaymentProviders(clientRuntime = getClientRuntime()) {
  const query = new URLSearchParams({ clientRuntime })
  return request(`/payments/providers?${query.toString()}`)
}

export async function createRechargeOrder(payload) {
  return request('/credits/recharge-orders', {
    method: 'POST',
    data: payload
  })
}

export async function createGenerationPaymentOrder(payload) {
  return request('/credits/generation-payment-orders', {
    method: 'POST',
    data: payload
  })
}

export async function fetchPaymentOrder(orderId) {
  return request(`/payments/orders/${orderId}`)
}

export async function createCryptoOrder(payload) {
  return request('/payments/crypto-orders', {
    method: 'POST',
    data: payload
  })
}

export async function fetchCryptoOrder(id) {
  return request(`/payments/crypto-orders/${id}`)
}

export async function createTelegramStarsOrder(payload) {
  return request('/payments/telegram-stars-orders', {
    method: 'POST',
    data: payload
  })
}

export async function fetchTelegramStarsOrder(id) {
  return request(`/payments/telegram-stars-orders/${id}`)
}

export async function getUploadToken(payload) {
  return request('/assets/upload-token', {
    method: 'POST',
    data: payload
  })
}

export async function createAsset(payload) {
  return request('/assets', {
    method: 'POST',
    data: payload
  })
}

export async function fetchCustomerService() {
  return request('/customer-service')
}

export async function fetchAgreement(type = 'user') {
  return request(`/agreements/${type}`)
}

export async function fetchAgentProfile() {
  return request('/agent/profile')
}

export async function fetchAgentInviteCode() {
  return request('/agent/invite-code')
}

export async function fetchAgentStats() {
  return request('/agent/stats')
}

export async function publishGalleryWork(id) {
  return request(`/works/${id}/publish-gallery`, { method: 'POST' })
}

export async function unpublishGalleryWork(id) {
  return request(`/works/${id}/unpublish-gallery`, { method: 'POST' })
}

export async function getDownloadUrl(id) {
  return request(`/works/${id}/download-url`)
}
