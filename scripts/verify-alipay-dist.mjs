import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const appAcssPath = path.join(distDir, "app.acss");
const projectConfigPath = path.join(distDir, "project.config.json");
const requiredApiBase = "https://seefactory-api.sidcloud.cn/api/v1";
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

assert.ok(fs.existsSync(appAcssPath), "Alipay dist/app.acss must exist.");
assert.ok(fs.existsSync(projectConfigPath), "Alipay dist/project.config.json must exist.");

const appAcss = fs.readFileSync(appAcssPath, "utf8");
assert.ok(!appAcss.includes("*"), "Alipay app.acss must not include universal selectors.");
assert.ok(/\d+(?:\.\d+)?rpx\b/.test(appAcss), "Alipay app.acss must emit rpx for mini program viewport adaptation.");
assert.ok(!appAcss.includes("max-width:390rpx"), "Alipay layout must not keep the old half-width 390rpx shell.");
assert.ok(!appAcss.includes("max-width:390px"), "Alipay layout must not keep the H5/TMA 390px shell.");
assert.ok(!appAcss.includes("width:100vw"), "Alipay layout must use the mini program viewport width instead of 100vw.");
assert.ok(!appAcss.includes("translateX(-181px)"), "Alipay back button must not use the old centered 390px shell offset.");
assert.ok(!appAcss.includes("translateX(-348.07692rpx)"), "Alipay back button must not use the transformed centered shell offset.");
assert.ok(/\.page-content\{[^}]*box-sizing:border-box/.test(appAcss), "Alipay ScrollView page-content must use border-box so padding cannot expand past the viewport.");

for (const token of ["min-height:1623.07692rpx", "font-size:26.92308rpx"]) {
  assert.ok(appAcss.includes(token), `Alipay app.acss must preserve ${token}.`);
}

const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
assert.equal(projectConfig.compileType, "miniprogram", "Alipay project config must use mini program compile type.");

const textFiles = walk(distDir).filter((file) => /\.(axml|acss|js|json)$/i.test(file));
assert.ok(textFiles.length, "Alipay dist must contain text build artifacts.");

const joined = textFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.ok(joined.includes(requiredApiBase), `Alipay dist must include ${requiredApiBase}.`);
assert.ok(joined.includes("alipay-miniapp"), "Alipay dist must include the alipay-miniapp runtime target.");

for (const pattern of forbiddenApiPatterns) {
  assert.ok(!joined.includes(pattern), `Alipay dist must not include ${pattern}.`);
}

console.log(JSON.stringify({
  checked: [
    "Alipay ACSS keeps the 390px source design scale before rpx conversion",
    "Alipay ACSS uses 390px-to-750rpx adaptive conversion",
    "Alipay layout fills the mini program viewport",
    "Alipay ScrollView padding stays inside the viewport",
    "Alipay ACSS excludes universal selectors",
    "Alipay runtime target is alipay-miniapp",
    "Alipay production API base is embedded"
  ],
  appAcss: appAcssPath,
  projectConfig: projectConfigPath
}, null, 2));
