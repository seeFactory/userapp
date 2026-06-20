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

const shell = source("src/components/Shell.jsx");
assertIncludesAll(shell, "Shell.jsx fixed home video contract", [
  "fetchAppConfig",
  "config?.home?.videoUrl",
  "home-video-layer",
  "home-bg-video",
  "id='home-background-video'",
  "Video",
  "autoplay",
  "loop",
  "muted",
  "playsInline",
  "Taro.createVideoContext('home-background-video')"
]);

const css = source("src/app.css");
assertIncludesAll(css, "app.css mobile visual contract", [
  ".app-shell",
  "min-height: 844px",
  ".home-video-layer",
  "position: fixed",
  ".home-bg-video",
  "object-fit: cover",
  "env(safe-area-inset-bottom)",
  "@media (max-width: 389px)"
]);

const login = source("src/pages/login/index.jsx");
assertIncludesAll(login, "login page multi-runtime contract", [
  "REQUIRED_AGREEMENTS",
  "fetchAgreement",
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
  "detailMode === 'share'"
]);

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
  "pnpm verify:runtime-contract && pnpm verify:env-example && pnpm verify:feedback-system && pnpm build:all"
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
    "TMA, WeChat, Alipay, Douyin, QQ, Google, X login endpoints",
    "Taro storage based auth state",
    "fixed full-screen home background video",
    "iPhone 14 height baseline and safe-area styles",
    "public gallery and share detail access",
    "download/save flow with backend signed download URL",
    "payment sheet invokes only backend-created platform, crypto, and Telegram Stars orders",
    "runtime environment example keys",
    "verification script is wired into app verify"
  ]
}, null, 2));
