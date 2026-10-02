// Recover publicly hosted frontend files with a separate backup of every overwritten file.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const firebaseRoot = 'C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const expectedVersion = '805e67db989ad593';
const recovery = path.join(root, 'backups', 'published-recovery-' + expectedVersion);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function optionalRead(file) {
  try { return await fs.readFile(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function inside(base, relative) {
  const target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep)) throw new Error('Unsafe path: ' + relative);
  return target;
}
function localPath(remote) {
  return remote.startsWith('/src/') ? remote.slice(1) : 'public' + remote;
}
async function main() {
  if (process.argv.includes('--apply')) {
    const report = JSON.parse(await fs.readFile(path.join(recovery, 'report.json'), 'utf8'));
    // Verify the whole plan before writing any project file.
    for (const item of report.changed) {
      const current = await optionalRead(inside(root, item.local));
      if ((current ? digest(current) : null) !== item.beforeHash) throw new Error('Local file changed since inspection: ' + item.local);
      const staged = await fs.readFile(inside(path.join(recovery, 'published'), item.remote.slice(1)));
      if (digest(staged) !== item.afterHash) throw new Error('Staged file changed: ' + item.remote);
    }
    for (const item of report.changed) {
      const target = inside(root, item.local);
      if (item.beforeHash) {
        const backup = inside(path.join(recovery, 'before'), item.local);
        await fs.mkdir(path.dirname(backup), { recursive: true });
        await fs.copyFile(target, backup, 1);
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(inside(path.join(recovery, 'published'), item.remote.slice(1)), target);
    }
    console.log(JSON.stringify({ restored: report.changed.length, backup: path.join(recovery, 'before') }));
    return;
  }
  const auth = require(firebaseRoot + '/auth');
  const { requireAuth } = require(firebaseRoot + '/requireAuth');
  const { Client } = require(firebaseRoot + '/apiv2');
  const { hostingApiOrigin } = require(firebaseRoot + '/api');
  const hosting = require(firebaseRoot + '/hosting/api');
  const options = { project: 'prodigitaltv-da47b' };
  const account = auth.selectAccount(null, root);
  if (!account) throw new Error('No Firebase account');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const live = await hosting.getChannel('-', 'prodigitaltv', 'live');
  const version = live.release.version.name;
  if (!version.endsWith('/versions/' + expectedVersion)) throw new Error('Live version changed: ' + version);
  const client = new Client({ urlPrefix: hostingApiOrigin(), apiVersion: 'v1beta1', auth: true });
  const files = [];
  let pageToken;
  do {
    const response = await client.get('/' + version + '/files', { queryParams: { pageSize: 1000, ...(pageToken ? { pageToken } : {}) } });
    files.push(...(response.body.files || []));
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  await fs.mkdir(recovery, { recursive: true });
  const changed = [];
  const published = files.filter(f => !f.path.startsWith('/__/'));
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < published.length) {
      const file = published[cursor++];
      const remote = file.path;
      const response = await fetch('https://prodigitaltv.de' + remote, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(remote + ': HTTP ' + response.status);
      if (!remote.endsWith('.html') && response.headers.get('content-type')?.includes('text/html')) throw new Error('HTML fallback for ' + remote);
      const bytes = Buffer.from(await response.arrayBuffer());
      const staged = inside(path.join(recovery, 'published'), remote.slice(1));
      await fs.mkdir(path.dirname(staged), { recursive: true });
      await fs.writeFile(staged, bytes);
      const local = localPath(remote);
      const before = await optionalRead(inside(root, local));
      if (!before || !before.equals(bytes)) changed.push({ remote, local, beforeHash: before ? digest(before) : null, afterHash: digest(bytes), bytes: bytes.length });
    }
  }));
  const latest = await hosting.getChannel('-', 'prodigitaltv', 'live');
  if (latest.release.version.name !== version) throw new Error('Live version changed during download');
  changed.sort((a, b) => a.local.localeCompare(b.local));
  const report = { version, downloadedAt: new Date().toISOString(), totalFiles: published.length, changed };
  await fs.writeFile(path.join(recovery, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ version, downloaded: published.length, changed: changed.map(f => ({ file: f.local, new: f.beforeHash === null, bytes: f.bytes })), recovery }, null, 2));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
