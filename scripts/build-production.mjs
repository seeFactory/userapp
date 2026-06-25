import { spawnSync } from "node:child_process";

const runtimeTarget = process.argv[2] || "h5";
const allowedTargets = new Set(["h5", "telegram-tma", "android-apk"]);

if (!allowedTargets.has(runtimeTarget)) {
  console.error(`Unsupported production runtime target: ${runtimeTarget}`);
  process.exit(1);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const env = {
  ...process.env,
  SEEFACTORY_API_BASE: process.env.SEEFACTORY_API_BASE || "https://api.seefactory.xyz/api/v1",
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

run(["prepare:h5-dist"]);
run(["exec", "taro", "build", "--type", "h5"]);
run(["postbuild:h5"]);
run(["verify:h5-size"]);
run(["verify:production-api"]);
if (runtimeTarget === "telegram-tma") {
  run(["verify:tma-dist"]);
}
