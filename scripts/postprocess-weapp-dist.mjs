import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("project.private.config.json");
const distDir = path.resolve("dist");
const targetPath = path.join(distDir, "project.private.config.json");

if (!fs.existsSync(distDir)) {
  console.error("WeApp dist directory does not exist. Run the Taro weapp build first.");
  process.exit(1);
}

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, targetPath);
}

console.log(JSON.stringify({
  copiedPrivateConfig: fs.existsSync(targetPath),
  target: targetPath
}, null, 2));
