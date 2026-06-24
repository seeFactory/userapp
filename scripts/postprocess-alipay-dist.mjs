import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("project.config.json");
const distDir = path.resolve("dist");
const targetPath = path.join(distDir, "project.config.json");

if (!fs.existsSync(distDir)) {
  console.error("Alipay dist directory does not exist. Run the Taro alipay build first.");
  process.exit(1);
}

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, targetPath);
}

console.log(JSON.stringify({
  copiedProjectConfig: fs.existsSync(targetPath),
  target: targetPath
}, null, 2));
