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
    const cleanUrl = decodeURIComponent((request.url || "/").split("?")[0]);
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
