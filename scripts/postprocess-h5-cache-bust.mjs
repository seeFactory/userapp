import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distIndex = resolve("dist", "index.html");
const distJs = resolve("dist", "js");
const version = process.env.SEEFACTORY_BUILD_VERSION || String(Date.now());

function withVersion(url) {
  if (!url || /^(?:https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.set("v", version);
  return `${path}?${params.toString()}`;
}

let html = readFileSync(distIndex, "utf8");

html = html.replace(/\b(src|href)="([^"]+)"/g, (match, attr, url) => {
  if (!/\.(?:js|css)(?:$|\?)/.test(url)) return match;
  return `${attr}="${withVersion(url)}"`;
});

writeFileSync(distIndex, html);

for (const file of readdirSync(distJs)) {
  if (!file.endsWith(".js")) continue;
  const path = resolve(distJs, file);
  const js = readFileSync(path, "utf8");
  const next = js.replace(
    /__webpack_require__\.u=function\(([^)]*)\)\{return"chunk\/"\+\1\+"\.js"\}/g,
    `__webpack_require__.u=function($1){return"chunk/"+$1+".js?v=${version}"}`
  );
  if (next !== js) {
    writeFileSync(path, next);
  }
}

console.log(JSON.stringify({
  index: distIndex,
  version
}, null, 2));
