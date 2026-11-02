// CHUNITHM 的 B50 图：用快照（书签运行时的 BEST 30 / NEW 20：[曲目id:难度, 曲名, 分数, 单曲 Rating×100, 标记]）画图。
// 样式在 draw-chunithm.js（和 chuni-b50 书签共用），这里只把快照的行换成卡片的数据、加载曲绘。
const V = new URL(import.meta.url).search;
const { loadJson, loadImg } = await import('./b50.js' + V);
const { DIFFS, drawB50 } = await import('./draw-chunithm.js' + V);

// 定数表：先读 SBGA TOOL 每天整理的那份（格式和 otoge-db 一样，定数和书签 / SBGA TOOL 统一），读不到时退回 otoge-db
const DB_URL = ['https://131a562.github.io/sbga-tool/data/feed/chunithm-music-ex.json', 'https://otoge-db.net/chunithm/data/music-ex.json'];
const JACKET_URL = 'https://otoge-db.net/chunithm/jacket/';

export async function renderChunithm(game, snap, name, onStatus = () => {}) {
  onStatus('正在读取定数表…');
  let list = [], dbError = '';
  try { list = await loadJson(DB_URL); } catch (e) { dbError = '  ·  定数表读取失败'; }
  const byId = new Map(list.map((m) => [String(m.id), m]));
  const byTitle = new Map(list.map((m) => [m.title, m]));
  // 快照的一行 → 卡片的数据。定数未公开时按等级估算（14+ → 14.5，图上加 *），同书签的 enrich
  const toSong = (e) => {
    const [id, d] = String(e[0]).split(':');
    const diff = +d;
    const key = (DIFFS[diff] || DIFFS[3]).key;
    const m = byId.get(id) || byTitle.get(e[1]);
    let c = m ? parseFloat(m['lev_' + key + '_i']) : NaN, estimated = false;
    if (!(c > 0) && m && m['lev_' + key]) { const lv = m['lev_' + key]; c = parseFloat(lv) + (lv.endsWith('+') ? 0.5 : 0); estimated = true; }
    return {
      title: e[1], diff, score: e[2], lamp: e[4] || '', rating: e[3] != null ? e[3] / 100 : 0,
      constant: c > 0 ? c : 0, estimated, jacket: m && m.image ? JACKET_URL + m.image : null,
    };
  };
  const best = (snap.best || []).map(toSong), news = (snap.news || []).map(toSong);
  if (!best.length && !news.length) throw new Error('这次快照里没有曲目列表（书签旧版本的快照）');

  onStatus('正在加载曲绘…');
  const all = [...best, ...news];
  const queue = all.slice();
  let done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const s = queue.shift();
      s.img = await loadImg(s.jacket);
      onStatus(`正在加载曲绘… ${++done}/${all.length}`);
    }
  }));

  // 玩家名：书签用 CHUNITHM-NET 上的原样（全角）；页脚：书签写生成日期，这里写快照的时间（可能是以前的快照）
  const cv = drawB50({
    name, rating: snap.r ? Number(snap.r).toFixed(2) : '', best, news,
    footer: snap.t + ' 运行查分书签时的 B50  ·  SBGA DASHBOARD  ·  data: CHUNITHM-NET / otoge-db  ·  定数为 ".?" 的还未公开（按等级估算）' + dbError,
  });

  onStatus('正在生成图片…');
  const blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('图片生成失败'))), 'image/png'));
  cv.width = cv.height = 0;
  return { blob, url: URL.createObjectURL(blob), missing: all.filter((s) => !s.img).length, dbError: dbError ? '定数表读取失败，定数显示为「?」' : '' };
}
