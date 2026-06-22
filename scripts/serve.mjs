import { appendFileSync, createReadStream, statSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const requestedRoot = process.argv[2] || "dist";
const root = resolve(import.meta.dirname, "..", requestedRoot);
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const crashLog = resolve(import.meta.dirname, "..", "preview-crash.log");

function logCrash(error) {
  appendFileSync(crashLog, `[${new Date().toISOString()}] ${error?.stack || error}\n`);
}

process.on("uncaughtException", logCrash);
process.on("unhandledRejection", logCrash);

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    if (url.pathname === "/__media_proxy") {
      const target = url.searchParams.get("url") || "";
      if (!/^https?:\/\//i.test(target)) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Invalid proxy target");
        return;
      }
      fetch(target)
        .then(async (remote) => {
          if (!remote.ok) {
            response.writeHead(remote.status || 502, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
            response.end(`Proxy fetch failed: ${remote.status}`);
            return;
          }
          response.writeHead(200, {
            "Content-Type": remote.headers.get("content-type") || "application/octet-stream",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*"
          });
          const buffer = Buffer.from(await remote.arrayBuffer());
          response.end(buffer);
        })
        .catch((error) => {
          logCrash(error);
          response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
          response.end("Proxy fetch failed");
        });
      return;
    }
    const cleanUrl = decodeURIComponent(url.pathname || "/");
    let file = join(root, cleanUrl === "/" ? "index.html" : cleanUrl);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
    response.setHeader("Content-Type", `${types[extname(file)] || "application/octet-stream"}; charset=utf-8`);
    const stream = createReadStream(file);
    stream.on("error", (error) => {
      logCrash(error);
      if (!response.headersSent) response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    });
    stream.pipe(response);
  } catch (error) {
    logCrash(error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Server error");
  }
});

server.listen(port, () => console.log(`PROdigitalTV preview: http://localhost:${port}`));
