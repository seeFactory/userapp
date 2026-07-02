import Taro from '@tarojs/taro'
import { getAuthToken, getRefreshToken, logout, saveAuth } from '../utils/storage'
import { withInvitePayload } from '../platform/invite'
import { resolveClientRuntime } from '../platform/login'

const DEFAULT_API_BASE = 'http://127.0.0.1:10087/api/v1'
const API_BASE = (process.env.SEEFACTORY_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '')
const GOOGLE_CLIENT_ID = process.env.SEEFACTORY_GOOGLE_CLIENT_ID || ''
const X_REDIRECT_URI = process.env.SEEFACTORY_X_REDIRECT_URI || ''
const DEV_LOGIN_ENABLED = process.env.SEEFACTORY_DEV_LOGIN_ENABLED === 'true'
const CLIENT_VERSION = process.env.SEEFACTORY_CLIENT_VERSION || '0.1.0'
const RUNTIME_TARGET = process.env.SEEFACTORY_RUNTIME_TARGET || 'h5'
let refreshPromise = null

function token() {
  return getAuthToken()
}

const CACHE_TTL = {
  appConfig: 5 * 60 * 1000,
  catalog: 2 * 60 * 1000,
  list: 45 * 1000,
  account: 8 * 1000,
  payment: 5 * 1000
}
const responseCache = new Map()

function stableCacheValue(value) {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map(stableCacheValue)
  if (typeof value === 'object') {
    return Object.keys(value).sort().reduce((next, key) => {
      if (key !== 'force' && value[key] !== undefined) next[key] = stableCacheValue(value[key])
      return next
    }, {})
  }
  return value
}

function cacheKey(scope, params = {}, authScoped = false) {
  const authPart = authScoped ? `:${token() || 'anon'}` : ''
  return `${scope}${authPart}:${JSON.stringify(stableCacheValue(params))}`
}

async function withCache(key, ttl, loader, options = {}) {
  if (!options.force) {
    const cached = responseCache.get(key)
    if (cached && Date.now() - cached.createdAt < ttl) return cached.data
  }
  const data = await loader()
  responseCache.set(key, { data, createdAt: Date.now() })
  return data
}

export function invalidateApiCache(prefix = '') {
  if (!prefix) {
    responseCache.clear()
    return
  }
  Array.from(responseCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) responseCache.delete(key)
  })
}

function invalidateMany(prefixes) {
  prefixes.forEach((prefix) => invalidateApiCache(prefix))
}

function makeError(response, body) {
  const error = new Error(body.userMessage || body.message || '请求失败')
  error.code = body.code
  error.action = body.action
  error.fieldErrors = body.fieldErrors
  error.retryable = body.retryable
  error.requestId = body.requestId
  error.response = body
  error.statusCode = response.statusCode
  return error
}

function shouldRefresh(response, body) {
  return response.statusCode === 401 && ['TOKEN_INVALID', 'AUTH_REQUIRED'].includes(body.code)
}

function redirectLogin() {
  try {
    Taro.navigateTo({ url: '/pages/login/index' })
  } catch (error) {
    try {
      Taro.redirectTo({ url: '/pages/login/index' })
    } catch (_) {}
  }
}

function isVideoUrl(url = '') {
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(String(url))
}

function isImageUrl(url = '') {
  return /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(String(url))
}

export function inferWorkMediaKind(item = {}, url = '') {
  const text = `${item.category || ''} ${item.type || ''} ${item.toolKey || ''} ${item.mimeType || ''} ${url}`.toLowerCase()
  if (isVideoUrl(url) || text.includes('video') || text.includes('视频') || text.includes('video/')) return 'video'
  if (isImageUrl(url) || text.includes('image') || text.includes('图像') || text.includes('图片') || text.includes('image/')) return 'image'
  return 'file'
}

export function normalizeWorkMedia(item = {}) {
  const resultUrls = item.resultUrls || []
  const resultUrl = resultUrls[0] || item.resultUrl || item.outputUrl || ''
  const sourceImage = item.image || ''
  const mediaUrl = resultUrl || (!isImageUrl(sourceImage) && isVideoUrl(sourceImage) ? sourceImage : '') || item.coverUrl || sourceImage
  const mediaKind = item.mediaKind || inferWorkMediaKind(item, mediaUrl)
  const previewUrl = item.coverUrl || (isImageUrl(sourceImage) ? sourceImage : '') || (mediaKind === 'image' ? mediaUrl : '')
  return {
    ...item,
    category: item.category === 'image' && mediaKind === 'video' ? 'video' : item.category,
    mediaKind,
    mediaUrl,
    previewUrl,
    image: previewUrl
  }
}

export function toApiWork(item) {
  const category = item.type || item.category || 'image'
  return normalizeWorkMedia({
    id: item.id,
    title: item.galleryTitle || item.title || item.prompt?.slice(0, 18) || 'seeFactory 作品',
    category,
    toolName: item.toolName || item.toolKey || 'AI 工具',
    toolKey: item.toolKey,
    status: item.status || 'success',
    date: item.galleryPublishedAt || item.createdAt || '',
    image: item.image,
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
    shareTicket: item.shareTicket,
    author: item.author
  })
}

export function getClientRuntime() {
  return resolveClientRuntime({
    runtimeTarget: RUNTIME_TARGET,
    taroEnv: process.env.TARO_ENV,
    hasTelegramWebApp: typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp)
  })
}

export function getFrontendLoginConfig() {
  return {
    googleClientId: GOOGLE_CLIENT_ID,
    xRedirectUri: X_REDIRECT_URI,
    devLoginEnabled: DEV_LOGIN_ENABLED
  }
}

async function send(path, options = {}) {
  const header = {
    'content-type': 'application/json',
    'X-Client-Runtime': getClientRuntime(),
    'X-Client-Version': CLIENT_VERSION,
    ...(!options.noAuth && token() ? { authorization: `Bearer ${token()}` } : {}),
    ...(options.header || {})
  }
  return Taro.request({
    url: `${API_BASE}${path}`,
    method: options.method || 'GET',
    data: options.data,
    header,
    timeout: options.timeout || 15000
  })
}

async function refreshAuth() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  if (!refreshPromise) {
    refreshPromise = send('/auth/refresh', {
      method: 'POST',
      data: { refreshToken },
      noAuth: true
    })
      .then((response) => {
        const body = response.data || {}
        if (response.statusCode >= 400 || body.success === false) {
          throw makeError(response, body)
        }
        saveAuth(body.data)
        return true
      })
      .catch(() => {
        logout()
        return false
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function request(path, options = {}) {
  let response = await send(path, options)
  const body = response.data || {}
  if (response.statusCode >= 400 || body.success === false) {
    if (!options.skipRefresh && shouldRefresh(response, body)) {
      const refreshed = await refreshAuth()
      if (refreshed) {
        response = await send(path, { ...options, skipRefresh: true })
        const retryBody = response.data || {}
        if (response.statusCode < 400 && retryBody.success !== false) {
          return retryBody.data
        }
        throw makeError(response, retryBody)
      }
      redirectLogin()
    }
    throw makeError(response, body)
  }
  return body.data
}

export async function fetchGalleryWorks(params = {}) {
  const { force = false, ...queryParams } = params
  const query = new URLSearchParams({
    page: String(queryParams.page || 1),
    pageSize: String(queryParams.pageSize || 20)
  })
  if (queryParams.featured) query.set('featured', 'true')
  if (queryParams.toolKey) query.set('toolKey', queryParams.toolKey)
  return withCache(cacheKey('galleryWorks', queryParams), CACHE_TTL.list, async () => {
    const data = await request(`/gallery/works?${query.toString()}`)
    return {
      ...data,
      list: (data.list || []).map(toApiWork)
    }
  }, { force })
}

export async function fetchGalleryWork(id) {
  return toApiWork(await request(`/gallery/works/${id}`))
}

export async function fetchAppConfig() {
  return withCache(cacheKey('appConfig'), CACHE_TTL.appConfig, () => request('/app/config'))
}

export async function fetchTools(params = {}) {
  const { force = false, ...queryParams } = params
  const query = new URLSearchParams()
  if (queryParams.featured) query.set('featured', 'true')
  if (queryParams.category && queryParams.category !== 'all') query.set('category', queryParams.category)
  return withCache(cacheKey('tools', queryParams), CACHE_TTL.catalog, async () => {
    const list = await request(`/tools${query.toString() ? `?${query.toString()}` : ''}`)
    return (list || []).map((item) => ({
    id: item.toolKey || item.id,
    category: item.category,
    name: item.name,
    label: item.featured ? '推荐' : '工具',
    tone: 'cyan',
    featured: item.featured,
    icon: item.icon || 'wand',
    logoUrl: item.logoUrl || item.defaultModelLogoUrl || item.options?.modelLogos?.[item.defaultModelKey] || '',
    defaultModelKey: item.defaultModelKey || item.options?.defaultModelKey || '',
    defaultModelLogoUrl: item.defaultModelLogoUrl || item.logoUrl || '',
    modelLogos: item.modelLogos || item.options?.modelLogos || {},
    modelMeta: item.modelMeta || item.options?.modelMeta || {},
    desc: item.description || item.desc,
    cost: item.cost,
    fields: item.fields || [],
    modes: item.modes || [],
    outputTypes: [].concat(item.outputTypes || item.outputType || []),
    homeTabs: item.homeTabs || [],
    homeRecommended: Boolean(item.homeRecommended),
    homeSort: item.homeSort ?? item.sort ?? 0,
    searchKeywords: item.searchKeywords || item.keywords || [],
    options: item.options || {}
    }))
  }, { force })
}

function modelKeyAlias(value = '') {
  return String(value || '').trim().replace(/^newapi\./i, '').split('.').pop()
}

function toolKeyAliases(tool = {}) {
  const id = String(tool.id || '').trim()
  const defaultModelKey = String(tool.defaultModelKey || '').trim()
  const values = [
    id,
    defaultModelKey,
    modelKeyAlias(defaultModelKey)
  ]
  const categoryPrefix = `${tool.category || ''}-`
  if (categoryPrefix.length > 1 && id.startsWith(categoryPrefix)) {
    values.push(id.slice(categoryPrefix.length))
  }
  if (id.startsWith('t2v-') || id.startsWith('i2v-')) {
    values.push(id.slice(4))
  }
  return new Set(values.filter(Boolean))
}

function findToolByAlias(tools = [], key = '') {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) return null
  return tools.find((tool) => toolKeyAliases(tool).has(normalizedKey)) || null
}

export async function fetchToolCategories(options = {}) {
  return withCache(cacheKey('toolCategories'), CACHE_TTL.catalog, async () => {
    const list = await request('/tools/categories')
  return [{ key: 'all', label: '全部产品' }].concat((list || []).map((item) => ({
    key: item.key,
    label: item.name || item.label
    })))
  }, options)
}

export async function fetchTool(toolKey) {
  let item
  try {
    item = await request(`/tools/${toolKey}`)
  } catch (error) {
    if (![404, 'NOT_FOUND'].includes(error.statusCode) && error.code !== 'NOT_FOUND') throw error
    const tools = await fetchTools({ force: true })
    const matched = findToolByAlias(tools, toolKey)
    if (matched) return matched
    throw error
  }
  return {
    id: item.toolKey || item.id,
    category: item.category,
    name: item.name,
    label: item.featured ? '推荐' : '工具',
    tone: 'cyan',
    featured: item.featured,
    icon: item.icon || 'wand',
    logoUrl: item.logoUrl || item.defaultModelLogoUrl || item.options?.modelLogos?.[item.defaultModelKey] || '',
    defaultModelKey: item.defaultModelKey || item.options?.defaultModelKey || '',
    defaultModelLogoUrl: item.defaultModelLogoUrl || item.logoUrl || '',
    modelLogos: item.modelLogos || item.options?.modelLogos || {},
    modelMeta: item.modelMeta || item.options?.modelMeta || {},
    desc: item.description || item.desc,
    cost: item.cost,
    fields: item.fields || [],
    modes: item.modes || [],
    outputTypes: [].concat(item.outputTypes || item.outputType || []),
    homeTabs: item.homeTabs || [],
    homeRecommended: Boolean(item.homeRecommended),
    homeSort: item.homeSort ?? item.sort ?? 0,
    searchKeywords: item.searchKeywords || item.keywords || [],
    options: item.options || {}
  }
}

export async function fetchPromptCases(params = {}) {
  const { force = false, ...queryParams } = params
  const query = new URLSearchParams({
    page: String(queryParams.page || 1),
    pageSize: String(queryParams.pageSize || 20)
  })
  if (queryParams.keyword) query.set('keyword', queryParams.keyword)
  if (queryParams.category && queryParams.category !== 'all') query.set('category', queryParams.category)
  return withCache(cacheKey('promptCases', queryParams), CACHE_TTL.list, async () => {
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
  }, { force })
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

export async function copyPromptCase(id) {
  const data = await request(`/prompt-cases/${id}/copy`, { method: 'POST' })
  invalidateApiCache('promptCases')
  return data
}

export async function usePromptCase(id) {
  const data = await request(`/prompt-cases/${id}/use`, { method: 'POST' })
  invalidateApiCache('promptCases')
  return data
}

export async function createXAuthorizeUrl(params) {
  const query = new URLSearchParams({
    codeChallenge: params.codeChallenge
  })
  if (params.redirectUri) query.set('redirectUri', params.redirectUri)
  return request(`/auth/h5/x/authorize-url?${query.toString()}`, { noAuth: true })
}

export async function fetchWorks(params = {}) {
  const { force = false, ...queryParams } = params
  const query = new URLSearchParams({
    page: String(queryParams.page || 1),
    pageSize: String(queryParams.pageSize || 20)
  })
  if (queryParams.status) query.set('status', queryParams.status)
  return withCache(cacheKey('works', queryParams, true), CACHE_TTL.list, async () => {
    const data = await request(`/works?${query.toString()}`)
    return {
      ...data,
      list: (data.list || []).map(toApiWork)
    }
  }, { force })
}

export async function fetchWork(id) {
  return toApiWork(await request(`/works/${id}`))
}

export async function createGenerationTask(payload) {
  const data = await request('/generation-tasks', {
    method: 'POST',
    data: payload
  })
  invalidateMany(['works', 'galleryWorks', 'creditBalance'])
  return data
}

export async function fetchGenerationTask(id) {
  return request(`/generation-tasks/${id}`)
}

export async function cancelGenerationTask(id) {
  const data = await request(`/generation-tasks/${id}/cancel`, { method: 'POST' })
  invalidateMany(['works', 'creditBalance'])
  return data
}

export async function retryGenerationTask(id) {
  const data = await request(`/generation-tasks/${id}/retry`, { method: 'POST' })
  invalidateMany(['works', 'creditBalance'])
  return data
}

export async function deleteWorkRemote(id) {
  const data = await request(`/works/${id}`, { method: 'DELETE' })
  invalidateMany(['works', 'galleryWorks'])
  return data
}

export async function clearFailedWorksRemote() {
  const data = await request('/works/clear-failed', { method: 'POST' })
  invalidateApiCache('works')
  return data
}

export async function createWorkShareTicket(id) {
  return request(`/works/${id}/share-ticket`, { method: 'POST' })
}

export async function fetchSharedWork(ticket) {
  return toApiWork(await request(`/works/share/${encodeURIComponent(ticket)}`, { noAuth: true }))
}

export async function fetchWorkflowPurchases(params = {}) {
  const { force = false, ...queryParams } = params
  const query = new URLSearchParams({
    page: String(queryParams.page || 1),
    pageSize: String(queryParams.pageSize || 20)
  })
  return withCache(cacheKey('workflowPurchases', queryParams, true), CACHE_TTL.list, () => (
    request(`/workflow-purchases?${query.toString()}`)
  ), { force })
}

export async function fetchWorkflowCases(params = {}) {
  const { force = false, ...queryParams } = params
  const query = new URLSearchParams({
    page: String(queryParams.page || 1),
    pageSize: String(queryParams.pageSize || 20)
  })
  if (queryParams.keyword) query.set('keyword', queryParams.keyword)
  if (queryParams.licenseMode) query.set('licenseMode', queryParams.licenseMode)
  return withCache(cacheKey('workflowCases', queryParams), CACHE_TTL.list, () => (
    request(`/workflow-cases?${query.toString()}`)
  ), { force })
}

export async function fetchWorkflowCase(id) {
  return request(`/workflow-cases/${id}`)
}

export async function fetchWorkflowCasePurchaseStatus(id) {
  return request(`/workflow-cases/${id}/purchase-status`)
}

export async function purchaseWorkflowCase(id) {
  const data = await request(`/workflow-cases/${id}/purchase`, { method: 'POST' })
  invalidateMany(['workflowPurchases', 'workflowCases', 'creditBalance'])
  return data
}

export async function fetchWorkflowComponents(params = {}) {
  const { force = false, ...queryParams } = params
  const clientRuntime = queryParams.clientRuntime || getClientRuntime()
  const query = new URLSearchParams({
    page: String(queryParams.page || 1),
    pageSize: String(queryParams.pageSize || 50)
  })
  if (queryParams.category) query.set('category', queryParams.category)
  if (queryParams.modelKey) query.set('modelKey', queryParams.modelKey)
  if (queryParams.allowedInLinear !== undefined) query.set('allowedInLinear', String(queryParams.allowedInLinear))
  query.set('clientRuntime', clientRuntime)
  return withCache(cacheKey('workflowComponents', { ...queryParams, clientRuntime }), CACHE_TTL.catalog, () => (
    request(`/components?${query.toString()}`)
  ), { force })
}

export async function createWorkflowDraft(payload) {
  const data = await request('/workflows', {
    method: 'POST',
    data: payload
  })
  invalidateMany(['workflowComponents', 'workflowCases'])
  return data
}

export async function updateWorkflowDraft(id, payload) {
  const data = await request(`/workflows/${id}/draft`, {
    method: 'PUT',
    data: payload
  })
  invalidateMany(['workflowComponents', 'workflowCases'])
  return data
}

export async function validateWorkflowDraft(id, graph) {
  return request(`/workflows/${id}/validate`, {
    method: 'POST',
    data: { graph }
  })
}

export async function estimateWorkflowDraft(id, graph) {
  return request(`/workflows/${id}/estimate`, {
    method: 'POST',
    data: { graph }
  })
}

export async function runWorkflowDraft(id, payload = {}) {
  const data = await request(`/workflows/${id}/run`, {
    method: 'POST',
    data: payload
  })
  invalidateMany(['works', 'creditBalance'])
  return data
}

export async function publishWorkflowDraftCase(id, payload = {}) {
  const data = await request(`/workflows/${id}/publish-case`, {
    method: 'POST',
    data: payload
  })
  invalidateApiCache('workflowCases')
  return data
}

export async function runWorkflowCase(caseContentId, payload = {}) {
  const data = await request(`/workflow-cases/${caseContentId}/run`, {
    method: 'POST',
    data: payload
  })
  invalidateMany(['works', 'creditBalance'])
  return data
}

export async function trialRunWorkflowCase(caseContentId, payload = {}) {
  const data = await request(`/workflow-cases/${caseContentId}/trial-run`, {
    method: 'POST',
    data: payload
  })
  invalidateApiCache('works')
  return data
}

export async function fetchWorkflowRuns(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 20)
  })
  if (params.status) query.set('status', params.status)
  if (params.caseContentId) query.set('caseContentId', params.caseContentId)
  if (params.workflowVersionId) query.set('workflowVersionId', params.workflowVersionId)
  if (params.isTrial !== undefined) query.set('isTrial', String(params.isTrial))
  return request(`/workflow-runs?${query.toString()}`)
}

export async function fetchWorkflowRun(id) {
  return request(`/workflow-runs/${id}`)
}

export async function fetchWorkflowRunNodes(id) {
  return request(`/workflow-runs/${id}/nodes`)
}

const AUTH_ENDPOINTS = {
  'telegram-tma': '/auth/tma-login',
  'wechat-miniapp': '/auth/wechat-miniapp-login',
  'alipay-miniapp': '/auth/alipay-miniapp-login',
  'douyin-miniapp': '/auth/douyin-miniapp-login',
  'qq-miniapp': '/auth/qq-miniapp-login',
  'h5-google': '/auth/h5/google-login',
  'h5-x': '/auth/h5/x-login',
  dev: '/auth/dev-account-login'
}

export async function loginDev(account = 'demo@seefactory.ai') {
  const data = await request('/auth/dev-account-login', {
    method: 'POST',
    data: withInvitePayload({ account, nickname: 'seeFactory 创作者' })
  })
  saveAuth(data)
  invalidateApiCache()
  return data
}

function readTelegramLoginPayload() {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
  const initData = webApp?.initData
  if (!initData) {
    throw new Error('请在 Telegram 内打开 seeFactory 后登录')
  }
  const user = webApp?.initDataUnsafe?.user || {}
  return {
    initData,
    nickname: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
    avatarUrl: user.photo_url
  }
}

async function readMiniappLoginPayload(runtime) {
  if (runtime === 'alipay-miniapp') {
    const authCode = await new Promise((resolve, reject) => {
      const alipay = typeof my !== 'undefined' ? my : null
      if (!alipay?.getAuthCode) {
        reject(new Error('请在支付宝小程序内登录'))
        return
      }
      alipay.getAuthCode({
        scopes: 'auth_base',
        success: (result) => {
          const code = result?.authCode || result?.code
          if (code) {
            resolve(code)
            return
          }
          reject(new Error('未能获取支付宝授权码，请重试'))
        },
        fail: (error) => {
          reject(new Error(error?.errorMessage || error?.message || '支付宝授权失败，请重试'))
        }
      })
    })
    return { code: authCode, authCode }
  }
  const result = await Taro.login()
  const loginCode = result?.code || result?.authCode
  if (!loginCode) {
    throw new Error('未能获取登录凭证，请重试')
  }
  const payload = { code: loginCode }
  return payload
}

async function buildRuntimeLoginPayload(runtime, options = {}) {
  if (runtime === 'telegram-tma') return readTelegramLoginPayload()
  if (['wechat-miniapp', 'alipay-miniapp', 'douyin-miniapp', 'qq-miniapp'].includes(runtime)) {
    return readMiniappLoginPayload(runtime)
  }
  if (runtime === 'h5-google') {
    const idToken = options.idToken || (typeof window !== 'undefined' ? window.__SEEFACTORY_GOOGLE_ID_TOKEN__ : '')
    if (!idToken) throw new Error('请先完成 Google 授权')
    return { idToken }
  }
  if (runtime === 'h5-x') {
    const { code, codeVerifier, redirectUri, state } = options
    if (!code || !codeVerifier || !state) throw new Error('请先完成 X 账号授权')
    return { code, codeVerifier, redirectUri, state }
  }
  return {}
}

export async function loginRuntime(providerUserIdOrOptions = {}, options = {}) {
  const normalizedOptions = typeof providerUserIdOrOptions === 'object'
    ? providerUserIdOrOptions
    : { ...options, devProviderUserId: providerUserIdOrOptions }
  const runtime = normalizedOptions.clientRuntime || getClientRuntime()
  const endpoint = AUTH_ENDPOINTS[runtime] || AUTH_ENDPOINTS['h5-google']
  const platformPayload = await buildRuntimeLoginPayload(runtime, normalizedOptions)
  const data = await request(endpoint, {
    method: 'POST',
    data: withInvitePayload({
      ...platformPayload,
      ...(normalizedOptions.allowDevProviderUserId ? { providerUserId: normalizedOptions.devProviderUserId } : {}),
      nickname: normalizedOptions.nickname || platformPayload.nickname || 'seeFactory 创作者',
      avatarUrl: normalizedOptions.avatarUrl || platformPayload.avatarUrl,
      appId: normalizedOptions.appId,
      source: normalizedOptions.source,
      channel: normalizedOptions.channel
    })
  })
  saveAuth(data)
  invalidateApiCache()
  return data
}

export async function logoutRemote() {
  const refreshToken = getRefreshToken()
  try {
    await request('/auth/logout', {
      method: 'POST',
      data: { refreshToken },
      skipRefresh: true
    })
  } finally {
    logout()
    invalidateApiCache()
  }
}

export async function fetchMe() {
  return request('/auth/me')
}

export async function fetchCreditBalance(options = {}) {
  return withCache(cacheKey('creditBalance', {}, true), CACHE_TTL.account, () => (
    request('/credits/balance')
  ), options)
}

export async function fetchCreditTransactions(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 20)
  })
  return request(`/credits/transactions?${query.toString()}`)
}

export async function fetchWalletAccount(options = {}) {
  return withCache(cacheKey('walletAccount', {}, true), CACHE_TTL.account, () => (
    request('/wallet/account')
  ), options)
}

export async function fetchWalletRechargeOptions() {
  return withCache(cacheKey('walletRechargeOptions'), CACHE_TTL.catalog, () => (
    request('/wallet/recharge-options')
  ))
}

export async function createWalletCryptoOrder(payload) {
  const data = await request('/wallet/recharge/crypto/order', {
    method: 'POST',
    data: payload
  })
  invalidateMany(['creditBalance', 'walletAccount'])
  return data
}

export async function fetchWalletCryptoOrder(id) {
  return request(`/wallet/recharge/crypto/orders/${id}`)
}

export async function fetchWithdrawalAddress() {
  return request('/wallet/withdrawal-address')
}

export async function fetchWalletWithdrawals(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 10)
  })
  return request(`/wallet/withdrawals?${query.toString()}`)
}

export async function fetchRechargeSettings(options = {}) {
  return withCache(cacheKey('rechargeSettings'), CACHE_TTL.catalog, () => (
    request('/credits/recharge-settings')
  ), options)
}

export async function fetchPaymentProviders(clientRuntime = getClientRuntime()) {
  const query = new URLSearchParams({ clientRuntime })
  return withCache(cacheKey('paymentProviders', { clientRuntime }), CACHE_TTL.payment, () => (
    request(`/payments/providers?${query.toString()}`)
  ))
}

export async function createRechargeOrder(payload) {
  const data = await request('/credits/recharge-orders', {
    method: 'POST',
    data: payload
  })
  invalidateMany(['creditBalance', 'walletAccount'])
  return data
}

export async function createGenerationPaymentOrder(payload) {
  const data = await request('/credits/generation-payment-orders', {
    method: 'POST',
    data: payload
  })
  invalidateMany(['works', 'creditBalance'])
  return data
}

export async function fetchPaymentOrder(orderId) {
  return request(`/payments/orders/${orderId}`)
}

export async function createCryptoOrder(payload) {
  const data = await request('/payments/crypto-orders', {
    method: 'POST',
    data: payload
  })
  invalidateMany(['creditBalance', 'walletAccount'])
  return data
}

export async function createPlatformPaymentOrder(payload) {
  const data = await request('/payments/platform-orders', {
    method: 'POST',
    data: payload
  })
  invalidateMany(['creditBalance', 'walletAccount'])
  return data
}

export async function fetchCryptoOrder(id) {
  return request(`/payments/crypto-orders/${id}`)
}

export async function createTelegramStarsOrder(payload) {
  const data = await request('/payments/telegram-stars-orders', {
    method: 'POST',
    data: payload
  })
  invalidateMany(['creditBalance', 'walletAccount'])
  return data
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
  const data = await request('/assets', {
    method: 'POST',
    data: payload
  })
  invalidateApiCache('works')
  return data
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

export async function fetchAgentCommissions(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 10)
  })
  return request(`/agent/commissions?${query.toString()}`)
}

export async function publishGalleryWork(id) {
  const data = await request(`/works/${id}/publish-gallery`, { method: 'POST' })
  invalidateMany(['works', 'galleryWorks'])
  return data
}

export async function unpublishGalleryWork(id) {
  const data = await request(`/works/${id}/unpublish-gallery`, { method: 'POST' })
  invalidateMany(['works', 'galleryWorks'])
  return data
}

export async function getDownloadUrl(id, shareTicket = '') {
  const query = shareTicket ? `?shareTicket=${encodeURIComponent(shareTicket)}` : ''
  return request(`/works/${id}/download-url${query}`)
}
