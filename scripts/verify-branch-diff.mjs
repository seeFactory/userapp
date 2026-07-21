import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const workspaceRoot = basename(appRoot) === "app" ? resolve(appRoot, "..") : resolve(appRoot, "../..");
const frontendRoot = resolve(workspaceRoot, "frontend");

const defaultBaseRef = process.env.VERIFY_BRANCH_BASE || "origin/main";
const baseRef = process.argv[2] || defaultBaseRef;
const requestedTargets = process.argv.slice(3);
const defaultTargets = [
  "origin/tma",
  "origin/wechat",
  "origin/alipay",
  "origin/douyin",
  "origin/qq",
  "origin/android",
  "origin/apk"
];
const targets = requestedTargets.length ? requestedTargets : defaultTargets;

function parseTargetSpec(target) {
  const [branch, ...refParts] = String(target).split("=");
  if (refParts.length === 0) return { input: target, ref: target, branchOverride: "" };
  return {
    input: target,
    ref: refParts.join("="),
    branchOverride: branch
  };
}

const exactAllowed = {
  tma: new Set([
    "src/platform/login.js",
    "src/platform/payment.js"
  ]),
  wechat: new Set([
    ".env.example",
    "config/index.js",
    "package.json",
    "project.config.json",
    "project.private.config.json",
    "scripts/build-production.mjs",
    "scripts/postprocess-weapp-dist.mjs",
    "scripts/verify-env-example.mjs",
    "scripts/verify-weapp-dist.mjs",
    "src/platform/login.js",
    "src/platform/payment.js"
  ]),
  alipay: new Set([
    ".env.example",
    "config/index.js",
    "mini.project.json",
    "package.json",
    "project.config.json",
    "scripts/build-production.mjs",
    "scripts/postprocess-alipay-dist.mjs",
    "scripts/verify-alipay-dist.mjs",
    "scripts/verify-env-example.mjs",
    "src/app.config.js",
    "src/platform/login.js",
    "src/platform/payment.js"
  ]),
  douyin: new Set([
    ".env.example",
    "config/index.js",
    "package.json",
    "project.config.json",
    "scripts/build-production.mjs",
    "scripts/postprocess-douyin-dist.mjs",
    "scripts/verify-douyin-dist.mjs",
    "scripts/verify-env-example.mjs",
    "src/app.config.js",
    "src/platform/login.js",
    "src/platform/payment.js"
  ]),
  qq: new Set([
    ".env.example",
    "config/index.js",
    "package.json",
    "scripts/build-production.mjs",
    "scripts/postprocess-qq-dist.mjs",
    "scripts/verify-qq-dist.mjs",
    "scripts/verify-env-example.mjs",
    "src/app.config.js",
    "src/platform/login.js",
    "src/platform/payment.js"
  ]),
  android: new Set([
    "APK外部登录说明.md",
    "APK封装说明.md",
    "capacitor.config.json",
    "config/index.js",
    "package.json",
    "pnpm-lock.yaml",
    "scripts/build-android.mjs",
    "scripts/build-production.mjs",
    "scripts/verify-apk-dist.mjs",
    "src/app.jsx",
    "src/hooks/useAuthState.js",
    "src/hooks/useAuthStatus.js",
    "src/pages/agent/index.jsx",
    "src/pages/index/index.jsx",
    "src/pages/login/index.jsx",
    "src/pages/mine/index.jsx",
    "src/pages/wallet/index.jsx",
    "src/pages/workflow-cases/index.jsx",
    "src/pages/workflow-linear/index.jsx",
    "src/pages/workflow-purchases/index.jsx",
    "src/pages/workflow-runs/detail/index.jsx",
    "src/pages/works/index.jsx",
    "src/platform/deeplink.js",
    "src/platform/externalAuth.js",
    "src/platform/login.js",
    "src/platform/payment.js",
    "src/services/api.js",
    "src/utils/storage.js"
  ]),
  apk: new Set([
    "APK外部登录说明.md",
    "APK封装说明.md",
    "capacitor.config.json",
    "config/index.js",
    "package.json",
    "pnpm-lock.yaml",
    "scripts/build-android.mjs",
    "scripts/build-production.mjs",
    "scripts/verify-apk-dist.mjs",
    "src/app.jsx",
    "src/hooks/useAuthState.js",
    "src/hooks/useAuthStatus.js",
    "src/pages/agent/index.jsx",
    "src/pages/index/index.jsx",
    "src/pages/login/index.jsx",
    "src/pages/mine/index.jsx",
    "src/pages/wallet/index.jsx",
    "src/pages/workflow-cases/index.jsx",
    "src/pages/workflow-linear/index.jsx",
    "src/pages/workflow-purchases/index.jsx",
    "src/pages/workflow-runs/detail/index.jsx",
    "src/pages/works/index.jsx",
    "src/platform/deeplink.js",
    "src/platform/externalAuth.js",
    "src/platform/login.js",
    "src/platform/payment.js",
    "src/services/api.js",
    "src/utils/storage.js"
  ])
};

const prefixAllowed = {
  android: ["android/", "static/auth/"],
  apk: ["android/", "static/auth/"]
};

const branchRuntime = {
  main: "h5-google",
  app: "h5-google",
  tma: "telegram-tma",
  wechat: "wechat-miniapp",
  qq: "qq-miniapp",
  alipay: "alipay-miniapp",
  douyin: "douyin-miniapp",
  android: "android-apk",
  apk: "android-apk"
};

const paymentRuntime = {
  main: "[]",
  app: "[]",
  tma: "[]",
  wechat: "['wechat-miniapp']",
  qq: "['qq-miniapp']",
  alipay: "['alipay-miniapp']",
  douyin: "['douyin-miniapp']",
  android: "[]",
  apk: "[]"
};

function branchRoot(branch) {
  if (branch === "app") return resolve(workspaceRoot, "app");
  return resolve(frontendRoot, branch);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function refExists(ref) {
  try {
    git(["rev-parse", "--verify", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveRef(ref) {
  if (refExists(ref)) return ref;
  if (!ref.startsWith("origin/") && refExists(`origin/${ref}`)) return `origin/${ref}`;
  return "";
}

function branchKeyFromRef(ref) {
  return ref
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\/origin\//, "")
    .replace(/^origin\//, "");
}

function fileAllowed(branch, file) {
  if (exactAllowed[branch]?.has(file)) return true;
  return (prefixAllowed[branch] || []).some((prefix) => file.startsWith(prefix));
}

function show(ref, file) {
  return git(["show", `${ref}:${file}`]);
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, "/");
}

function listFiles(root, dir = "src") {
  const absoluteDir = resolve(root, dir);
  return readdirSync(absoluteDir).flatMap((name) => {
    const absolutePath = join(absoluteDir, name);
    const relativePath = toPosix(relative(root, absolutePath));
    return statSync(absolutePath).isDirectory()
      ? listFiles(root, relativePath)
      : [relativePath];
  });
}

function normalizedSource(root, file) {
  return readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
}

function assertBranchContract(branch, loginSource, paymentSource) {
  assert.ok(branchRuntime[branch], `Missing runtime contract for ${branch}.`);
  assert.ok(paymentRuntime[branch], `Missing payment contract for ${branch}.`);
  assert.ok(
    loginSource.includes(`LOGIN_BRANCH = '${branch}'`),
    `${branch} login module must identify LOGIN_BRANCH.`
  );
  assert.ok(
    loginSource.includes(`BRANCH_CLIENT_RUNTIME = '${branchRuntime[branch]}'`),
    `${branch} login module must use ${branchRuntime[branch]}.`
  );
  assert.ok(
    paymentSource.includes(`PAYMENT_BRANCH = '${branch}'`),
    `${branch} payment module must identify PAYMENT_BRANCH.`
  );
  assert.ok(
    paymentSource.includes(`PLATFORM_PAY_RUNTIMES = ${paymentRuntime[branch]}`),
    `${branch} payment module must use ${paymentRuntime[branch]}.`
  );
}

function assertDirectoryBranchContract(branch) {
  const root = branchRoot(branch);
  assert.ok(existsSync(root), `Missing target branch directory: ${branch}`);

  const loginSource = normalizedSource(root, "src/platform/login.js");
  const paymentSource = normalizedSource(root, "src/platform/payment.js");
  assertBranchContract(branch, loginSource, paymentSource);
}

function runRefChecks() {
  const resolvedBase = resolveRef(baseRef);
  assert.ok(resolvedBase, `Missing base ref: ${baseRef}`);

  const checked = [];
  for (const target of targets) {
    const targetSpec = parseTargetSpec(target);
    const resolvedTarget = resolveRef(targetSpec.ref);
    assert.ok(resolvedTarget, `Missing target ref: ${targetSpec.input}`);
    const branch = targetSpec.branchOverride || branchKeyFromRef(resolvedTarget);
    assert.ok(exactAllowed[branch] || prefixAllowed[branch], `No branch diff policy for ${branch}.`);

    const changedFiles = git(["-c", "core.quotePath=false", "diff", "--name-only", `${resolvedBase}..${resolvedTarget}`])
      .split(/\r?\n/)
      .filter(Boolean);
    const unexpectedFiles = changedFiles.filter((file) => !fileAllowed(branch, file));
    assert.deepEqual(unexpectedFiles, [], `${resolvedBase}..${resolvedTarget} contains non-platform code drift.`);

    assertBranchContract(
      branch,
      show(resolvedTarget, "src/platform/login.js"),
      show(resolvedTarget, "src/platform/payment.js")
    );
    checked.push({ branch, ref: resolvedTarget, changedFiles });
  }

  return { mode: "refs", baseRef: resolvedBase, checked };
}

function runDirectoryChecks() {
  const baseBranch = process.env.VERIFY_BRANCH_DIRECTORY_BASE || "app";
  const branches = (process.env.VERIFY_BRANCH_DIRECTORY_TARGETS || "tma,qq,wechat,alipay,douyin,apk")
    .split(",")
    .map((branch) => branch.trim())
    .filter(Boolean);
  const baseRoot = branchRoot(baseBranch);
  assert.ok(existsSync(baseRoot), `Missing base branch directory: ${baseBranch}`);

  const checked = [];
  for (const branch of branches) {
    const targetRoot = branchRoot(branch);
    assert.ok(existsSync(targetRoot), `Missing target branch directory: ${branch}`);
    const files = new Set([...listFiles(baseRoot), ...listFiles(targetRoot)]);
    const unexpectedFiles = [...files]
      .sort()
      .filter((file) => !fileAllowed(branch, file))
      .filter((file) => {
        const baseFile = resolve(baseRoot, file);
        const targetFile = resolve(targetRoot, file);
        if (!existsSync(baseFile) || !existsSync(targetFile)) return true;
        return normalizedSource(baseRoot, file) !== normalizedSource(targetRoot, file);
      });
    assert.deepEqual(unexpectedFiles, [], `${baseBranch} and ${branch} contain non-platform code drift.`);
    assertDirectoryBranchContract(branch);
    checked.push({ branch, changedFiles: [...files].filter((file) => fileAllowed(branch, file)) });
  }

  return { mode: "directories", baseBranch, checked };
}

const result = process.env.VERIFY_BRANCH_DIRECTORIES === "true"
  ? runDirectoryChecks()
  : runRefChecks();

console.log(JSON.stringify(result, null, 2));
