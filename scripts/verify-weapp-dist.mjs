import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const appWxssPath = path.join(distDir, "app.wxss");
const projectConfigPath = path.join(distDir, "project.config.json");
const packagedHomeLogoPath = path.join(distDir, "static", "logo-hero.png");
const requiredApiBase = "https://seefactory-api.sidcloud.cn/api/v1";
const requiredHomeLogoUrl = "https://sf-oss.sidcloud.cn/branding/seefactory/home/2026/07/lAJalmQyrdKWH7PXSK.png";
const requiredDownloadOrigin = "https://sf-oss.sidcloud.cn";
const forbiddenApiPatterns = [
  "http://127.0.0.1",
  "https://127.0.0.1",
  "127.0.0.1:10087",
  "localhost:10087",
  "http://43.165.167.179",
  "https://43.165.167.179",
  "43.165.167.179:31087",
  "10087/api/v1",
  "31087/api/v1"
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

assert.ok(fs.existsSync(appWxssPath), "WeApp dist/app.wxss must exist.");
assert.ok(fs.existsSync(projectConfigPath), "WeApp dist/project.config.json must exist.");
assert.ok(!fs.existsSync(packagedHomeLogoPath), "WeApp dist must not package the replaced local homepage logo.");

const appWxss = fs.readFileSync(appWxssPath, "utf8");
assert.ok(!appWxss.includes("*"), "WeApp app.wxss must not include universal selectors; WeChat WXSS rejects them.");
assert.ok(/\d+(?:\.\d+)?rpx\b/.test(appWxss), "WeApp app.wxss must emit rpx for mini program viewport adaptation.");
assert.ok(!appWxss.includes("max-width:390rpx"), "WeApp layout must not keep the old half-width 390rpx shell.");
assert.ok(!appWxss.includes("max-width:390px"), "WeApp layout must not keep the H5/TMA 390px shell.");
assert.ok(!appWxss.includes("width:100vw"), "WeApp layout must use the mini program viewport width instead of 100vw.");
assert.ok(!appWxss.includes("translateX(-181px)"), "WeApp back button must not use the old centered 390px shell offset.");
assert.ok(!appWxss.includes("translateX(-348.07692rpx)"), "WeApp back button must not use the transformed centered shell offset.");
assert.ok(/\.page-content\{[^}]*box-sizing:border-box/.test(appWxss), "WeApp ScrollView page-content must use border-box so padding cannot expand past the viewport.");

for (const token of ["min-height:1623.07692rpx", "font-size:26.92308rpx"]) {
  assert.ok(appWxss.includes(token), `WeApp app.wxss must preserve ${token}.`);
}

const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
assert.notEqual(projectConfig.appid, "touristappid", "WeApp project appid must not be touristappid.");
assert.equal(projectConfig.setting?.skylineRenderEnable, false, "WeApp Skyline rendering must stay disabled for this Taro build.");
assert.equal(projectConfig.setting?.useApiHook, false, "WeApp DevTools API hook must stay disabled.");
assert.equal(projectConfig.setting?.useApiHostProcess, false, "WeApp DevTools API host process must stay disabled.");
assert.equal(projectConfig.appid, "wxdd9c66d4c22da001", "WeApp project appid must match the WeChat public platform AppID.");

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
  const pageScriptPath = path.join(distDir, "pages", page, "index.js");
  assert.ok(fs.existsSync(pageScriptPath), `WeApp share page script must exist: ${page}.`);
  const pageScript = fs.readFileSync(pageScriptPath, "utf8");
  assert.ok(pageScript.includes("enableShareAppMessage"), `${page} must enable friend sharing in dist.`);
  assert.ok(pageScript.includes("enableShareTimeline"), `${page} must enable timeline sharing in dist.`);
}

const agentPageScript = fs.readFileSync(path.join(distDir, "pages", "agent", "index.js"), "utf8");
assert.ok(agentPageScript.includes("enableShareAppMessage"), "Agent page must enable invite sharing in dist.");
assert.ok(!agentPageScript.includes("enableShareTimeline"), "Agent page must not enable timeline sharing in dist.");

const textFiles = walk(distDir).filter((file) => /\.(wxml|wxss|js|json)$/i.test(file));
assert.ok(textFiles.length, "WeApp dist must contain text build artifacts.");

const joined = textFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.ok(joined.includes(requiredApiBase), `WeApp dist must include ${requiredApiBase}.`);
assert.ok(joined.includes(requiredHomeLogoUrl), `WeApp dist must include ${requiredHomeLogoUrl}.`);
assert.ok(!joined.includes("/static/logo-hero.png"), "WeApp homepage must not fall back to the packaged hero logo.");
assert.ok(joined.includes(requiredDownloadOrigin), `WeApp dist must include allowlisted download origin ${requiredDownloadOrigin}.`);
assert.ok(joined.includes("wechat-miniapp"), "WeApp dist must include the wechat-miniapp runtime target.");
assert.ok(joined.includes("scope.writePhotosAlbum"), "WeApp dist must inspect album permission state.");
assert.ok(joined.includes("openSetting"), "WeApp dist must recover denied album permission through settings.");
assert.ok(joined.includes("saveImageToPhotosAlbum"), "WeApp dist must save downloaded images to the album.");
assert.ok(joined.includes("previewImage({current:"), "WeApp dist must call the native full-screen image preview API.");
assert.ok(joined.includes("showmenu:!0"), "WeApp full-screen image preview must keep the native long-press menu enabled.");
assert.ok(joined.includes("showShareMenu"), "WeApp dist must include share menu control.");
assert.ok(joined.includes("hideShareMenu"), "WeApp dist must include share menu privacy control.");
assert.ok(joined.includes('openType:"share"'), "WeApp dist must include native share buttons.");

for (const pattern of forbiddenApiPatterns) {
  assert.ok(!joined.includes(pattern), `WeApp dist must not include ${pattern}.`);
}

console.log(JSON.stringify({
  checked: [
    "WeApp WXSS keeps the 390px source design scale before rpx conversion",
    "WeApp WXSS uses 390px-to-750rpx adaptive conversion",
    "WeApp layout fills the mini program viewport",
    "WeApp ScrollView padding stays inside the viewport",
    "WeApp WXSS excludes universal selectors",
    "WeApp runtime target is wechat-miniapp",
    "WeApp production API base is embedded",
    "WeApp homepage logo uses the approved sidcloud.cn OSS URL",
    "WeApp download URL is constrained to the approved OSS domain",
    "WeApp album permission denial can recover through settings",
    "WeApp work images use native full-screen preview with the long-press menu",
    "WeApp project AppID matches the WeChat public platform",
    "WeApp DevTools compatibility flags are disabled",
    "WeApp public pages enable friend and timeline sharing",
    "WeApp agent invitations enable friend-only sharing",
    "WeApp bundle includes share menu state control",
    "WeApp bundle includes native open-type share buttons"
  ],
  appWxss: appWxssPath,
  projectConfig: projectConfigPath
}, null, 2));
