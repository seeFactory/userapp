import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");
const task = process.argv[2] || "assembleDebug";
const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

const result = spawnSync(gradle, [task], {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.status !== 0) {
  if (result.error) console.error(result.error);
  process.exit(result.status || 1);
}
