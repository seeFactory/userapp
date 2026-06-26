import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("project.config.json");
const miniProjectSourcePath = path.resolve("mini.project.json");
const distDir = path.resolve("dist");
const targetPath = path.join(distDir, "project.config.json");
const miniProjectTargetPath = path.join(distDir, "mini.project.json");

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

console.log(JSON.stringify({
  copiedProjectConfig: fs.existsSync(targetPath),
  copiedMiniProjectConfig: fs.existsSync(miniProjectTargetPath),
  target: targetPath,
  miniProjectTarget: miniProjectTargetPath
}, null, 2));
