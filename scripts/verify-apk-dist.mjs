import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "dist", "index.html");
const capacitorConfigPath = path.join(root, "capacitor.config.json");
const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
const androidAssetIndexPath = path.join(root, "android", "app", "src", "main", "assets", "public", "index.html");

assert.ok(existsSync(indexPath), "APK web dist/index.html must exist.");
assert.ok(existsSync(capacitorConfigPath), "capacitor.config.json must exist.");

const index = readFileSync(indexPath, "utf8");
const config = JSON.parse(readFileSync(capacitorConfigPath, "utf8"));

assert.equal(config.appId, "xyz.seefactory.app", "APK appId must be xyz.seefactory.app.");
assert.equal(config.appName, "seeFactory", "APK appName must be seeFactory.");
assert.equal(config.webDir, "dist", "APK webDir must point to dist.");
assert.equal(config.server?.androidScheme, "https", "APK should use https WebView scheme.");

const forbiddenMarkers = [
  "telegram-web-app.js",
  "telegram.org/js",
  "telegram-web",
  "-app.js?62",
  "seeFactoryTgLaunchParams",
  "__SEEFACTORY_TG_LAUNCH_PARAMS__",
  "#/pages/index/index?tgLaunch=",
  "http://127.0.0.1",
  "localhost:10087",
  "43.165.167.179:31087"
];

for (const marker of forbiddenMarkers) {
  assert.ok(!index.includes(marker), `APK index.html must not include ${marker}.`);
}

if (existsSync(manifestPath)) {
  const manifest = readFileSync(manifestPath, "utf8");
  assert.ok(manifest.includes('android:allowBackup="false"'), "APK AndroidManifest must disable app backup.");
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'), "APK AndroidManifest must reject cleartext traffic.");
  assert.ok(manifest.includes('<uses-permission android:name="android.permission.INTERNET" />'), "APK AndroidManifest must allow HTTPS API access.");
  assert.ok(manifest.includes('android:scheme="seefactory"'), "APK AndroidManifest must register seeFactory deep link scheme.");
  assert.ok(manifest.includes('android:host="auth"'), "APK AndroidManifest must register auth deep link host.");
  assert.ok(manifest.includes('android:pathPrefix="/x/callback"'), "APK AndroidManifest must register X callback deep link path.");
  assert.ok(manifest.includes('android:pathPrefix="/google/callback"'), "APK AndroidManifest must register Google callback deep link path.");
  assert.ok(manifest.includes('android:pathPrefix="/telegram/callback"'), "APK AndroidManifest must register Telegram callback deep link path.");
}

if (existsSync(androidAssetIndexPath)) {
  const androidIndex = readFileSync(androidAssetIndexPath, "utf8");
  assert.equal(androidIndex, index, "Android synced index.html must match dist/index.html.");
}

console.log(JSON.stringify({
  checked: [
    "APK Capacitor config exists",
    "APK H5 production entry exists",
    "APK H5 entry excludes Telegram launch markers and local API bases",
    "APK appId, appName, webDir and Android scheme are stable",
    "APK AndroidManifest disables backup and cleartext traffic when present",
    "APK AndroidManifest registers seeFactory Google, Telegram and X auth deep links when present",
    "APK Android synced assets match dist when present"
  ],
  appId: config.appId,
  appName: config.appName,
  webDir: config.webDir
}, null, 2));
