import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");

function read(relativePath) {
  return readFileSync(resolve(appRoot, relativePath), "utf8");
}

function parseEnvExample(source) {
  const entries = new Map();
  const duplicates = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    assert.ok(match, `.env.example contains invalid line: ${line}`);
    const [, key, value] = match;
    if (entries.has(key)) duplicates.push(key);
    entries.set(key, value);
  }

  assert.deepEqual(duplicates, [], ".env.example must not contain duplicate keys.");
  return entries;
}

function assertIncludes(source, pattern, message) {
  assert.ok(source.includes(pattern), message);
}

const envSource = read(".env.example");
const env = parseEnvExample(envSource);
const expectedKeys = [
  "SEEFACTORY_API_BASE",
  "SEEFACTORY_CLIENT_VERSION",
  "SEEFACTORY_GOOGLE_CLIENT_ID",
  "SEEFACTORY_X_REDIRECT_URI",
  "SEEFACTORY_DEV_LOGIN_ENABLED"
];

assert.deepEqual(
  Array.from(env.keys()).sort(),
  expectedKeys.slice().sort(),
  "User app .env.example must document only the supported runtime keys."
);
assert.equal(
  env.get("SEEFACTORY_API_BASE"),
  "https://seefactory-api.sidcloud.cn/api/v1",
  "SEEFACTORY_API_BASE must default to the ICP-filed domestic miniapp API prefix."
);
assert.match(
  env.get("SEEFACTORY_CLIENT_VERSION") || "",
  /^\d+\.\d+\.\d+$/,
  "SEEFACTORY_CLIENT_VERSION must be a semver-like value."
);
assert.equal(env.get("SEEFACTORY_GOOGLE_CLIENT_ID"), "", "Google client id must remain empty in .env.example.");
assert.equal(env.get("SEEFACTORY_X_REDIRECT_URI"), "", "X redirect URI must remain empty in .env.example.");
assert.equal(env.get("SEEFACTORY_DEV_LOGIN_ENABLED"), "false", "Development login must be disabled by default.");

const api = read("src/services/api.js");
const taroConfig = read("config/index.js");
for (const pattern of [
  "process.env.SEEFACTORY_API_BASE",
  "process.env.SEEFACTORY_GOOGLE_CLIENT_ID",
  "process.env.SEEFACTORY_X_REDIRECT_URI",
  "process.env.SEEFACTORY_DEV_LOGIN_ENABLED",
  "process.env.SEEFACTORY_CLIENT_VERSION",
  "DEFAULT_API_BASE = 'http://127.0.0.1:10087/api/v1'",
  ".replace(/\\/+$/, '')",
  "CLIENT_VERSION = process.env.SEEFACTORY_CLIENT_VERSION || '0.1.0'",
  "'X-Client-Runtime': getClientRuntime()",
  "'X-Client-Version': CLIENT_VERSION",
  "getFrontendLoginConfig",
  "devLoginEnabled: DEV_LOGIN_ENABLED"
]) {
  assertIncludes(api, pattern, `src/services/api.js must include ${pattern}.`);
}

for (const pattern of [
  "const clientVersion = process.env.SEEFACTORY_CLIENT_VERSION || '0.1.0'",
  "platformRuntimeTargets[process.env.TARO_ENV]",
  "domesticMiniappApiBase = 'https://seefactory-api.sidcloud.cn/api/v1'",
  "'process.env.SEEFACTORY_CLIENT_VERSION': JSON.stringify(clientVersion)",
  "'process.env.SEEFACTORY_RUNTIME_TARGET': JSON.stringify(runtimeTarget)"
]) {
  assertIncludes(taroConfig, pattern, `config/index.js must include ${pattern}.`);
}

const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.scripts?.["verify:env-example"], "node scripts/verify-env-example.mjs", "package.json must expose verify:env-example.");
assertIncludes(packageJson.scripts?.verify || "", "pnpm verify:env-example", "app verify must run verify:env-example.");

console.log(JSON.stringify({
  checked: [
    "User app .env.example syntax",
    "User app runtime key allow-list",
    "domestic miniapp API base default",
    "semver-like client version",
    "OAuth placeholders kept empty",
    "development login disabled by default",
    "API base trailing slash normalization",
    "runtime and version request headers",
    "login configuration exposure",
    "app verify script registration"
  ]
}, null, 2));
