import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");

assert.ok(fs.existsSync(indexPath), "TMA dist/index.html must exist.");

const html = fs.readFileSync(indexPath, "utf8");

for (const pattern of [
  "seeFactoryTgLaunchParams",
  "__SEEFACTORY_TG_LAUNCH_PARAMS__",
  "#/pages/index/index?tgLaunch=",
  "/js/app.js",
  "/css/app.css"
]) {
  assert.ok(html.includes(pattern), `TMA dist/index.html must include ${pattern}.`);
}

assert.ok(
  !html.includes('src="/js/813.js') || html.includes("?v="),
  "TMA dist JavaScript entry assets must be cache-busted."
);

const textFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (/\.(html|js|css|json)$/i.test(entry.name)) {
      textFiles.push(fullPath);
    }
  }
}

walk(distDir);

const joined = textFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

for (const pattern of [
  "telegram-tma",
  "telegramSdkUrl",
  "telegram-web",
  "-app.js?62",
  "/auth/tma-login",
  "readTelegramLoginPayload",
  "getTelegramInitDataFromLaunchParams",
  "getTelegramUserFromInitData",
  "createTelegramStarsOrder"
]) {
  assert.ok(joined.includes(pattern), `TMA dist artifacts must include ${pattern}.`);
}

console.log(JSON.stringify({
  checked: [
    "TMA launch hash is preserved before Taro routing",
    "TMA Telegram SDK lazy loading contract is present",
    "TMA runtime and login/payment contracts are present"
  ],
  index: indexPath
}, null, 2));
