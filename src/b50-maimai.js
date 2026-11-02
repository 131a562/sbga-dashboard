// maimai DX 的 B50 图：用快照（[键, 曲名, 达成率×10000, 单曲 rating, FC/AP, 难度, DX/STD, 曲绘]）+ 成绩扫描里当时的 FS/FDX、DX 分（快照的行里没有）画图。
// 样式在 draw-maimai.js（和 maimai-dx-score 书签共用），这里只把快照的行换成卡片的数据、加载曲绘。
const V = new URL(import.meta.url).search;
const { norm } = await import('./common.js' + V);
const { loadJson, loadImg } = await import('./b50.js' + V);
const { drawImage, C } = await import('./draw-maimai.js' + V);

// 定数表：先读 SBGA TOOL 每天整理的那份（格式和 otoge-db 一样，定数和书签 / SBGA TOOL 统一），读不到时退回 otoge-db
const DB_URL = ['https://131a562.github.io/sbga-tool/data/feed/maimai-music-ex.json', 'https://otoge-db.net/maimai/data/music-ex.json'];
const JACKET_URL = 'https://otoge-db.net/maimai/jacket/';
const DIFFS = { BASIC: ['BAS', 'bas'], ADVANCED: ['ADV', 'adv'], EXPERT: ['EXP', 'exp'], MASTER: ['MAS', 'mas'], 'Re:MASTER': ['ReM', 'remas'] };
const RANKS = [['SSS+', 100.5], ['SSS', 100], ['SS+', 99.5], ['SS', 99], ['S+', 98], ['S', 97],
  ['AAA', 94], ['AA', 90], ['A', 80], ['BBB', 75], ['BB', 70], ['B', 60], ['C', 50], ['D', 0]];
const SYNC_RANK = { '': 0, SYNC: 1, FS: 2, 'FS+': 3, FDX: 4, 'FDX+': 5 };
// 版本序号与 maimai DX NET「バージョン別」的 version 参数一致（0 = maimai）；otoge-db 的 version 是 5 位代码（同书签）
const VERSIONS = [
  [10000, 'maimai'], [11000, 'maimai PLUS'], [12000, 'GreeN'], [13000, 'GreeN PLUS'],
  [14000, 'ORANGE'], [15000, 'ORANGE PLUS'], [16000, 'PiNK'], [17000, 'PiNK PLUS'],
  [18000, 'MURASAKi'], [18500, 'MURASAKi PLUS'], [19000, 'MiLK'], [19500, 'MiLK PLUS'],
  [19900, 'FiNALE'], [20000, 'でらっくす'], [20500, 'でらっくす PLUS'], [21000, 'Splash'],
  [21500, 'Splash PLUS'], [22000, 'UNiVERSE'], [22500, 'UNiVERSE PLUS'], [23000, 'FESTiVAL'],
  [23500, 'FESTiVAL PLUS'], [24000, 'BUDDiES'], [24500, 'BUDDiES PLUS'], [25000, 'PRiSM'],
  [25500, 'PRiSM PLUS'], [26000, 'CiRCLE'], [26500, 'CiRCLE PLUS'], [27000, 'MAGiCAL'],
];
const versionIndexOf = (code) => {
  const c = +code || 0;
  if (!c) return -1;
  const last = VERSIONS[VERSIONS.length - 1][0];
  if (c >= last + 500) return VERSIONS.length - 1 + Math.floor((c - last) / 500);
  let i = VERSIONS.length - 1;
  while (i > 0 && VERSIONS[i][0] > c) i--;
  return i;
};
const versionName = (v) => (v >= 0 ? (VERSIONS[v] || [])[1] || `Ver.${v}` : '');
const dxStarOf = (p, max) => (max > 0 ? [0.85, 0.9, 0.93, 0.95, 0.97].filter((t) => p >= max * t).length : 0);

// obs：观测记录（取 FS/FDX、DX 分）
export async function renderMaimai(game, snap, name, obs, onStatus = () => {}) {
  onStatus('正在读取定数表…');
  let list = [], dbError = '';
  try { list = await loadJson(DB_URL); } catch (e) { dbError = '定数表读取失败，定数显示为「?」'; }
  const byImg = new Map(), byTitle = new Map();
  list.forEach((m) => {
    if (m.catcode === '宴会場' || m.lev_utage) return;
    if (m.image_url) byImg.set(m.image_url, m);
    if (!byTitle.has(norm(m.title))) byTitle.set(norm(m.title), m);
  });
  // 最新版本（标题里写、NEW15 的范围）：同书签，CiRCLE（序号 25）以后新曲枠是当前版本 + 上一个版本
  const latestVersion = Math.max(VERSIONS.length - 1, ...list.map((m) => versionIndexOf(m.version)));
  const newVersions = latestVersion >= 25 ? [latestVersion, latestVersion - 1] : [latestVersion];
  // 快照时刻的 FS/FDX、DX 分：这个谱面在快照之前（含）的最好记录。成绩扫描和プレイ履歴都算：
  // 起点之后新打的歌，プレイ履歴先记下了成绩，之后的扫描没有变化就不再存，只有プレイ履歴里有
  const extra = new Map();
  (obs || []).forEach((o) => {
    if ((o.src !== 'b' && o.src !== 'p') || o.t > snap.t) return;
    const p = extra.get(o.k) || { sy: '', x: 0, xm: 0 };
    if ((SYNC_RANK[o.sy] || 0) > (SYNC_RANK[p.sy] || 0)) p.sy = o.sy;
    if (o.x > p.x) { p.x = o.x; p.xm = o.xm || p.xm; }
    extra.set(o.k, p);
  });
  const toSong = (e) => {
    const [key, title, ach, rating, fc, diff, kind, img] = e;
    const [short, dk] = DIFFS[diff] || ['?', 'mas'];
    const m = (img && byImg.get(img)) || byTitle.get(norm(title));
    const pre = kind === 'DX' ? 'dx_' : '';
    const level = (m && m[pre + 'lev_' + dk]) || '';
    const ci = parseFloat(m && m[pre + 'lev_' + dk + '_i']);
    const est = parseFloat(level) + (level.endsWith('+') ? 0.6 : 0);
    const x = extra.get(key) || { sy: '', x: 0, xm: 0 };
    const a = ach / 10000;
    return {
      title, difficulty: diff, diffShort: short, kind, level, played: true,
      const: ci > 0 ? ci : est > 0 ? est : null, const_unknown: !(ci > 0),
      version: m ? versionName(versionIndexOf(m.version)) : '',
      achievement: a, rank: RANKS.find(([, b]) => a >= b)[0], fc: fc || '', sync: x.sy,
      dx_score: x.x, dx_max: x.xm, dx_star: dxStarOf(x.x, x.xm), rating: rating || 0,
      img: img ? JACKET_URL + img : m && m.image_url ? JACKET_URL + m.image_url : null,
    };
  };
  const old35 = (snap.best || []).map(toSong), new15 = (snap.news || []).map(toSong);
  if (!old35.length && !new15.length) throw new Error('这次快照里没有曲目列表（书签旧版本的快照）');

  onStatus('正在加载曲绘…');
  const all = [...old35, ...new15];
  const jackets = new Map();
  const queue = all.slice();
  let done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const s = queue.shift();
      jackets.set(s, await loadImg(s.img));
      onStatus(`正在加载曲绘… ${++done}/${all.length}`);
    }
  }));

  const sumR = (arr) => arr.reduce((a, s) => a + s.rating, 0);
  const parts = snap.parts || [sumR(new15), sumR(old35)];
  const calc = snap.c != null ? snap.c : parts[0] + parts[1];
  const diffR = snap.r - calc;
  const maxMin = (arr) => {
    const r = arr.map((s) => s.rating);
    return r.length ? ` · 最高 ${Math.max(...r)} · 最低 ${Math.min(...r)}` : '';
  };
  // 头部同 CHUNITHM：玩家名 + 大号 DX RATING，右边是两个枠的合计；曲数、最高 / 最低写在各区块的标题后面
  // 旧曲（BEST35）在上，新曲（NEW15）在下；角标是所在枠的序号（B1〜B35 / N1〜N15）
  const cv = drawImage({
    head: `maimai でらっくす ${versionName(latestVersion)}  ·  DX RATING  BEST 50`,
    profile: {
      name: String(name || ''), rating: `${snap.r || calc}`, ratingLabel: 'DX RATING',
      stats: [['BEST35', `${parts[1]}`], ['NEW15', `${parts[0]}`, C.plat]],
      note: `游戏内 Rating（maimai DX NET）· 按定数计算 ${calc}${diffR === 0 ? '（一致）' : `（差 ${diffR > 0 ? '+' : ''}${diffR}）`} · ${snap.t} 运行查分书签时的 B50`,
    },
    sections: [
      { name: 'BEST35', note: `${old35.length}曲 · 合计 ${parts[1]}${maxMin(old35)}`, rows: old35, label: (s, i) => 'B' + (i + 1) },
      { name: 'NEW15', note: `${newVersions.map(versionName).join(' / ')} · ${new15.length}曲 · 合计 ${parts[0]}${maxMin(new15)}`, rows: new15, label: (s, i) => 'N' + (i + 1) },
    ],
    footer: `${snap.t} 运行查分书签时的数据  ·  SBGA DASHBOARD  ·  成绩：maimai DX NET  ·  定数・曲绘：otoge-db（定数为 ".?" 的还未公开）  ·  AP/AP+ 单曲 rating +1` +
      (dbError ? '  ·  ' + dbError : ''),
    jackets,
  });

  onStatus('正在生成图片…');
  const blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('图片生成失败'))), 'image/png'));
  cv.width = cv.height = 0;
  return { blob, url: URL.createObjectURL(blob), missing: all.filter((s) => !jackets.get(s)).length, dbError };
}
