import { createReadStream, statSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const requestedRoot = process.argv[2] || "dist";
const root = resolve(import.meta.dirname, "..", requestedRoot);
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

const server = createServer((request, response) => {
  const cleanUrl = decodeURIComponent((request.url || "/").split("?")[0]);
  let file = join(root, cleanUrl === "/" ? "index.html" : cleanUrl);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  response.setHeader("Content-Type", `${types[extname(file)] || "application/octet-stream"}; charset=utf-8`);
  createReadStream(file).pipe(response);
});

server.listen(port, () => console.log(`PROdigitalTV preview: http://localhost:${port}`));
