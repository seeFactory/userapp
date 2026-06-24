import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const appWxssPath = path.join(distDir, "app.wxss");
const projectConfigPath = path.join(distDir, "project.config.json");
const requiredApiBase = "https://api.seefactory.xyz/api/v1";
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

const appWxss = fs.readFileSync(appWxssPath, "utf8");
assert.ok(!appWxss.includes("*"), "WeApp app.wxss must not include universal selectors; WeChat WXSS rejects them.");
assert.ok(/\d+(?:\.\d+)?rpx\b/.test(appWxss), "WeApp app.wxss must emit rpx for mini program viewport adaptation.");
assert.ok(!appWxss.includes("max-width:390rpx"), "WeApp layout must not keep the old half-width 390rpx shell.");
assert.ok(!appWxss.includes("max-width:390px"), "WeApp layout must not keep the H5/TMA 390px shell.");
assert.ok(!appWxss.includes("width:100vw"), "WeApp layout must use the mini program viewport width instead of 100vw.");
assert.ok(!appWxss.includes("translateX(-181px)"), "WeApp back button must not use the old centered 390px shell offset.");
assert.ok(!appWxss.includes("translateX(-348.07692rpx)"), "WeApp back button must not use the transformed centered shell offset.");

for (const token of ["min-height:1623.07692rpx", "font-size:26.92308rpx"]) {
  assert.ok(appWxss.includes(token), `WeApp app.wxss must preserve ${token}.`);
}

const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
assert.notEqual(projectConfig.appid, "touristappid", "WeApp project appid must not be touristappid.");
assert.equal(projectConfig.setting?.skylineRenderEnable, false, "WeApp Skyline rendering must stay disabled for this Taro build.");
assert.equal(projectConfig.setting?.useApiHook, false, "WeApp DevTools API hook must stay disabled.");
assert.equal(projectConfig.setting?.useApiHostProcess, false, "WeApp DevTools API host process must stay disabled.");

const textFiles = walk(distDir).filter((file) => /\.(wxml|wxss|js|json)$/i.test(file));
assert.ok(textFiles.length, "WeApp dist must contain text build artifacts.");

const joined = textFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.ok(joined.includes(requiredApiBase), `WeApp dist must include ${requiredApiBase}.`);
assert.ok(joined.includes("wechat-miniapp"), "WeApp dist must include the wechat-miniapp runtime target.");

for (const pattern of forbiddenApiPatterns) {
  assert.ok(!joined.includes(pattern), `WeApp dist must not include ${pattern}.`);
}

console.log(JSON.stringify({
  checked: [
    "WeApp WXSS keeps the 390px source design scale before rpx conversion",
    "WeApp WXSS uses 390px-to-750rpx adaptive conversion",
    "WeApp layout fills the mini program viewport",
    "WeApp WXSS excludes universal selectors",
    "WeApp runtime target is wechat-miniapp",
    "WeApp production API base is embedded",
    "WeApp DevTools compatibility flags are disabled"
  ],
  appWxss: appWxssPath,
  projectConfig: projectConfigPath
}, null, 2));
