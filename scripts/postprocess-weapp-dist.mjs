import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("project.private.config.json");
const distDir = path.resolve("dist");
const targetPath = path.join(distDir, "project.private.config.json");
const appWxssPath = path.join(distDir, "app.wxss");

if (!fs.existsSync(distDir)) {
  console.error("WeApp dist directory does not exist. Run the Taro weapp build first.");
  process.exit(1);
}

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, targetPath);
}

if (fs.existsSync(appWxssPath)) {
  const original = fs.readFileSync(appWxssPath, "utf8");
  const wxss = original
    .replace(/\*,\*::after,\*::before,/g, "")
    .replace(/(?:^|})[^{}]*>\s*\*[^{}]*\{[^{}]*\}/g, (match) => match.startsWith("}") ? "}" : "")
    .replace(/100vw/g, "100%")
    .replace(/translateX\(-181px\)/g, "translateX(0)")
    .replace(/translateX\(-348\.07692rpx\)/g, "translateX(0)")
    .replace(/\.page-content\{(?![^}]*box-sizing:border-box)/g, ".page-content{box-sizing:border-box;");
  fs.writeFileSync(appWxssPath, wxss);
}

console.log(JSON.stringify({
  copiedPrivateConfig: fs.existsSync(targetPath),
  cleanedWxssUniversalSelectors: fs.existsSync(appWxssPath),
  target: targetPath
}, null, 2));
