import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve("dist");
const port = Number(process.env.PORT || 10086);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json"
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(root, urlPath === "/" ? "index.html" : urlPath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
        filePath = path.join(root, "index.html");
      }

      fs.readFile(filePath, (readError, data) => {
        if (readError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        res.writeHead(200, {
          "content-type": types[path.extname(filePath)] || "application/octet-stream"
        });
        res.end(data);
      });
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`seeFactory app preview http://127.0.0.1:${port}/`);
  });
