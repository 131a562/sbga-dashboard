// オンゲキ的 B50 图：用快照（书签运行时的 BEST50 / NEW10 / P-SCORE50）+ 成绩扫描里当时的プラチナスコア（快照的行里没有）画图。
// 样式在 draw-ongeki.js（和 ongeki-score-export 书签共用），这里只把快照的行换成卡片的数据、加载曲绘。
const V = new URL(import.meta.url).search;
const { norm } = await import('./common.js' + V);
const { loadJson, loadImg } = await import('./b50.js' + V);
const { drawImage, fmtPs, C } = await import('./draw-ongeki.js' + V);

// 定数表：先读 SBGA TOOL 每天整理的那份（格式和 reiwa.f5.si 一样，定数和书签 / SBGA TOOL 统一），读不到时退回 reiwa.f5.si
const DB_URL = ['https://131a562.github.io/sbga-tool/data/feed/ongeki_record.json', 'https://reiwa.f5.si/ongeki_record.json'];
const JACKET_URL = 'https://reiwa.f5.si/jackets/ongeki/';
const DIFF_DB = { EXPERT: 'EXP', MASTER: 'MAS', LUNATIC: 'LUN', ADVANCED: 'ADV', BASIC: 'BAS' };
const RANKS = [['SSS+', 1007500], ['SSS', 1000000], ['SS', 990000], ['S', 970000], ['AAA', 940000], ['AA', 900000], ['A', 850000],
  ['BBB', 800000], ['BB', 750000], ['B', 700000], ['C', 500000], ['D', 0]];
const sum = (a) => a.reduce((x, y) => x + y, 0);

// snap：快照；obs：这个玩家的观测记录（取プラチナスコア）；返回 { blob, url, missing, dbError }
export async function renderOngeki(game, snap, name, obs, onStatus = () => {}) {
  onStatus('正在读取定数表…');
  let list = [], dbError = '';
  try { list = await loadJson(DB_URL); } catch (e) { dbError = '定数表读取失败，定数显示为「?」'; }
  const byKey = new Map();
  list.forEach((m) => { const k = norm(m.title) + '|' + m.diff; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(m); });
  // 最新版本（NEW10 的说明里写）：定数表里发布最晚的谱面所在的版本（同书签）
  const latestVersion = list.reduce((a, m) => (m.release_unix > a.t && m.version ? { t: m.release_unix, v: m.version } : a), { t: 0, v: '' }).v;
  // 谱面键「曲名|难度」，同名曲是「曲名|难度|艺术家」
  const findDb = (key) => {
    const [title, diff, artist] = String(key).split('|');
    let c = byKey.get(norm(title) + '|' + (DIFF_DB[diff] || diff)) || [];
    if (c.length > 1 && artist && artist !== '?') c = c.filter((m) => norm(m.artist) === norm(artist)).concat(c);
    return { m: c[0], diff, artist: artist && artist !== '?' ? artist : '' };
  };
  // 快照时刻的プラチナスコア：成绩扫描里这个谱面在快照之前（含）最高的一次。☆ 按书签的规则由比例算（94〜98%）
  const plat = new Map();
  (obs || []).forEach((o) => {
    if (o.src !== 'b' || !(o.pm > 0) || o.t > snap.t) return;
    const p = plat.get(o.k);
    if (!p || o.ps > p.ps) plat.set(o.k, { ps: o.ps, pm: o.pm });
  });
  const starOf = (p) => (p && p.pm > 0 ? [94, 95, 96, 97, 98].filter((t) => p.ps * 100 >= p.pm * t).length : 0);
  const psRows = snap.ps || [];
  const pRankOf = new Map(psRows.map((e, i) => [e[0], 'P' + (i + 1)]));
  const base = (key, title) => {
    const { m, diff, artist } = findDb(key);
    const p = plat.get(key);
    const c = m && m.const > 0 ? m.const : null;
    return {
      title: title + (artist ? '（' + artist + '）' : ''), difficulty: diff, const: c, const_unknown: !m ? true : !!m.is_unknown,
      // 定数表的 level 是数字（13.5 = 13+）；卡片按「13+」的写法判断要不要画小加号
      level: m ? Math.floor(m.level) + (m.level % 1 >= 0.5 ? '+' : '') : '', img: m && m.img ? JACKET_URL + m.img + '.webp' : null,
      platinum_score: p ? p.ps : 0, platinum_max: p ? p.pm : 0, platinum_star: starOf(p),
    };
  };
  const card = (e) => {
    const s = base(e[0], e[1]);
    const psUnits = s.const ? Math.min(s.platinum_star, 5) * Math.round(s.const * 10) ** 2 : 0;
    return {
      ...s, technical_score: e[2], rank: RANKS.find(([, b]) => e[2] >= b)[0], lamp: e[4] || '', full_bell: !!e[5],
      rating: e[3] != null ? e[3] / 1000 : 0, ps_rating: psUnits / 1e5, frame: pRankOf.get(e[0]) || '',
    };
  };
  const best = (snap.best || []).map(card), news = (snap.news || []).map(card);
  // P-SCORE50 的行：[键, 曲名, ☆, P-rate×100000]，☆ 和 P-rate 以快照为准
  const side = psRows.map((e) => ({ ...base(e[0], e[1]), platinum_star: e[2], ps_rating: e[3] / 1e5 }));
  if (!best.length && !news.length) throw new Error('这次快照里没有曲目列表（书签旧版本的快照）');

  onStatus('正在加载曲绘…');
  const all = [...best, ...news, ...side];
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

  // 头部同 CHUNITHM：玩家名 + 大号 RATING，右边是三个枠对总 Rating 的贡献（快照的 parts，合计 ÷ 50 截断）；
  // 曲数・平均・合计写在各区块的标题后面
  const parts = snap.parts || [0, 0, 0];
  const avg = (rows) => (rows.length ? sum(rows.map((s) => s.rating)) / rows.length : 0);
  const total = (rows) => sum(rows.map((s) => s.rating));
  const psTotal = sum(side.map((s) => s.ps_rating));
  const part = (i) => `+${(parts[i] / 1000).toFixed(3)}`;
  const cv = drawImage({
    profile: {
      kicker: 'O.N.G.E.K.I. Re:Fresh  ·  RATING', name: String(name || '').normalize('NFKC'), rating: game.fmtRating(snap.r),
      stats: [['BEST50', part(1)], ['NEW10', part(0)], ['P-SCORE50', part(2), C.plat]],
      note: `${snap.t} 运行查分书签时的 B50 · 新曲枠 + ベスト枠 + P-SCORE枠（各枠合计 ÷ 50 后截断）`,
    },
    sections: [
      { name: 'BEST50', note: `${best.length}曲 · 平均 ${avg(best).toFixed(3)} · 合计 ${total(best).toFixed(3)} · 最低 ${best.length ? best[best.length - 1].rating.toFixed(3) : '—'}`, rows: best, label: (s, i) => 'B' + (i + 1) },
      { name: 'NEW10', note: `${latestVersion ? latestVersion + ' · ' : ''}${news.length}曲 · 平均 ${avg(news).toFixed(3)} · 合计 ${total(news).toFixed(3)}`, rows: news, label: (s, i) => 'N' + (i + 1) },
    ],
    side: { name: 'P-SCORE50', note: `${side.length}曲 · 合计 ${fmtPs(psTotal)} · 最低 ${side.length ? fmtPs(side[side.length - 1].ps_rating) : '—'}`, rows: side, label: (s, i) => 'P' + (i + 1) },
    footer: `${snap.t} 运行查分书签时的数据  ·  SBGA DASHBOARD  ·  估算值（仅 EXP/MAS/LUN），与游戏内会有少许出入  ·  定数・曲绘：reiwa.f5.si（定数后带 "?" 为未确定）` +
      (dbError ? '  ·  ' + dbError : ''),
    jackets,
  });

  onStatus('正在生成图片…');
  const blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('图片生成失败'))), 'image/png'));
  cv.width = cv.height = 0;
  return { blob, url: URL.createObjectURL(blob), missing: all.filter((s) => !jackets.get(s)).length, dbError };
}
