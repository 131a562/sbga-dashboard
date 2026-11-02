// 推分区块用：每次推分让账号 Rating 变了多少（和三个书签历史页的 accountImpact 同一个做法）。
// 两个快照之间的推分按游玩记录的时间顺序放进 B50：以前一个快照（当时完整的 B50）为起点，放入推分后的单曲 Rating，
// 超出枠的数量时挤掉当时最低的一首。账号 Rating 的起点对齐前一个快照的游戏 Rating，所以截断（中二 0.01、音击 0.001）
// 也和游戏一致：没跨过一档的推分是 +0。到后一个快照还差多少（没记录到的游玩、定数表变了等）书签写在最后一条上，面板不显示。
// 后一个快照里真实的 B50 是答案：这首歌在里面 → 一定算进去；不在里面（原来也不在）→ 没进，账号 Rating 不变。
// 谱面键用 games.js 的 keyOf（和推分列表的 improved() 一致），快照的行也换成同样的键。
// 定数表和 B50 图用的是同一份（SBGA TOOL 每天整理的，读不到退回原来的来源），打开面板时才下载
const V = new URL(import.meta.url).search;
const [{ norm, byTime, timeMs }, { loadJson }] = await Promise.all([import('./common.js' + V), import('./b50.js' + V)]);

const sumOf = (m) => (m ? [...m.values()].reduce((a, v) => a + v, 0) : 0);

// ---- CHUNITHM ----
// 单曲 Rating（VERSE 以降的计算式，同 chuni-b50 的 songRating），返回 0.01 单位的整数
const CHUNI_DIFF = ['bas', 'adv', 'exp', 'mas', 'ult'];
function chuniCents(s, c) {
  if (!c) return 0;
  let r;
  if (s >= 1009000) r = c + 2.15;
  else if (s >= 1007500) r = c + 2.0 + (s - 1007500) / 100 * 0.01;
  else if (s >= 1005000) r = c + 1.5 + (s - 1005000) / 50 * 0.01;
  else if (s >= 1000000) r = c + 1.0 + (s - 1000000) / 100 * 0.01;
  else if (s >= 975000) r = c + (s - 975000) / 250 * 0.01;
  else if (s >= 900000) r = c - 5 + (s - 900000) / 15000;
  else if (s >= 800000) r = (c - 5) / 2 + (s - 800000) * ((c - 5) / 2) / 100000;
  else if (s >= 500000) r = ((c - 5) / 2) * (s - 500000) / 300000;
  else r = 0;
  return Math.max(0, Math.floor(r * 100 + 1e-6));
}

const chunithm = {
  urls: ['https://131a562.github.io/sbga-tool/data/feed/chunithm-music-ex.json', 'https://otoge-db.net/chunithm/data/music-ex.json'],
  frames: { best: 30, news: 20 }, label: { best: 'BEST30', news: 'NEW20' }, digits: 2,
  setup(list, snaps) {
    const byId = new Map(list.map((m) => [String(m.id), m]));
    const byTitle = new Map(list.map((m) => [norm(m.title), m]));
    // 新曲枠的版本：最后一个快照的 NEW 20 里最多的版本（同书签）
    const count = {};
    const last = snaps[snaps.length - 1];
    (last ? last.news : []).forEach((e) => { const m = byId.get(String(e[0]).split(':')[0]); if (m && m.version) count[m.version] = (count[m.version] || 0) + 1; });
    const newVer = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    return {
      info(o) {
        const id = String(o.k || '').startsWith('n:') ? '' : String(o.k || '').split(':')[0];
        const m = byId.get(id) || byTitle.get(norm(o.n));
        const key = CHUNI_DIFF[o.d] || 'mas';
        let c = m ? parseFloat(m['lev_' + key + '_i']) : NaN;
        // 定数未公开时按等级估算（14+ → 14.5），同书签
        if (!(c > 0) && m && m['lev_' + key]) { const lv = m['lev_' + key]; c = parseFloat(lv) + (lv.endsWith('+') ? 0.5 : 0); }
        return { c: c > 0 ? c : 0, isNew: !!(m && newVer && m.version === newVer) };
      },
    };
  },
  rowObs: (e) => ({ k: e[0], n: e[1], d: Number(String(e[0]).slice(String(e[0]).lastIndexOf(':') + 1)), s: e[2] }),
  rowValue: (frame, e, inf) => chuniCents(e[2], inf.c),
  blank: () => ({ s: 0 }),
  absorb: (st, o) => (o.s > st.s ? { next: { s: o.s }, main: true } : { next: st }),
  value: (frame, inf, st) => chuniCents(st.s, inf.c),
  // 账号 Rating = 50 首之和 ÷ 50 截断到 0.01。游戏只显示到 0.01，后面的余数不知道：
  // 连续的快照能取到同一个偏差就合在一起，取让「floor((合计 − 偏差) / 50) = 游戏 Rating」都成立、最接近 0 的偏差（同书签）
  calibrate(snaps, fromSnap) {
    const runOf = [], runRange = [];
    snaps.forEach((s, idx) => {
      const r = Math.round((s.r || 0) * 100);
      const T = sumOf(fromSnap(s).best) + sumOf(fromSnap(s).news);
      const rng = r ? [T - (r * 50 + 49), T - r * 50] : null;
      const run = runRange.length - 1;
      const cur = run >= 0 ? runRange[run] : null;
      if (!rng) { runOf[idx] = Math.max(run, 0); if (run < 0) runRange.push([-Infinity, Infinity]); return; }
      if (cur && Math.max(cur[0], rng[0]) <= Math.min(cur[1], rng[1])) {
        runRange[run] = [Math.max(cur[0], rng[0]), Math.min(cur[1], rng[1])];
        runOf[idx] = run;
      } else { runRange.push(rng); runOf[idx] = runRange.length - 1; }
    });
    return (idx) => {
      const [lo, hi] = runRange[runOf[idx]];
      const off = Math.min(hi, Math.max(lo, 0));
      return (st) => Math.floor((sumOf(st.best) + sumOf(st.news) - off) / 50);
    };
  },
};

// ---- maimai DX ----
// 单曲 rating = floor(定数 × min(达成率, 100.5) × 系数)，CiRCLE 以后 AP / AP+ 额外 +1（同 maimai-dx-score 的 calcRating）
const MAI_FACTORS = [
  [100.5, 224], [100.4999, 222], [100, 216], [99.9999, 214], [99.5, 211], [99, 208],
  [98.9999, 206], [98, 203], [97, 200], [96.9999, 176], [94, 168], [90, 152], [80, 136],
  [79.9999, 128], [75, 120], [70, 112], [60, 96], [50, 80], [40, 64], [30, 48], [20, 32], [10, 16], [0, 0],
];
const MAI_DIFF = { BASIC: 'bas', ADVANCED: 'adv', EXPERT: 'exp', MASTER: 'mas', 'Re:MASTER': 'remas' };
const MAI_FC = { '': 0, FC: 1, 'FC+': 2, AP: 3, 'AP+': 4 };
function maiRating(c, a10000, fc) {
  if (!c) return 0;
  const a = Math.min(a10000 / 10000, 100.5);
  const f = MAI_FACTORS.find(([t]) => a >= t)[1];
  return Math.floor((Math.round(c * 10) * Math.round(a * 10000) * f) / 1e8) + (/^AP/.test(fc || '') ? 1 : 0);
}

const maimai = {
  urls: ['https://131a562.github.io/sbga-tool/data/feed/maimai-music-ex.json', 'https://otoge-db.net/maimai/data/music-ex.json'],
  frames: { best: 35, news: 15 }, label: { best: 'BEST35', news: 'NEW15' }, digits: 0,
  setup(list) {
    const byImg = new Map(), byTitle = new Map();
    let latest = 0;
    list.forEach((m) => {
      if (m.catcode === '宴会場' || m.lev_utage) return;
      if (m.image_url) byImg.set(m.image_url, m);
      if (!byTitle.has(norm(m.title))) byTitle.set(norm(m.title), m);
      latest = Math.max(latest, +m.version || 0);
    });
    // 新曲枠：CiRCLE（26000）以后是当前版本 + 上一个版本（同书签）。でらっくす以后每个版本的代码相差 500
    latest = Math.floor(latest / 500) * 500;
    const newFrom = latest >= 26000 ? latest - 500 : latest;
    return {
      info(o) {
        const m = (o.j && byImg.get(o.j)) || byTitle.get(norm(o.n));
        const pre = o.kd === 'DX' ? 'dx_' : '', dk = MAI_DIFF[o.d] || 'mas';
        const level = (m && m[pre + 'lev_' + dk]) || '';
        const ci = parseFloat(m && m[pre + 'lev_' + dk + '_i']);
        const est = parseFloat(level) + (level.endsWith('+') ? 0.6 : 0);
        return { c: ci > 0 ? ci : est > 0 ? est : 0, isNew: !!m && (+m.version || 0) >= newFrom };
      },
    };
  },
  rowObs: (e) => ({ n: e[1], d: e[5], kd: e[6], j: e[7], src: 'b' }),
  rowValue: (frame, e, inf) => (inf.c ? maiRating(inf.c, e[2], e[4]) : e[3]),
  blank: () => ({ a: -1, fc: '' }),
  absorb(st, o) {
    const next = { a: Math.max(st.a, o.a ?? -1), fc: (MAI_FC[o.fc] || 0) > (MAI_FC[st.fc] || 0) ? o.fc : st.fc };
    // 会改变单曲 rating 的：达成率提升，或者变成 AP / AP+
    return { next, main: next.a > st.a || (next.fc !== st.fc && /^AP/.test(next.fc)) };
  },
  value: (frame, inf, st) => maiRating(inf.c, st.a, st.fc),
  // DX Rating = 50 首之和（不截断）；起点对齐前一个快照的游戏 Rating
  calibrate: (snaps, fromSnap) => (idx) => {
    const st0 = fromSnap(snaps[idx]);
    const off = snaps[idx].r ? snaps[idx].r - sumOf(st0.best) - sumOf(st0.news) : 0;
    return (st) => sumOf(st.best) + sumOf(st.news) + off;
  },
};

// ---- オンゲキ ----
// 单曲 rating（Re:Fresh 计算式，同 ongeki-score-export 的 tsRating），返回 0.001 单位的整数
const floor3 = (x) => Math.floor(x * 1000 + 1e-6) / 1000;
function ongekiMilli(c, ts, lamp, fb) {
  let base;
  if (ts >= 1010000) base = c + 2.0;
  else if (ts >= 1007500) base = c + 1.75 + (ts - 1007500) / 10000;
  else if (ts >= 1000000) base = c + 1.25 + (ts - 1000000) / 15000;
  else if (ts >= 990000) base = c + 0.75 + (ts - 990000) / 20000;
  else if (ts >= 970000) base = c + ((ts - 970000) * 0.75) / 20000;
  else if (ts >= 900000) base = c - 4 + (ts - 900000) / 17500;
  else if (ts >= 800000) base = c - 6 + (ts - 800000) / 50000;
  else if (ts >= 500000) base = ((c - 6) * (ts - 500000)) / 300000;
  else base = 0;
  base = Math.max(0, floor3(base));
  const rankBonus = ts >= 1007500 ? 0.3 : ts >= 1000000 ? 0.2 : ts >= 990000 ? 0.1 : 0;
  const lampBonus = { 'AB+': 0.35, AB: 0.3, FC: 0.1 }[lamp] || 0;
  return Math.round(floor3(base + rankBonus + lampBonus + (fb ? 0.05 : 0)) * 1000);
}
const ONGEKI_DIFF = { EXPERT: 'EXP', MASTER: 'MAS', LUNATIC: 'LUN', ADVANCED: 'ADV', BASIC: 'BAS' };
const ONGEKI_LAMP = { '': 0, FC: 1, AB: 2, 'AB+': 3 };
// 合计用 0.00001 单位：单曲 rating 是 0.001 的整数倍（×100）；P-rating = ☆ × (定数×10)²
const ongekiTs = (inf, st) => ongekiMilli(inf.c, st.s, st.l === 'AB+' && st.s < 1010000 ? 'AB' : st.l || 'CLEAR', st.fb) * 100;
const ongekiPs = (inf, st) => Math.min(st.st || 0, 5) * Math.round(inf.c * 10) ** 2;

const ongeki = {
  urls: ['https://131a562.github.io/sbga-tool/data/feed/ongeki_record.json', 'https://reiwa.f5.si/ongeki_record.json'],
  frames: { news: 10, best: 50, ps: 50 }, label: { news: 'NEW10', best: 'BEST50', ps: 'P-SCORE50' }, digits: 3,
  setup(list) {
    const byKey = new Map();
    list.forEach((m) => { const k = norm(m.title) + '|' + m.diff; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(m); });
    // 新曲枠：定数表里发布最晚的谱面所在的版本（同书签）
    const latest = list.reduce((a, m) => (m.release_unix > a.t && m.version ? { t: m.release_unix, v: m.version } : a), { t: 0, v: '' }).v;
    return {
      info(o) {
        const [, diff, artist] = String(o.k || '').split('|');
        let c = byKey.get(norm(o.n) + '|' + (ONGEKI_DIFF[diff || o.d] || diff || o.d)) || [];
        if (c.length > 1 && artist && artist !== '?') c = c.filter((m) => norm(m.artist) === norm(artist)).concat(c);
        const m = c[0];
        // 新曲枠还是ベスト枠只按版本分（同书签）；ボーナストラック不计入 Rating
        return { c: m && m.const > 0 ? m.const : 0, isNew: !!m && !!latest && m.version === latest, bonus: !!(m && m.is_bonus) };
      },
    };
  },
  rowObs: (e) => ({ k: e[0], n: e[1], d: String(e[0]).split('|')[1] }),
  // 快照里存了单曲 rating（×1000）就直接用；P-SCORE 的行存的是 P-rate×100000
  rowValue: (frame, e, inf) => (frame === 'ps' ? e[3] : e[3] != null ? e[3] * 100
    : inf.c ? ongekiTs(inf, { s: e[2], l: e[4] || '', fb: e[5] }) : 0),
  blank: () => ({ s: 0, l: '', fb: 0, st: 0, has: {} }),
  absorb(st, o) {
    const next = { ...st, has: { ...st.has } };
    let main = false, ps = false;
    if (o.s > st.s) { next.s = o.s; main = true; }
    if (o.l != null) {
      if (ONGEKI_LAMP[o.l] > ONGEKI_LAMP[next.l]) { if (st.has.l) main = true; next.l = o.l; }
      next.has.l = true;
    }
    if (next.s >= 1010000 && next.l === 'AB') next.l = 'AB+'; // AB+ 只由 TS 理论值决定
    if (o.fb != null) { if (o.fb && !st.fb) { if (st.has.fb) main = true; next.fb = 1; } next.has.fb = true; }
    if (o.ps != null) { if (o.st > st.st) { if (st.has.ps) ps = true; next.st = o.st; } next.has.ps = true; }
    return { next, main, ps };
  },
  value: (frame, inf, st) => (frame === 'ps' ? ongekiPs(inf, st) : ongekiTs(inf, st)),
  // 账号 Rating = 三个枠各自 ÷ 50 截断到 0.001 后相加；起点对齐前一个快照的游戏 Rating
  calibrate: (snaps, fromSnap) => {
    const parts = (st) => ['news', 'best', 'ps'].reduce((a, f) => a + Math.floor(sumOf(st[f]) / 5000), 0);
    return (idx) => {
      const off = snaps[idx].r ? Math.round(snaps[idx].r * 1000) - parts(fromSnap(snaps[idx])) : 0;
      return (st) => parts(st) + off;
    };
  },
};

const RULES = { chunithm, maimai, ongeki };

// game：games.js 的 GAMES 之一；raw：历史记录。返回 [{ key, ms, d, frame, entered, inFrame, single, ... }]：
//   d = 这次推分让账号 Rating（显示的单位：中二 0.01、maimai 1、音击 0.001）变了多少；
//   frame / entered / inFrame：放进了哪个枠、是不是新进的、推分后在不在枠里；single = 推分后的单曲 Rating（显示的单位）；
//   音击另有 P-SCORE50 的 pEntered / pIn。noSnap（之前没有快照）、noConst（定数未知）、bonus（ボーナストラック）时 d = 0
export async function accountImpact(game, raw) {
  const R = RULES[game.id];
  const hist = game.normalize({ ...raw, obs: raw.obs || [], snaps: raw.snaps || [] });
  const since = hist.since || '';
  const obs = hist.obs.filter((o) => o.t >= since).sort(byTime);
  // 没有曲目列表的快照（书签旧版本、数据不全）不能当起点
  const snaps = hist.snaps.filter((s) => s.t >= since && ((s.best || []).length || (s.news || []).length)).sort(byTime);
  const ctx = R.setup(await loadJson(R.urls), snaps);
  const keyOf = game.keyOf(obs);

  // 谱面键 → 定数等（用第一次见到它的记录 / 快照行查）
  const infos = new Map();
  const infoOf = (key, o, kind) => {
    if (!infos.has(key)) infos.set(key, ctx.info({ ...o, kd: kind || o.kd }));
    return infos.get(key);
  };
  const frames = Object.keys(R.frames);
  const rowsOf = (s, f) => (f === 'best' ? s.best : f === 'news' ? s.news : s.ps) || null;
  const snapCache = new Map();
  const fromSnap = (s) => {
    if (!snapCache.has(s)) {
      const st = {};
      frames.forEach((f) => {
        const rows = rowsOf(s, f);
        if (!rows) return; // 旧快照没有 P-SCORE50
        st[f] = new Map(rows.map((e) => {
          const p = R.rowObs(e);
          const { key, kind } = keyOf(p);
          return [key, R.rowValue(f, e, infoOf(key, p, kind))];
        }));
      });
      snapCache.set(s, st);
    }
    return snapCache.get(s);
  };
  const keysOf = (s) => Object.fromEntries(frames.map((f) => [f, rowsOf(s, f) ? new Set(rowsOf(s, f).map((e) => keyOf(R.rowObs(e)).key)) : null]));

  // 按时间重放：每次推分（会改变单曲 Rating 的提升）。判定和面板的推分列表相同：
  // 第一次出现时是新打的（或游戏标了 NEW RECORD）才算；以前打过的谱面，成绩扫描读到过之后的提升才算
  const isNewObs = game.isNewChart ? game.isNewChart(hist) : (o) => !!since && o.t > since;
  const state = new Map(), scanned = new Set(), fresh = new Set(), updates = [];
  obs.forEach((o) => {
    const { key, kind, unsure } = keyOf(o);
    if (unsure) return; // 分不出版本的游玩
    infoOf(key, o, kind);
    const before = state.get(key);
    if (!before && isNewObs(o)) fresh.add(key);
    const known = scanned.has(key) || fresh.has(key);
    if (o.src === 'b') scanned.add(key);
    const { next, main, ps } = R.absorb(before || R.blank(), o);
    state.set(key, next);
    const nr = o.src === 'p' && !!o.nr;
    if (!before) {
      if (fresh.has(key) || nr) updates.push({ key, t: o.t, after: next, main: true, ps: (next.st || 0) > 0 });
    } else if ((main || ps) && (known || nr)) updates.push({ key, t: o.t, after: next, main, ps });
  });

  const out = [];
  const disp = R.calibrate(snaps, fromSnap);
  // 按「在哪两个快照之间」分组（快照的时间 = 书签运行的时间，那次运行读到的游玩都在它之前）
  const groups = new Map();
  updates.forEach((u) => {
    let i = -1;
    while (i + 1 < snaps.length && snaps[i + 1].t < u.t) i++;
    if (i < 0) { out.push({ key: u.key, ms: timeMs(u.t), d: 0, noSnap: true }); return; }
    if (!groups.has(i)) groups.set(i, []);
    groups.get(i).push(u);
  });
  groups.forEach((list, i) => {
    const prev = snaps[i], next = snaps[i + 1] || null;
    const st = Object.fromEntries(Object.entries(fromSnap(prev)).map(([f, m]) => [f, new Map(m)]));
    const nextIn = next ? keysOf(next) : null;
    const accountOf = disp(i);
    const total = () => frames.reduce((a, f) => a + sumOf(st[f]), 0);
    // 同一首歌在一段里推了好几次：后一个快照里在枠里 = 最后一次推分后在里面，前面几次不一定进了
    const lastPush = new Map();
    list.forEach((u) => { if (u.main) lastPush.set('m|' + u.key, u); if (u.ps) lastPush.set('p|' + u.key, u); });
    // 放入一个值；超出枠的数量时挤掉最低的一首（可能就是它自己）。keep = 后一个快照里它确实在这个枠里：挤掉的是除它以外最低的一首
    const place = (f, u, v) => {
      const m = st[f], k = u.key;
      const inNext = nextIn && nextIn[f] ? nextIn[f].has(k) : null;
      if (inNext === false && !m.has(k)) return { entered: false, inFrame: false };
      const keep = inNext === true && lastPush.get((f === 'ps' ? 'p|' : 'm|') + k) === u;
      const was = m.has(k);
      if (!was || v > m.get(k)) m.set(k, v);
      if (m.size > R.frames[f]) {
        let low = null, lowV = Infinity;
        m.forEach((x, kk) => { if (keep && kk === k) return; if (x < lowV || (x === lowV && kk === k)) { low = kk; lowV = x; } });
        m.delete(low);
      }
      return { entered: !was && m.has(k), inFrame: m.has(k) };
    };
    list.forEach((u) => {
      const inf = infos.get(u.key);
      const res = { key: u.key, ms: timeMs(u.t), d: 0 };
      if (!inf || !inf.c) { out.push({ ...res, noConst: true }); return; }
      if (inf.bonus) { out.push({ ...res, bonus: true }); return; }
      const saved = Object.fromEntries(Object.entries(st).map(([f, m]) => [f, new Map(m)]));
      const a0 = accountOf(st), t0 = total();
      if (u.main) {
        // 中二 / maimai：先看后一个、前一个快照里它在哪个枠，都不在时按版本；音击只按版本
        const f = game.id === 'ongeki' ? (inf.isNew ? 'news' : 'best')
          : nextIn && nextIn.best.has(u.key) ? 'best' : nextIn && nextIn.news.has(u.key) ? 'news'
            : st.best.has(u.key) ? 'best' : st.news.has(u.key) ? 'news' : inf.isNew ? 'news' : 'best';
        const v = R.value(f, inf, u.after);
        Object.assign(res, { frame: R.label[f], single: v / (game.id === 'ongeki' ? 1e5 : game.id === 'chunithm' ? 100 : 1) }, place(f, u, v));
      }
      if (u.ps && st.ps) {
        const r = place('ps', u, R.value('ps', inf, u.after));
        Object.assign(res, { pEntered: r.entered, pIn: r.inFrame });
      }
      // 推分不会让枠的合计下降。算出下降 = 按定数表算的值和游戏里的对不上：复原，这次按「未进入、不变」算（同书签）
      if (total() < t0) {
        Object.assign(st, saved);
        if (res.inFrame != null) Object.assign(res, { entered: false, inFrame: false });
        if (res.pIn != null) Object.assign(res, { pEntered: false, pIn: false });
      }
      res.d = accountOf(st) - a0;
      out.push(res);
    });
  });
  return out.sort((a, b) => a.ms - b.ms);
}
