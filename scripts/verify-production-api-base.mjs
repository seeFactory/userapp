import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const requiredApiBase = "https://api.seefactory.xyz/api/v1";
const runtimeTarget = process.env.SEEFACTORY_RUNTIME_TARGET || "h5";
const forbiddenPatterns = [
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
const h5ForbiddenTelegramMiniAppMarkers = [
  "telegram-web-app.js",
  "telegram.org/js",
  "seeFactoryTgLaunchParams",
  "__SEEFACTORY_TG_LAUNCH_PARAMS__",
  "#/pages/index/index?tgLaunch="
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const files = walk(distDir).filter((file) => /\.(html|js|css|json)$/i.test(file));
assert.ok(files.length, "App/TMA dist must contain build artifacts before verifying production API base.");

let joined = "";
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  joined += `\n${text}`;
  for (const pattern of forbiddenPatterns) {
    assert.ok(!text.includes(pattern), `App/TMA production artifact ${file} must not include ${pattern}.`);
  }
}

assert.ok(joined.includes(requiredApiBase), `App/TMA production artifacts must include ${requiredApiBase}.`);

if (runtimeTarget !== "telegram-tma") {
  for (const pattern of h5ForbiddenTelegramMiniAppMarkers) {
    assert.ok(!joined.includes(pattern), `App H5 production artifacts must not include Telegram Mini App marker ${pattern}.`);
  }
}

console.log(JSON.stringify({
  checked: [
    "App/TMA production API base is embedded",
    "App/TMA production artifacts exclude localhost and origin-IP API bases",
    "App H5 production artifacts exclude Telegram Mini App launch and SDK markers"
  ],
  apiBase: requiredApiBase,
  runtimeTarget
}, null, 2));
