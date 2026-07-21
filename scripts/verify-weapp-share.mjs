import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(relativePath) {
  return readFileSync(resolve(relativePath), "utf8");
}

const sharePages = [
  "index",
  "create-center",
  "gallery",
  "tool",
  "prompt-detail",
  "work-detail",
  "workflow-cases",
  "workflow-linear"
];

for (const page of sharePages) {
  const config = source(`src/pages/${page}/index.config.js`);
  const pageSource = source(`src/pages/${page}/index.jsx`);
  assert.ok(config.includes("enableShareAppMessage: true"), `${page} must enable friend sharing.`);
  assert.ok(config.includes("enableShareTimeline: true"), `${page} must enable timeline sharing.`);
  assert.ok(pageSource.includes("useMiniappShare"), `${page} must register the shared miniapp hook.`);
}

const agentConfig = source("src/pages/agent/index.config.js");
const agentPage = source("src/pages/agent/index.jsx");
assert.ok(agentConfig.includes("enableShareAppMessage: true"), "Agent invitations must enable friend sharing.");
assert.ok(!agentConfig.includes("enableShareTimeline: true"), "Agent invitations must not share the private agent page to timeline.");
for (const pattern of [
  "timelineEnabled: false",
  "query: { inviteCode, source: 'wechat-share' }",
  "NativeShareButton",
  "分享邀请"
]) {
  assert.ok(agentPage.includes(pattern), `Agent invite sharing must include ${pattern}.`);
}

const privatePages = [
  "login",
  "mine",
  "wallet",
  "works",
  "workflow-purchases",
  "workflow-runs/detail"
];
for (const page of privatePages) {
  const config = source(`src/pages/${page}/index.config.js`);
  assert.ok(!config.includes("enableShareAppMessage: true"), `${page} must remain private.`);
  assert.ok(!config.includes("enableShareTimeline: true"), `${page} must remain private.`);
}

const shareHook = source("src/hooks/useMiniappShare.weapp.js");
for (const pattern of [
  "Taro.useShareAppMessage",
  "Taro.useShareTimeline",
  "Taro.showShareMenu",
  "Taro.hideShareMenu",
  "buildMiniappSharePath",
  "encodeURIComponent",
  "return true"
]) {
  assert.ok(shareHook.includes(pattern), `Miniapp share hook must include ${pattern}.`);
}
const fallbackShareHook = source("src/hooks/useMiniappShare.js");
assert.ok(!fallbackShareHook.includes("Taro.useShareAppMessage"), "Non-WeChat runtimes must not bundle WeChat share hooks.");
assert.ok(fallbackShareHook.includes("return false"), "Non-WeChat runtime detection must stay disabled.");

const workDetail = source("src/pages/work-detail/index.jsx");
for (const pattern of [
  "preparedShareTicket",
  "galleryShareReady",
  "nativeShareReady",
  "query: nativeShareQuery",
  "isWechatMiniappRuntime() && nativeShareReady",
  "NativeShareButton",
  "分享已就绪，请再次点击分享"
]) {
  assert.ok(workDetail.includes(pattern), `Work sharing must include ${pattern}.`);
}

const nativeShareButton = source("src/components/NativeShareButton.weapp.jsx");
assert.ok(nativeShareButton.includes("openType='share'"), "WeChat native share button must use open-type=share.");

const packageSource = source("package.json");
assert.ok(packageSource.includes('"verify:weapp-share"'), "Package scripts must expose the share verification.");

console.log(JSON.stringify({
  checked: [
    "friend and timeline sharing on public pages",
    "friend-only agent invite sharing",
    "private pages keep sharing disabled",
    "share paths encode query values",
    "work shares require a public gallery route or share ticket",
    "native share buttons use open-type=share"
  ],
  sharePages,
  privatePages
}, null, 2));
