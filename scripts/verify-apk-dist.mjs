import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "dist", "index.html");
const capacitorConfigPath = path.join(root, "capacitor.config.json");
const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
const mainActivityPath = path.join(root, "android", "app", "src", "main", "java", "xyz", "seefactory", "app", "MainActivity.java");
const externalAuthPluginPath = path.join(root, "android", "app", "src", "main", "java", "xyz", "seefactory", "app", "ExternalAuthPlugin.java");
const externalAuthBridgePath = path.join(root, "android", "app", "src", "main", "java", "xyz", "seefactory", "app", "ExternalAuthBridge.java");
const androidAssetIndexPath = path.join(root, "android", "app", "src", "main", "assets", "public", "index.html");

assert.ok(existsSync(indexPath), "APK web dist/index.html must exist.");
assert.ok(existsSync(capacitorConfigPath), "capacitor.config.json must exist.");

const index = readFileSync(indexPath, "utf8");
const config = JSON.parse(readFileSync(capacitorConfigPath, "utf8"));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const distText = walk(path.join(root, "dist"))
  .filter((file) => /\.(html|js|css|json)$/i.test(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

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

assert.ok(distText.includes("https://api.seefactory.xyz/api/v1/auth/h5/google-callback"), "APK Google OAuth redirect must use the API HTTPS callback bridge.");
assert.ok(distText.includes("https://api.seefactory.xyz/api/v1/auth/h5/x-callback"), "APK X OAuth redirect must use the API HTTPS callback bridge.");
assert.ok(distText.includes("https://seefactory.xyz/auth/telegram-bridge.html"), "APK Telegram OAuth bridge must use the BotFather-bound seefactory.xyz domain.");
assert.ok(!distText.includes("seefactory://auth/google/callback"), "APK Google OAuth redirect must not use a custom scheme directly.");
assert.ok(!distText.includes("seefactory://auth/x/callback"), "APK X OAuth redirect must not use a custom scheme directly.");
assert.ok(!distText.includes("https://api.seefactory.xyz/api/v1/auth/h5/telegram-bridge"), "APK Telegram OAuth bridge must not use api.seefactory.xyz because BotFather is bound to seefactory.xyz.");

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

assert.ok(existsSync(mainActivityPath), "APK MainActivity must exist.");
assert.ok(existsSync(externalAuthPluginPath), "APK ExternalAuthPlugin must exist.");
assert.ok(existsSync(externalAuthBridgePath), "APK ExternalAuthBridge must exist.");
const mainActivity = readFileSync(mainActivityPath, "utf8");
const externalAuthPlugin = readFileSync(externalAuthPluginPath, "utf8");
const externalAuthBridge = readFileSync(externalAuthBridgePath, "utf8");
assert.ok(mainActivity.includes("registerPlugin(ExternalAuthPlugin.class)"), "APK MainActivity must register ExternalAuthPlugin.");
assert.ok(mainActivity.includes('addJavascriptInterface(new ExternalAuthBridge(this), "SeeFactoryExternalAuth")'), "APK MainActivity must expose SeeFactoryExternalAuth JavascriptInterface.");
assert.ok(externalAuthPlugin.includes('Intent.ACTION_VIEW'), "APK ExternalAuthPlugin must open auth URLs via Android ACTION_VIEW.");
assert.ok(externalAuthPlugin.includes('@CapacitorPlugin(name = "ExternalAuth")'), "APK ExternalAuthPlugin must expose the ExternalAuth bridge.");
assert.ok(externalAuthBridge.includes("@JavascriptInterface"), "APK ExternalAuthBridge must expose a JavascriptInterface method.");
assert.ok(externalAuthBridge.includes("activity.startActivity(intent)"), "APK ExternalAuthBridge must start external authorization from Activity context.");

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
    "APK native ExternalAuth plugin opens authorization URLs through Android ACTION_VIEW",
    "APK SeeFactoryExternalAuth JavascriptInterface opens authorization URLs from Activity context",
    "APK Android synced assets match dist when present"
  ],
  appId: config.appId,
  appName: config.appName,
  webDir: config.webDir
}, null, 2));
