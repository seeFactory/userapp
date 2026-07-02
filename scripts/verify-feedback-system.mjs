import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");

function readSource(relativePath) {
  return readFileSync(resolve(appRoot, relativePath), "utf8");
}

function assertIncludes(source, pattern, message) {
  assert.ok(source.includes(pattern), message);
}

function assertPageIncludes(pagePath, patterns) {
  const source = readSource(`src/${pagePath}.jsx`);
  for (const [pattern, message] of patterns) {
    assertIncludes(source, pattern, `${pagePath}: ${message}`);
  }
}

const appConfigSource = readSource("src/app.config.js");
const pageStateSource = readSource("src/components/PageState.jsx");
const appCssSource = readSource("src/app.css");
const paymentSheetSource = readSource("src/components/PaymentSheet.jsx");
const customerModalSource = readSource("src/components/CustomerModal.jsx");
const packageSource = readSource("package.json");

const expectedPages = [
  "pages/index/index",
  "pages/create-center/index",
  "pages/gallery/index",
  "pages/works/index",
  "pages/mine/index",
  "pages/login/index",
  "pages/tool/index",
  "pages/prompt-detail/index",
  "pages/work-detail/index",
  "pages/agent/index",
  "pages/wallet/index",
  "pages/workflow-cases/index",
  "pages/workflow-purchases/index",
  "pages/workflow-linear/index",
  "pages/workflow-runs/detail/index"
];

for (const page of expectedPages) {
  assertIncludes(appConfigSource, `'${page}'`, `app.config.js must register ${page}.`);
}

for (const componentName of ["PageLoading", "EmptyState", "ErrorState", "InlineNotice"]) {
  assertIncludes(pageStateSource, `export function ${componentName}`, `PageState must export ${componentName}.`);
}

for (const className of [
  ".page-state",
  ".page-state-loading",
  ".page-state-empty",
  ".page-state-error",
  ".inline-notice",
  ".loading-ring",
  ".modal-mask",
  ".modal-panel",
  ".payment-sheet"
]) {
  assertIncludes(appCssSource, className, `app.css must define ${className}.`);
}

const dataPageRules = {
  "pages/index/index": ["PageLoading", "ErrorState", "EmptyState"],
  "pages/create-center/index": ["PageLoading", "ErrorState", "EmptyState"],
  "pages/gallery/index": ["PageLoading", "ErrorState", "EmptyState", "InlineNotice"],
  "pages/works/index": ["PageLoading", "ErrorState", "EmptyState", "InlineNotice", "Taro.showModal"],
  "pages/tool/index": ["PageLoading", "ErrorState", "InlineNotice", "PaymentSheet", "Taro.showLoading", "Taro.showToast"],
  "pages/prompt-detail/index": ["PageLoading", "ErrorState", "Taro.showToast"],
  "pages/work-detail/index": ["PageLoading", "ErrorState", "Taro.showLoading", "Taro.showToast", "Taro.showModal"],
  "pages/agent/index": ["PageLoading", "ErrorState", "EmptyState", "InlineNotice", "Taro.showModal"],
  "pages/wallet/index": ["PageLoading", "ErrorState", "EmptyState", "InlineNotice", "Taro.showLoading", "Taro.showToast", "Taro.showModal"],
  "pages/workflow-cases/index": ["PageLoading", "ErrorState", "EmptyState", "InlineNotice", "Taro.showLoading", "Taro.showToast", "Taro.showModal"],
  "pages/workflow-purchases/index": ["PageLoading", "ErrorState", "EmptyState", "InlineNotice", "Taro.showLoading", "Taro.showToast", "Taro.showModal"],
  "pages/workflow-linear/index": ["PageLoading", "ErrorState", "EmptyState", "InlineNotice", "Taro.showLoading", "Taro.showToast", "Taro.showModal", "submitting"],
  "pages/workflow-runs/detail/index": ["PageLoading", "ErrorState", "EmptyState", "InlineNotice"]
};

for (const [pagePath, patterns] of Object.entries(dataPageRules)) {
  assertPageIncludes(pagePath, patterns.map((pattern) => [pattern, `must include ${pattern}.`]));
}

assertPageIncludes("pages/login/index", [
  ["Taro.showLoading", "login actions must show loading."],
  ["Taro.hideLoading", "login actions must hide loading."],
  ["Taro.showToast", "login failures and successes must use toast feedback."],
  ["AgreementModal", "agreement viewing must use modal feedback."],
  ["loading ? 'primary-button disabled'", "primary login button must expose a disabled/loading state."]
]);

assertPageIncludes("pages/mine/index", [
  ["CustomerModal", "mine page must expose customer service modal."],
  ["PaymentSheet", "mine page must expose recharge payment modal."],
  ["Taro.showLoading", "recharge and agreement actions must show loading."],
  ["Taro.hideLoading", "recharge and agreement actions must hide loading."],
  ["Taro.showToast", "mine page actions must use toast feedback."],
  ["AgreementModal", "agreement viewing must use modal feedback."]
]);

for (const pattern of [
  "const [invoking, setInvoking] = useState(false)",
  "const primaryBusy = invoking || Boolean(payment.cryptoCreating)",
  "if (primaryBusy) return",
  "Taro.showToast",
  "modal-mask",
  "payment-sheet",
  "CryptoRoutePicker"
]) {
  assertIncludes(paymentSheetSource, pattern, `PaymentSheet must include ${pattern}.`);
}

for (const pattern of [
  "const [loading, setLoading] = useState(false)",
  "fetchCustomerService()",
  "Taro.showToast",
  "Taro.previewImage",
  "modal-mask",
  "qr-card"
]) {
  assertIncludes(customerModalSource, pattern, `CustomerModal must include ${pattern}.`);
}

assertIncludes(
  packageSource,
  '"verify:feedback-system"',
  "app package verify must include the feedback system checker."
);

console.log(JSON.stringify({
  checked: [
    "registered miniapp pages",
    "PageState component exports",
    "state and modal CSS classes",
    "data page loading/error/empty coverage",
    "login loading/toast/modal feedback",
    "mine customer and payment modals",
    "PaymentSheet busy guard and feedback",
    "CustomerModal loading and QR feedback",
    "Workflow purchase, run detail, and linear builder feedback",
    "app verify script registration"
  ]
}, null, 2));
