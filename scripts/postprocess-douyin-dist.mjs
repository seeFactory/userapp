import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("project.config.json");
const distDir = path.resolve("dist");
const targetPath = path.join(distDir, "project.config.json");
const appTtssPath = path.join(distDir, "app.ttss");

if (!fs.existsSync(distDir)) {
  console.error("Douyin dist directory does not exist. Run the Taro tt build first.");
  process.exit(1);
}

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, targetPath);
}

if (fs.existsSync(appTtssPath)) {
  const original = fs.readFileSync(appTtssPath, "utf8");
  const ttss = original
    .replace(/\*,\*::after,\*::before,/g, "")
    .replace(/(?:^|})[^{}]*>\s*\*[^{}]*\{[^{}]*\}/g, (match) => match.startsWith("}") ? "}" : "")
    .replace(/100vw/g, "100%")
    .replace(/translateX\(-181px\)/g, "translateX(0)")
    .replace(/translateX\(-348\.07692rpx\)/g, "translateX(0)")
    .replace(/\.page-content\{(?![^}]*box-sizing:border-box)/g, ".page-content{box-sizing:border-box;");
  fs.writeFileSync(appTtssPath, ttss);
}

console.log(JSON.stringify({
  copiedProjectConfig: fs.existsSync(targetPath),
  cleanedTtssUniversalSelectors: fs.existsSync(appTtssPath),
  target: targetPath
}, null, 2));
