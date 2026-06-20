import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const baseBranch = process.argv[2] || "main";
const targetBranches = process.argv.slice(3);
const branches = targetBranches.length ? targetBranches : ["tma", "qq", "wechat", "alipay"];
const allowedDifferentFiles = new Set([
  "src/platform/login.js",
  "src/platform/payment.js"
]);

const branchRuntime = {
  main: "h5-google",
  tma: "telegram-tma",
  qq: "qq-miniapp",
  wechat: "wechat-miniapp",
  alipay: "alipay-miniapp"
};

const paymentRuntime = {
  main: "[]",
  tma: "[]",
  qq: "['qq-miniapp']",
  wechat: "['wechat-miniapp']",
  alipay: "['alipay-miniapp']"
};

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function branchExists(branch) {
  try {
    git(["rev-parse", "--verify", branch]);
    return true;
  } catch {
    return false;
  }
}

function show(branch, file) {
  return git(["show", `${branch}:${file}`]);
}

assert.ok(branchExists(baseBranch), `Missing base branch: ${baseBranch}`);

for (const branch of branches) {
  assert.ok(branchExists(branch), `Missing target branch: ${branch}`);
  const changedFiles = git(["diff", "--name-only", `${baseBranch}..${branch}`])
    .split(/\r?\n/)
    .filter(Boolean);
  const unexpectedFiles = changedFiles.filter((file) => !allowedDifferentFiles.has(file));
  assert.deepEqual(
    unexpectedFiles,
    [],
    `${baseBranch}..${branch} may only differ in login/payment modules.`
  );

  const loginSource = show(branch, "src/platform/login.js");
  const paymentSource = show(branch, "src/platform/payment.js");
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

console.log(JSON.stringify({
  baseBranch,
  branches,
  allowedDifferentFiles: [...allowedDifferentFiles]
}, null, 2));
