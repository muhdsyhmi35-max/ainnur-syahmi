const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8766);
const host = "127.0.0.1";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".md": "text/markdown",
  ".mp3": "audio/mpeg"
};

function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 2_000_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);

  if (req.method === "POST" && url === "/__save-content") {
    try {
      const body = await readBody(req);
      let text = body;
      if (body.trim().startsWith("{")) {
        text = "window.WEDDING = " + JSON.stringify(JSON.parse(body), null, 2) + ";\n";
      }
      if (!text.includes("window.WEDDING")) {
        send(res, 400, "invalid content.js payload");
        return;
      }
      fs.writeFileSync(path.join(root, "content.js"), text, "utf8");
      send(res, 200, JSON.stringify({ ok: true, bytes: Buffer.byteLength(text) }), "application/json");
    } catch (error) {
      send(res, 500, String(error && error.message || error));
    }
    return;
  }

  let u = url;
  if (u.endsWith("/")) u += "index.html";
  const fp = path.normalize(path.join(root, u.replace(/^\//, "")));
  if (!fp.startsWith(root)) {
    send(res, 403, "forbidden");
    return;
  }
  fs.readFile(fp, (err, data) => {
    if (err) {
      send(res, 404, "missing");
      return;
    }
    send(res, 200, data, types[path.extname(fp)] || "application/octet-stream");
  });
});

server.listen(port, host, () => {
  console.log("listening on " + port + " (Simpan can write content.js via POST /__save-content)");
});
