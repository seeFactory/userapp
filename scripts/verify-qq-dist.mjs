import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const appQssPath = path.join(distDir, "app.qss");
const appJsonPath = path.join(distDir, "app.json");
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

assert.ok(fs.existsSync(appQssPath), "QQ dist/app.qss must exist.");
assert.ok(fs.existsSync(appJsonPath), "QQ dist/app.json must exist.");

const appQss = fs.readFileSync(appQssPath, "utf8");
assert.ok(!appQss.includes("*"), "QQ app.qss must not include universal selectors.");
assert.ok(/\d+(?:\.\d+)?rpx\b/.test(appQss), "QQ app.qss must emit rpx for mini program viewport adaptation.");
assert.ok(!appQss.includes("max-width:390rpx"), "QQ layout must not keep the old half-width 390rpx shell.");
assert.ok(!appQss.includes("max-width:390px"), "QQ layout must not keep the H5/TMA 390px shell.");
assert.ok(!appQss.includes("width:100vw"), "QQ layout must use the mini program viewport width instead of 100vw.");
assert.ok(!appQss.includes("translateX(-181px)"), "QQ back button must not use the old centered 390px shell offset.");
assert.ok(!appQss.includes("translateX(-348.07692rpx)"), "QQ back button must not use the transformed centered shell offset.");
assert.ok(/\.page-content\{[^}]*box-sizing:border-box/.test(appQss), "QQ ScrollView page-content must use border-box so padding cannot expand past the viewport.");

for (const token of ["min-height:1623.07692rpx", "font-size:26.92308rpx"]) {
  assert.ok(appQss.includes(token), `QQ app.qss must preserve ${token}.`);
}

const textFiles = walk(distDir).filter((file) => /\.(qml|qss|js|json)$/i.test(file));
assert.ok(textFiles.length, "QQ dist must contain text build artifacts.");

const joined = textFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.ok(joined.includes(requiredApiBase), `QQ dist must include ${requiredApiBase}.`);
assert.ok(joined.includes("qq-miniapp"), "QQ dist must include the qq-miniapp runtime target.");

for (const pattern of forbiddenApiPatterns) {
  assert.ok(!joined.includes(pattern), `QQ dist must not include ${pattern}.`);
}

console.log(JSON.stringify({
  checked: [
    "QQ QSS keeps the 390px source design scale before rpx conversion",
    "QQ QSS uses 390px-to-750rpx adaptive conversion",
    "QQ layout fills the mini program viewport",
    "QQ ScrollView padding stays inside the viewport",
    "QQ QSS excludes universal selectors",
    "QQ runtime target is qq-miniapp",
    "QQ production API base is embedded"
  ],
  appQss: appQssPath,
  appJson: appJsonPath
}, null, 2));
