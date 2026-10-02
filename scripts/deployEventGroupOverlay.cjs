// Add the event group chat to an existing Firebase Hosting version without rebuilding the site.
const { createHash } = require("node:crypto");
const { readFile } = require("node:fs/promises");
const { Readable } = require("node:stream");
const { gzipSync } = require("node:zlib");
const path = require("node:path");

const firebaseRoot = "C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib";
const auth = require(`${firebaseRoot}/auth`);
const { requireAuth } = require(`${firebaseRoot}/requireAuth`);
const { Client } = require(`${firebaseRoot}/apiv2`);
const { hostingApiOrigin } = require(`${firebaseRoot}/api`);
const hosting = require(`${firebaseRoot}/hosting/api`);

const site = "prodigitaltv";
const expectedSourceId = "46e710b7064f9e90";
const channel = "groupchat-preview";

async function run() {
  const options = { project: "prodigitaltv-da47b" };
  const account = auth.selectAccount(null, process.cwd());
  if (!account) throw new Error("Firebase-Konto nicht verfügbar.");
  auth.setActiveAccount(options, account);
  await requireAuth(options);

  const live = await hosting.getChannel("-", site, "live");
  const sourceVersion = live?.release?.version?.name;
  if (!sourceVersion?.endsWith(`/versions/${expectedSourceId}`)) {
    throw new Error(`Live-Version hat sich geändert: ${sourceVersion || "unbekannt"}`);
  }

  const response = await fetch("https://prodigitaltv.de/index.html", { cache: "no-store" });
  if (!response.ok) throw new Error(`Startdatei nicht verfügbar: HTTP ${response.status}`);
  let html = await response.text();
  const scriptMarker = '<script type="module" src="/src/main.js?v=1483"></script>';
  if (!html.includes(scriptMarker)) throw new Error("Die veröffentlichte Startdatei entspricht nicht der erwarteten Version.");
  html = html.replace(scriptMarker, `${scriptMarker}\n    <script type="module" src="/src/utils/eventLiveGroupChat.js?v=2"></script>`);
  html = html.replace(/(<link rel="stylesheet" href="\/src\/styles\/main\.css\?v=[^"]+">)/, '$1\n    <link rel="stylesheet" href="/assets/css/event-live-group.css?v=3">');
  if (!html.includes("event-live-group.css?v=3")) throw new Error("Stylesheet konnte nicht ergänzt werden.");

  const root = path.resolve(__dirname, "..");
  const files = new Map([
    ["/index.html", Buffer.from(html, "utf8")],
    ["/src/utils/eventLiveGroupChat.js", await readFile(path.join(root, "src/utils/eventLiveGroupChat.js"))],
    ["/assets/css/event-live-group.css", await readFile(path.join(root, "public/assets/css/event-live-group.css"))]
  ]);
  const compressed = new Map();
  const hashes = {};
  for (const [filePath, bytes] of files) {
    const gzip = gzipSync(bytes, { level: 9 });
    const hash = createHash("sha256").update(gzip).digest("hex");
    hashes[filePath] = hash;
    compressed.set(hash, gzip);
  }

  if (process.argv.includes("--dry-run")) {
    process.stdout.write(JSON.stringify({ sourceVersion, files: Object.keys(hashes), bytes: Object.fromEntries([...files].map(([filePath, data]) => [filePath, data.length])) }, null, 2));
    return;
  }

  if (!await hosting.getChannel("-", site, channel)) await hosting.createChannel("-", site, channel);
  const clone = await hosting.cloneVersion(site, sourceVersion, false);
  const versionName = clone?.name;
  if (!versionName?.includes(`/versions/`)) throw new Error("Hosting-Version konnte nicht geklont werden.");

  const client = new Client({ urlPrefix: hostingApiOrigin(), apiVersion: "v1beta1", auth: true });
  const populated = await client.post(`/${versionName}:populateFiles`, { files: hashes });
  const upload = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) {
    const body = compressed.get(hash);
    if (!body) throw new Error(`Unbekannter Upload-Hash: ${hash}`);
    const result = await upload.request({ method: "POST", path: `/${hash}`, body: Readable.from(body), responseType: "stream", resolveOnHTTPError: true });
    if (result.status !== 200) throw new Error(`Upload fehlgeschlagen: HTTP ${result.status}`);
  }
  const versionId = versionName.split("/").at(-1);
  await hosting.updateVersion(site, versionId, { status: "FINALIZED" });
  const release = await hosting.createRelease(site, channel, versionName);
  process.stdout.write(JSON.stringify({ versionName, previewUrl: (await hosting.getChannel("-", site, channel))?.url, release: release.name }, null, 2));
}

run().catch((error) => { process.stderr.write(error.message); process.exitCode = 1; });
