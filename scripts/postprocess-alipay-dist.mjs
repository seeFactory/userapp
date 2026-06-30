import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("project.config.json");
const miniProjectSourcePath = path.resolve("mini.project.json");
const distDir = path.resolve("dist");
const targetPath = path.join(distDir, "project.config.json");
const miniProjectTargetPath = path.join(distDir, "mini.project.json");
const appAcssPath = path.join(distDir, "app.acss");

if (!fs.existsSync(distDir)) {
  console.error("Alipay dist directory does not exist. Run the Taro alipay build first.");
  process.exit(1);
}

if (fs.existsSync(sourcePath)) {
  const projectConfig = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  fs.writeFileSync(
    targetPath,
    `${JSON.stringify({ ...projectConfig, miniprogramRoot: "./" }, null, 2)}\n`
  );
}

if (fs.existsSync(miniProjectSourcePath)) {
  fs.copyFileSync(miniProjectSourcePath, miniProjectTargetPath);
}

if (fs.existsSync(appAcssPath)) {
  const original = fs.readFileSync(appAcssPath, "utf8");
  const acss = original
    .replace(/\*,\*::after,\*::before,/g, "")
    .replace(/(?:^|})[^{}]*>\s*\*[^{}]*\{[^{}]*\}/g, (match) => match.startsWith("}") ? "}" : "")
    .replace(/100vw/g, "100%")
    .replace(/translateX\(-181px\)/g, "translateX(0)")
    .replace(/translateX\(-348\.07692rpx\)/g, "translateX(0)")
    .replace(/\.page-content\{(?![^}]*box-sizing:border-box)/g, ".page-content{box-sizing:border-box;");
  fs.writeFileSync(appAcssPath, acss);
}

console.log(JSON.stringify({
  copiedProjectConfig: fs.existsSync(targetPath),
  copiedMiniProjectConfig: fs.existsSync(miniProjectTargetPath),
  cleanedAcssUniversalSelectors: fs.existsSync(appAcssPath),
  target: targetPath,
  miniProjectTarget: miniProjectTargetPath
}, null, 2));
