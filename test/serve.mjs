// 本地预览：node test/serve.mjs → http://localhost:5180/?sync=http://localhost:5181&chunithm=TESTER&maimai=TESTER&ongeki=TESTER
//   5180  面板的静态文件
//   5181  真正的 otoge-sync/worker.js，GitHub 用内存模拟（chuni-b50/test/fake-github.js），预置 TESTER 的模拟记录
//         （VIEWER_ORIGINS 设成 5180 和 5190（SBGA TOOL 的本地预览 songs/scripts/serve.mjs），测的是和线上一样的「只读」跨域访问）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../otoge-sync/worker.js';
import { createFakeGitHub } from '../../chuni-b50/test/fake-github.js';
import * as mock from './mock-data.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
createServer(async (req, res) => {
  const p = normalize(join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html')));
  if (!p.startsWith(normalize(root))) return res.writeHead(403).end();
  try {
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(5180);

const REPO = '131a562/otoge-history', TOKEN = 'tok';
const fake = createFakeGitHub({ repo: REPO, token: TOKEN, fallback: () => { throw new Error('unexpected fetch'); } });
globalThis.fetch = fake.fetch;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
for (const game of ['chunithm', 'maimai', 'ongeki']) {
  fake.files.set(`${game}/TESTER.json`, { content: b64(JSON.stringify(mock[game]())), sha: 'sha-' + game });
}
// chuni-b50 旧版本按全角保存的名字（测试 legacyAccount 的退回读取）
fake.files.set('chunithm/ＺＥＮＫＡＫＵ.json', { content: b64(JSON.stringify(mock.chunithm())), sha: 'sha-zen' });
const env = { GITHUB_REPO: REPO, GITHUB_TOKEN: TOKEN, VIEWER_ORIGINS: 'http://localhost:5180,http://localhost:5190' };

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const init = { method: req.method, headers: req.headers };
  if (chunks.length) init.body = Buffer.concat(chunks);
  const r = await worker.fetch(new Request('http://localhost:5181' + req.url, init), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
}).listen(5181);

console.log('http://localhost:5180/?sync=http://localhost:5181&chunithm=TESTER&maimai=TESTER&ongeki=TESTER');
