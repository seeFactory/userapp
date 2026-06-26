import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const appTtssPath = path.join(distDir, "app.ttss");
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

assert.ok(fs.existsSync(appTtssPath), "Douyin dist/app.ttss must exist.");
assert.ok(fs.existsSync(projectConfigPath), "Douyin dist/project.config.json must exist.");

const appTtss = fs.readFileSync(appTtssPath, "utf8");
assert.ok(!appTtss.includes("*"), "Douyin app.ttss must not include universal selectors.");
assert.ok(/\d+(?:\.\d+)?rpx\b/.test(appTtss), "Douyin app.ttss must emit rpx for mini program viewport adaptation.");
assert.ok(!appTtss.includes("max-width:390rpx"), "Douyin layout must not keep the old half-width 390rpx shell.");
assert.ok(!appTtss.includes("max-width:390px"), "Douyin layout must not keep the H5/TMA 390px shell.");
assert.ok(!appTtss.includes("width:100vw"), "Douyin layout must use the mini program viewport width instead of 100vw.");
assert.ok(!appTtss.includes("translateX(-181px)"), "Douyin back button must not use the old centered 390px shell offset.");
assert.ok(!appTtss.includes("translateX(-348.07692rpx)"), "Douyin back button must not use the transformed centered shell offset.");
assert.ok(/\.page-content\{[^}]*box-sizing:border-box/.test(appTtss), "Douyin ScrollView page-content must use border-box so padding cannot expand past the viewport.");

for (const token of ["min-height:1623.07692rpx", "font-size:26.92308rpx"]) {
  assert.ok(appTtss.includes(token), `Douyin app.ttss must preserve ${token}.`);
}

const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
assert.equal(projectConfig.compileType, "miniprogram", "Douyin project config must use mini program compile type.");

const textFiles = walk(distDir).filter((file) => /\.(ttml|ttss|js|json)$/i.test(file));
assert.ok(textFiles.length, "Douyin dist must contain text build artifacts.");

const joined = textFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert.ok(joined.includes(requiredApiBase), `Douyin dist must include ${requiredApiBase}.`);
assert.ok(joined.includes("douyin-miniapp"), "Douyin dist must include the douyin-miniapp runtime target.");

for (const pattern of forbiddenApiPatterns) {
  assert.ok(!joined.includes(pattern), `Douyin dist must not include ${pattern}.`);
}

console.log(JSON.stringify({
  checked: [
    "Douyin TTSS keeps the 390px source design scale before rpx conversion",
    "Douyin TTSS uses 390px-to-750rpx adaptive conversion",
    "Douyin layout fills the mini program viewport",
    "Douyin ScrollView padding stays inside the viewport",
    "Douyin TTSS excludes universal selectors",
    "Douyin runtime target is douyin-miniapp",
    "Douyin production API base is embedded"
  ],
  appTtss: appTtssPath,
  projectConfig: projectConfigPath
}, null, 2));
