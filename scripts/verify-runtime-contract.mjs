import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");

function source(relativePath) {
  return readFileSync(resolve(appRoot, relativePath), "utf8");
}

function mustInclude(text, pattern, message) {
  assert.ok(text.includes(pattern), message);
}

function mustNotExist(relativePath, message) {
  assert.equal(existsSync(resolve(appRoot, relativePath)), false, message);
}

function assertIncludesAll(text, label, patterns) {
  for (const pattern of patterns) {
    mustInclude(text, pattern, `${label} must include ${pattern}.`);
  }
}

mustNotExist("src/data/mock.js", "User app must not use local mock data after backend integration.");

const api = source("src/services/api.js");
assertIncludesAll(api, "services/api.js backend contract", [
  "SEEFACTORY_API_BASE",
  "DEFAULT_API_BASE",
  "SEEFACTORY_CLIENT_VERSION",
  "CLIENT_VERSION",
  "X-Client-Runtime",
  "X-Client-Version",
  "authorization: `Bearer ${token()}`",
  "refreshAuth",
  "saveAuth(body.data)",
  "redirectLogin",
  "getClientRuntime",
  "telegram-tma",
  "wechat-miniapp",
  "alipay-miniapp",
  "douyin-miniapp",
  "qq-miniapp",
  "h5-google",
  "AUTH_ENDPOINTS",
  "/auth/tma-login",
  "/auth/wechat-miniapp-login",
  "/auth/alipay-miniapp-login",
  "/auth/douyin-miniapp-login",
  "/auth/qq-miniapp-login",
  "/auth/h5/google-login",
  "/auth/h5/x-login",
  "/auth/dev-account-login",
  "readTelegramLoginPayload",
  "initData",
  "initDataUnsafe",
  "Taro.login()",
  "authCode",
  "idToken",
  "codeVerifier",
  "createXAuthorizeUrl",
  "fetchGalleryWorks",
  "request(`/gallery/works?",
  "fetchGalleryWork",
  "request(`/gallery/works/${id}`",
  "fetchSharedWork",
  "request(`/works/share/",
  "fetchWorkflowComponents",
  "request(`/components?",
  "fetchWorkflowCases",
  "request(`/workflow-cases?",
  "fetchWorkflowCasePurchaseStatus",
  "request(`/workflow-cases/${id}/purchase-status`",
  "purchaseWorkflowCase",
  "request(`/workflow-cases/${id}/purchase`, { method: 'POST' })",
  "trialRunWorkflowCase",
  "request(`/workflow-cases/${caseContentId}/trial-run`",
  "createWorkflowDraft",
  "request('/workflows'",
  "validateWorkflowDraft",
  "estimateWorkflowDraft",
  "runWorkflowDraft",
  "request(`/workflows/${id}/run`",
  "publishWorkflowDraftCase",
  "request(`/workflows/${id}/publish-case`",
  "getDownloadUrl",
  "request(`/works/${id}/download-url",
  "fetchPaymentProviders",
  "createRechargeOrder",
  "createGenerationPaymentOrder",
  "createCryptoOrder",
  "createPlatformPaymentOrder",
  "createTelegramStarsOrder",
  "fetchPaymentOrder",
  "fetchCryptoOrder",
  "fetchTelegramStarsOrder"
]);
assertIncludesAll(api, "services/api.js explicit home recommendation contract", [
  "homeRecommended: Boolean(item.homeRecommended)"
]);
assert.ok(!api.includes("homeRecommended: item.homeRecommended ?? item.featured"), "Tool API mapper must not infer home recommendation from legacy featured.");

const appConfig = source("src/hooks/useAppConfig.js");
assertIncludesAll(appConfig, "useAppConfig app configuration contract", [
  "DEFAULT_APP_CONFIG",
  "generationEnabled: true",
  "rechargeEnabled: true",
  "galleryEnabled: true",
  "agentEnabled: true",
  "videoMuted: true",
  "videoLoop: true",
  "mainCardOpacity: 0.46",
  "operatorName: 'seeFactory 平台运营方'",
  "contactEmail: 'support@seefactory.ai'",
  "contactAddress: '中国北京市海淀区 seeFactory 运营中心'",
  "jurisdiction: '中华人民共和国法律'",
  "legal: { ...DEFAULT_APP_CONFIG.legal, ...(config?.legal || {}) }",
  "fetchAppConfig",
  "loadAppConfig",
  "isFeatureEnabled",
  "useAppConfig"
]);

const storage = source("src/utils/storage.js");
assertIncludesAll(storage, "utils/storage.js storage contract", [
  "Taro.getStorageSync",
  "Taro.setStorageSync",
  "Taro.removeStorageSync",
  "seeFactoryToken",
  "seeFactoryRefreshToken",
  "saveAuth",
  "getAuthToken",
  "getRefreshToken",
  "requireLogin"
]);

const platformLogin = source("src/platform/login.js");
assertIncludesAll(platformLogin, "platform/login.js Telegram runtime split contract", [
  "isTelegramRuntimeTarget",
  "runtimeTarget === 'tma' || runtimeTarget === 'telegram-tma'",
  "if (isTelegramRuntimeTarget(runtimeTarget)) return 'telegram-tma'",
  "shouldLoadTelegramSdk",
  "BRANCH_CLIENT_RUNTIME === 'telegram-tma' || isTelegramRuntimeTarget(runtimeTarget)",
  "telegramSdkUrl",
]);
assert.ok(!platformLogin.includes("TELEGRAM_SDK_URL"), "platform/login.js must not export a static Telegram SDK URL into App H5 bundles.");
assert.ok(!platformLogin.includes("https://telegram.org/js/telegram-web-app.js"), "platform/login.js must not contain the full Telegram Mini App SDK URL literal.");
if (platformLogin.includes("BRANCH_CLIENT_RUNTIME = 'telegram-tma'")) {
  assertIncludesAll(platformLogin, "platform/login.js TMA SDK URL contract", [
    "if (!shouldLoadTelegramSdk(runtimeTarget)) return ''",
    "['https://telegram.org', '/js/', 'telegram-web', '-app.js?62'].join('')"
  ]);
} else {
  assertIncludesAll(platformLogin, "platform/login.js non-TMA SDK URL contract", [
    "export function telegramSdkUrl(runtimeTarget = 'h5')",
    "return ''"
  ]);
  assert.ok(!platformLogin.includes("telegram-web"), "non-TMA login module must not contain Telegram SDK URL fragments.");
  assert.ok(!platformLogin.includes("-app.js?62"), "non-TMA login module must not contain Telegram SDK URL fragments.");
}

const appEntry = source("src/app.jsx");
assertIncludesAll(appEntry, "app.jsx Telegram SDK lazy runtime contract", [
  "telegramSdkUrl",
  "const sdkUrl = telegramSdkUrl(RUNTIME_TARGET)",
  "if (!sdkUrl) return Promise.resolve(false)",
  "document.querySelector(`script[src=\"${sdkUrl}\"]`)",
  "script.src = sdkUrl"
]);
assert.ok(!appEntry.includes("TELEGRAM_SDK_URL"), "app.jsx must not import or use a static Telegram SDK URL.");

const agreement = source("src/utils/agreement.js");
assertIncludesAll(agreement, "utils/agreement.js legal agreement display contract", [
  "normalizeLegalInfo",
  "formatAgreementLegalBlock",
  "formatAgreementContent",
  "平台主体信息",
  "运营主体：",
  "联系邮箱：",
  "联系地址：",
  "适用法域：",
  "operatorName: 'seeFactory 平台运营方'",
  "contactEmail: 'support@seefactory.ai'",
  "contactAddress: '中国北京市海淀区 seeFactory 运营中心'",
  "jurisdiction: '中华人民共和国法律'"
]);

const shell = source("src/components/Shell.jsx");
assertIncludesAll(shell, "Shell.jsx fixed home video contract", [
  "useAppConfig",
  "const homeConfig = config?.home || {}",
  "homeConfig.videoUrl || fallbackHomeVideo",
  "homeConfig.videoFixed !== false",
  "homeConfig.videoMuted !== false",
  "homeConfig.videoLoop !== false",
  "normalizeOpacity(homeConfig.overlayOpacity, 0.58)",
  "normalizeOpacity(homeConfig.mainCardOpacity, 0.46)",
  "--sf-home-overlay-opacity",
  "--sf-home-card-opacity",
  "featureForTab",
  "visibleTabs",
  "isFeatureEnabled(config, feature)",
  "return 'generation'",
  "return 'gallery'",
  "home-video-layer",
  "home-video-overlay",
  "home-bg-video",
  "id='home-background-video'",
  "Video",
  "autoplay",
  "loop={videoLoop}",
  "muted={videoMuted}",
  "playsInline",
  "Taro.createVideoContext('home-background-video')"
]);

for (const [relativePath, label, patterns] of [
  ["src/pages/index/index.jsx", "home page generation feature gate", ["useAppConfig", "configLoading", "isFeatureEnabled(config, 'generation')", "generationEnabled", "创作功能已由后台关闭"]],
  ["src/pages/create-center/index.jsx", "create center generation feature gate", ["useAppConfig", "configLoading", "isFeatureEnabled(config, 'generation')", "generationEnabled", "创作中心已关闭"]],
  ["src/pages/tool/index.jsx", "tool page generation feature gate", ["useAppConfig", "configLoading", "isFeatureEnabled(config, 'generation')", "generationEnabled", "生成服务已关闭"]],
  ["src/pages/gallery/index.jsx", "gallery feature gate", ["useAppConfig", "configLoading", "isFeatureEnabled(config, 'gallery')", "galleryEnabled", "作品广场已关闭"]],
  ["src/pages/mine/index.jsx", "mine page recharge and agent feature gates", ["useAppConfig", "configLoading", "isFeatureEnabled(config, 'recharge')", "isFeatureEnabled(config, 'agent')", "rechargeDisabled", "agentFeatureEnabled"]],
  ["src/pages/wallet/index.jsx", "wallet recharge feature gate", ["useAppConfig", "configLoading", "isFeatureEnabled(config, 'recharge')", "rechargeFeatureEnabled", "充值功能已由后台关闭"]],
  ["src/pages/agent/index.jsx", "agent page feature gate", ["useAppConfig", "configLoading", "isFeatureEnabled(config, 'agent')", "agentEnabled", "代理中心已关闭"]]
]) {
  assertIncludesAll(source(relativePath), label, patterns);
}

const css = source("src/app.css");
assertIncludesAll(css, "app.css mobile visual contract", [
  ".app-shell",
  "min-height: 844px",
  ".home-video-layer",
  "position: fixed",
  ".home-video-overlay",
  ".home-bg-video",
  "object-fit: cover",
  "--sf-home-overlay-opacity",
  "--sf-home-card-opacity",
  "var(--sf-home-card-opacity, 0.46)",
  "env(safe-area-inset-bottom)",
  "@media (max-width: 389px)"
]);

const login = source("src/pages/login/index.jsx");
assertIncludesAll(login, "login page multi-runtime contract", [
  "REQUIRED_AGREEMENTS",
  "fetchAgreement",
  "useAppConfig",
  "formatAgreementContent",
  "content: formatAgreementContent(agreement, config?.legal)",
  "window.Telegram?.WebApp?.ready?.()",
  "window.Telegram?.WebApp?.expand?.()",
  "loadScript('https://accounts.google.com/gsi/client?hl=zh-CN')",
  "window.google.accounts.id.initialize",
  "createXAuthorizeUrl",
  "codeVerifier",
  "codeChallenge",
  "state",
  "loginRuntime({",
  "clientRuntime: 'h5-x'",
  "loginConfig.devLoginEnabled"
]);

for (const [relativePath, label, patterns] of [
  ["src/pages/mine/index.jsx", "mine page agreement legal display", ["formatAgreementContent", "content: formatAgreementContent(agreement, config?.legal)", "fetchAgreement"]],
  ["src/pages/agent/index.jsx", "agent page agreement legal display", ["formatAgreementContent", "content: formatAgreementContent(agreement, config?.legal, '代理推广协议正文待后台发布，请确认后继续访问代理中心。')", "fetchAgreement('agent')"]]
]) {
  assertIncludesAll(source(relativePath), label, patterns);
}

const gallery = source("src/pages/gallery/index.jsx");
assertIncludesAll(gallery, "gallery page public work contract", [
  "fetchGalleryWorks",
  "fetchToolCategories",
  "gallery-featured-card",
  "gallery-grid",
  "source=gallery",
  "PageLoading",
  "ErrorState",
  "EmptyState",
  "InlineNotice"
]);

const worksPage = source("src/pages/works/index.jsx");
assertIncludesAll(worksPage, "works page workflow trial lock contract", [
  "function workBadgeText(item)",
  "item?.lockedUntilPurchase",
  "item?.isIntermediateOutput",
  "function workBadgeIcon(item)",
  "function workBadgeClass(item)",
  "AppIcon name={workBadgeIcon(item)}",
  "workBadgeText(item)"
]);

const detail = source("src/pages/work-detail/index.jsx");
assertIncludesAll(detail, "work detail public/download contract", [
  "source === 'gallery' || !isLoggedIn()",
  "fetchGalleryWork(id)",
  "fetchSharedWork(ticket)",
  "fetchWork(id)",
  "catch(() => fetchGalleryWork(id)",
  "downloadEnabled === false",
  "getDownloadUrl",
  "Taro.downloadFile",
  "Taro.saveVideoToPhotosAlbum",
  "Taro.saveImageToPhotosAlbum",
  "createWorkShareTicket",
  "publishGalleryWork",
  "unpublishGalleryWork",
  "detailMode === 'gallery'",
  "detailMode === 'share'",
  "sourceCaseContentId",
  "goPurchaseWorkflow",
  "/pages/workflow-cases/index?id=",
  "locked-work-panel",
  "购买解锁"
]);

const toolPage = source("src/pages/tool/index.jsx");
assertIncludesAll(toolPage, "tool page resolution/model option contract", [
  "const defaultResolutions",
  "function normalizeResolution",
  "function resolutionOptionsForRatio",
  "nextResolution(tool, ratio, current)",
  "const [resolution, setResolution]",
  "const resolutionOptions = resolutionOptionsForRatio(activeTool, ratio, defaultResolutions)",
  "const effectiveResolution = selectedResolution || firstValue(resolutionOptions) || normalizedResolution",
  "function ratioFrameClass",
  "function isVideoTool",
  "ratio-option-chip",
  "ratioFrameClass(item)",
  "needs('resolution')",
  "fieldError(formErrors, 'resolution')",
  "modelKey: model,",
  "prompt,",
  "...(usesAssetSlots ? { inputAssets } : { inputAssetIds: assetIds })",
  "params: { style, ratio, resolution: effectiveResolution, size: effectiveResolution, duration, model, count: 1 }"
]);

const workflowLinearPage = source("src/pages/workflow-linear/index.jsx");
assertIncludesAll(workflowLinearPage, "linear workflow miniapp builder contract", [
  "fetchWorkflowComponents({ pageSize: 80, allowedInLinear: true })",
  "fetchTools()",
  "buildLinearGraph",
  "buildLinearRunForm",
  "schemaVersion: 'seeFactory.workflow.v1'",
  "schemaVersion: 'seeFactory.runForm.v1'",
  "promptTemplate: '{{prompt}}'",
  "editorMode: 'linear'",
  "validateWorkflowDraft",
  "estimateWorkflowDraft",
  "runWorkflowDraft",
  "publishWorkflowDraftCase",
  "`/pages/workflow-cases/index?id=${encodeURIComponent(caseId)}`",
  "publishAgreementAccepted: true",
  "licenseMode: publishMode",
  "pricePoints: publishMode === 'closed_paid' ? normalizedPrice : 0",
  "trialEnabled: publishMode === 'closed_paid' && trialEnabled",
  "trialLimitPerUser: publishMode === 'closed_paid' && trialEnabled ? normalizedTrialLimit : 0",
  "input: runInput, params: runInput",
  "小程序端只支持顺序拼接组件",
  "不开放自由连线、条件分支、循环或 .seeflow 导入导出",
  "小程序线性链最多 8 步",
  "保存并运行",
  "保存并发布"
]);
assert.ok(!workflowLinearPage.includes("/workflows/import"), "Miniapp linear workflow builder must not import .seeflow files.");
const workflowPurchasesPage = source("src/pages/workflow-purchases/index.jsx");
const workflowRunFormComponent = source("src/components/WorkflowRunFormFields.jsx");
assertIncludesAll(workflowRunFormComponent, "miniapp shared workflow run form contract", [
  "function workflowRunFields(runForm)",
  "function buildWorkflowRunPayload(runForm, values = {})",
  "Input, Picker, Switch, Textarea",
  "isUnsupportedRunField(field)",
  "PC Dashboard"
]);
const workflowCasesPage = source("src/pages/workflow-cases/index.jsx");
assertIncludesAll(workflowCasesPage, "workflow case marketplace run contract", [
  "getCurrentInstance",
  "routeCaseId",
  "useState(routeCaseId)",
  "const requestedId = selectedId || routeCaseId",
  "fetchWorkflowCases({ pageSize: 30 })",
  "fetchWorkflowCase(selectedId)",
  "fetchWorkflowCasePurchaseStatus(selectedId)",
  "purchaseWorkflowCase(selected.id)",
  "trialRunWorkflowCase(selected.id, payloadResult.payload)",
  "runWorkflowCase(selected.id, payloadResult.payload)",
  "buildWorkflowRunPayload(runFormOf(selected), values)",
  "function workflowLifecycleNote",
  "deletedByAuthorAt",
  "listingStatus",
  "作者已停止公开展示该案例",
  "作者已隐藏公开展示",
  "购买记录仍保留",
  "<WorkflowRunFormFields",
  "requireLogin('/pages/workflow-cases/index')",
  "/pages/workflow-runs/detail/index?id=",
  "goPage('/pages/workflow-purchases/index')",
  "Workflow 案例"
]);
assert.ok(!workflowCasesPage.includes("runWorkflowCase(selected.id, { input: {}, params: {} })"), "Workflow cases must not run with an empty hard-coded payload.");
assertIncludesAll(workflowPurchasesPage, "purchased workflow run form contract", [
  "function runFormOf(item)",
  "function workflowLifecycleNote(item)",
  "function workflowLifecycleLabel(item)",
  "function templateCreatorName(item)",
  "function templateVersionLabel(item)",
  "function templateLastRunText(item)",
  "function workflowRunStatusText",
  "deletedByAuthorAt",
  "listingStatus",
  "lastRunAt",
  "lastRunStatus",
  "purchasedVersion",
  "作者已停止公开展示该案例",
  "作者已隐藏公开展示",
  "购买记录仍保留",
  "存在可替代模型",
  "暂无运行",
  "initialWorkflowRunValues(runFormOf(item))",
  "buildWorkflowRunPayload(runFormOf(item), runValuesById[item.id]",
  "<WorkflowRunFormFields",
  "runWorkflowCase(caseId, payloadResult.payload)"
]);
assert.ok(!workflowPurchasesPage.includes("runWorkflowCase(caseId, { input: {}, params: {} })"), "Purchased workflow templates must not run with an empty hard-coded payload.");
assertIncludesAll(source("src/app.config.js"), "workflow miniapp pages", [
  "'pages/workflow-cases/index'",
  "'pages/workflow-purchases/index'",
  "'pages/workflow-linear/index'",
  "'pages/workflow-runs/detail/index'"
]);
assertIncludesAll(source("src/pages/create-center/index.jsx"), "create center linear workflow entry", [
  "goWorkflowCases",
  "/pages/workflow-cases/index",
  "Workflow 案例",
  "goWorkflowLinear",
  "/pages/workflow-linear/index",
  "线性拼积木"
]);
assertIncludesAll(source("src/pages/mine/index.jsx"), "mine linear workflow entry", [
  "goWorkflowCases",
  "/pages/workflow-cases/index",
  "购买和运行模板",
  "goWorkflowLinear",
  "/pages/workflow-linear/index",
  "创建 Workflow"
]);

const homePage = source("src/pages/index/index.jsx");
assertIncludesAll(homePage, "home tool grouping contract", [
  "tool.homeRecommended || configured.includes('recommended')",
  "if (!keyword) return groupedTools.recommended",
  "homeTabs",
  "outputTypesOf(tool)",
  "searchOpen"
]);
assert.ok(!homePage.includes("tool.homeRecommended || tool.featured"), "Home recommended tab must not infer recommendation from legacy featured.");
assert.ok(!homePage.includes("sorted.slice(0, 6)"), "Empty search recommendations must not fall back to all tools.");

const paymentSheet = source("src/components/PaymentSheet.jsx");
assertIncludesAll(paymentSheet, "PaymentSheet payment skill frontend contract", [
  "invokeTelegramStarsPayment",
  "window.Telegram?.WebApp",
  "openInvoice",
  "invokePlatformPayment",
  "Taro.requestPayment",
  "alipay-trade-pay",
  "douyin-pay",
  "CryptoRoutePicker",
  "cryptoOptions.acquiringConfigured",
  "primaryBusy"
]);

const packageSource = source("package.json");
assertIncludesAll(packageSource, "package.json verification contract", [
  "\"verify:runtime-contract\"",
  "\"verify:env-example\"",
  "\"verify:branch-diff\"",
  "pnpm verify:runtime-contract && pnpm verify:env-example && pnpm verify:feedback-system && pnpm verify:branch-diff && pnpm build:all"
]);

const envExample = source(".env.example");
assertIncludesAll(envExample, ".env.example runtime configuration", [
  "SEEFACTORY_API_BASE=",
  "SEEFACTORY_CLIENT_VERSION=",
  "SEEFACTORY_GOOGLE_CLIENT_ID=",
  "SEEFACTORY_X_REDIRECT_URI=",
  "SEEFACTORY_DEV_LOGIN_ENABLED=false"
]);

console.log(JSON.stringify({
  checked: [
    "no local mock data",
    "API base, auth refresh, runtime/version headers",
    "AppConfig feature switches gate generation, gallery, recharge, and agent flows",
    "TMA, WeChat, Alipay, Douyin, QQ, Google, X login endpoints",
    "Taro storage based auth state",
    "agreement modal legal operator block",
    "fixed full-screen home background video",
    "iPhone 14 height baseline and safe-area styles",
    "public gallery and share detail access",
    "download/save flow with backend signed download URL",
    "home tool tabs use explicit Admin recommendation only",
    "miniapp linear workflow builder uses backend components, tools, validation, run and publish APIs",
    "payment sheet invokes only backend-created platform, crypto, and Telegram Stars orders",
    "runtime environment example keys",
    "verification script is wired into app verify"
  ]
}, null, 2));
