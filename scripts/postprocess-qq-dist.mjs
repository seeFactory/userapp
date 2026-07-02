import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("project.config.json");
const distDir = path.resolve("dist");
const targetPath = path.join(distDir, "project.config.json");
const appQssPath = path.join(distDir, "app.qss");

if (!fs.existsSync(distDir)) {
  console.error("QQ dist directory does not exist. Run the Taro QQ build first.");
  process.exit(1);
}

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, targetPath);
}

if (fs.existsSync(appQssPath)) {
  const original = fs.readFileSync(appQssPath, "utf8");
  const qss = original
    .replace(/\*,\*::after,\*::before,/g, "")
    .replace(/(?:^|})[^{}]*>\s*\*[^{}]*\{[^{}]*\}/g, (match) => match.startsWith("}") ? "}" : "")
    .replace(/100vw/g, "100%")
    .replace(/translateX\(-181px\)/g, "translateX(0)")
    .replace(/translateX\(-348\.07692rpx\)/g, "translateX(0)")
    .replace(/\.page-content\{(?![^}]*box-sizing:border-box)/g, ".page-content{box-sizing:border-box;");
  fs.writeFileSync(appQssPath, qss);
}

console.log(JSON.stringify({
  copiedProjectConfig: fs.existsSync(targetPath),
  cleanedQssUniversalSelectors: fs.existsSync(appQssPath),
  target: targetPath
}, null, 2));
