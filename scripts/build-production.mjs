import { spawnSync } from "node:child_process";

const runtimeTarget = process.argv[2] || "h5";
const allowedTargets = new Set(["h5", "telegram-tma", "douyin-miniapp"]);

if (!allowedTargets.has(runtimeTarget)) {
  console.error(`Unsupported production runtime target: ${runtimeTarget}`);
  process.exit(1);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const globalApiBase = "https://api.seefactory.xyz/api/v1";
const domesticMiniappApiBase = "https://seefactory-api.sidcloud.cn/api/v1";
const domesticMiniappTargets = new Set(["wechat-miniapp", "alipay-miniapp", "douyin-miniapp", "qq-miniapp"]);
const env = {
  ...process.env,
  SEEFACTORY_API_BASE: process.env.SEEFACTORY_API_BASE || (domesticMiniappTargets.has(runtimeTarget) ? domesticMiniappApiBase : globalApiBase),
  SEEFACTORY_CLIENT_VERSION: process.env.SEEFACTORY_CLIENT_VERSION || "0.1.0",
  SEEFACTORY_DEV_LOGIN_ENABLED: "false",
  SEEFACTORY_RUNTIME_TARGET: runtimeTarget
};

function run(args) {
  const result = spawnSync(pnpm, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    if (result.error) {
      console.error(result.error);
    }
    process.exit(result.status || 1);
  }
}

if (runtimeTarget === "douyin-miniapp") {
  run(["clean:dist"]);
  run(["exec", "taro", "build", "--type", "tt"]);
  run(["prepare:douyin-dist"]);
  run(["verify:douyin-dist"]);
  process.exit(0);
}

run(["prepare:h5-dist"]);
run(["exec", "taro", "build", "--type", "h5"]);
run(["postbuild:h5"]);
run(["verify:h5-size"]);
run(["verify:production-api"]);
if (runtimeTarget === "telegram-tma") {
  run(["verify:tma-dist"]);
}
