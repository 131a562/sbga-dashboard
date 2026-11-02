// 三个游戏的历史记录（otoge-history 里的 <游戏>/<名字>.json）→ 面板要显示的数据
// 记录格式见各书签工程的 README「历史记录」：obs = 观测记录（src 'b' 成绩扫描 / 'p' プレイ履歴），snaps = Rating 快照
// 面板只看「这段时间里哪些谱面的最佳分数提高了、提高了多少」；每次推分对账号 Rating 的影响在 impact.js（推分区块用）
// 版本号（?v=N）沿用 app.js 带过来的，见 app.js 开头
const { norm, timeMs, lastRunOf } = await import('./common.js' + new URL(import.meta.url).search);

const num = (x) => x.toLocaleString('en-US');
const fmtAch = (a) => (a / 10000).toFixed(4) + '%';

// 谱面的统一键：中二的 k 是「曲目 id:难度」，プレイ履歴里对应不到 id 时是「n:曲名:难度」，所以统一按「曲名|难度」
const titleKey = (o) => norm(o.n) + '|' + o.d;

// maimai：同一首歌的 DX / 标准谱面要分开。成绩扫描记录一定有 DX/STD；プレイ履歴里可能没认出，
// 这时按「曲名 + 难度」在成绩扫描里找，只有一种谱面时归到它，否则用 DX 分满分、曲绘区分（同书签的 resolveChart）
function maimaiKey(obs) {
  const kinds = new Map(); // 曲名|难度 → Map(DX/STD → {xm, j})
  obs.forEach((o) => {
    if (o.src !== 'b' || !o.kd) return;
    const a = titleKey(o);
    if (!kinds.has(a)) kinds.set(a, new Map());
    kinds.get(a).set(o.kd, { xm: o.xm, j: o.j });
  });
  return (o) => {
    const a = titleKey(o);
    let kd = o.kd;
    const c = kinds.get(a);
    if (!kd && c) {
      let list = [...c.entries()];
      if (list.length > 1 && o.xm) list = list.filter(([, v]) => v.xm === o.xm).length ? list.filter(([, v]) => v.xm === o.xm) : list;
      if (list.length > 1 && o.j) list = list.filter(([, v]) => v.j === o.j).length ? list.filter(([, v]) => v.j === o.j) : list;
      if (list.length === 1) kd = list[0][0];
    }
    return { key: a + '|' + (kd || '?'), kind: kd || '' };
  };
}

export const GAMES = [
  {
    id: 'chunithm', label: 'CHUNITHM', color: '#e0a800',
    // v3 以前（没有起点）的记录：把第一次成绩扫描的时间当作起点（同 chuni-b50 的 migrateHist）
    normalize: (h) => {
      if (h.v >= 3) return h;
      const since = h.obs.filter((o) => o.src === 'b').map((o) => o.t).sort()[0] || h.snaps.map((s) => s.t).sort()[0] || '';
      return { ...h, since };
    },
    keyOf: () => (o) => ({ key: titleKey(o), kind: '' }),
    // 起点那次不一定读了全曲成绩（只读 B50 时只有 50 首），所以「第一次出现」不等于「新打的」。
    // 同书签的 derive：之前已经有覆盖这个难度的完整全曲扫描（hist.scans）、而那次里没有它，才算新打的；
    // プレイ履歴里对应不到曲目 id 的（k 以 n: 开头）不算
    isNewChart: (hist) => {
      const full = (hist.scans || []).map((x) => { const [t, ds] = x.split('|'); return { t, ds: (ds || '').split(',').map(Number) }; });
      return (o) => !String(o.k).startsWith('n:') && full.some((f) => f.t < o.t && f.ds.includes(o.d));
    },
    diffName: (d) => ['BAS', 'ADV', 'EXP', 'MAS', 'ULT'][d] || '?',
    diffColor: (d) => ['#22bb5b', '#e8a10a', '#e3374c', '#9b3fd6', '#555'][d] || '#888',
    score: (o) => o.s, lamp: (o) => o.l, lamps: ['FC', 'AJ', 'AJC'], fmtScore: num, fmtGain: (g) => '+' + num(g),
    fmtRating: (r) => Number(r).toFixed(2),
    // 里程碑（整数单位 = Rating × scale，避免浮点误差）：15.00 以下每 0.5 一次，15.00 以上每 0.1 一次
    scale: 100, tiers: [[1500, 50], [Infinity, 10]],
    ratingSub: (s) => [['BEST 30 平均', s.b30 ? s.b30.toFixed(4) : '—'], ['NEW 20 平均', s.n20 ? s.n20.toFixed(4) : '—']],
  },
  {
    id: 'maimai', label: 'maimai DX', color: '#2ea8dc',
    // v1（没有起点）的记录书签会整份丢弃重新开始，这里也不显示
    normalize: (h) => (h.v === 2 ? h : { ...h, since: '', obs: [], snaps: [] }),
    keyOf: maimaiKey,
    diffName: (d) => ({ EXPERT: 'EXP', MASTER: 'MAS', 'Re:MASTER': 'ReM' }[d] || d),
    diffColor: (d) => ({ EXPERT: '#e3374c', MASTER: '#9b3fd6', 'Re:MASTER': '#c17be0' }[d] || '#888'),
    score: (o) => o.a, lamp: (o) => o.fc, lamps: ['FC', 'FC+', 'AP', 'AP+'], fmtScore: fmtAch, fmtGain: (g) => '+' + (g / 10000).toFixed(4) + '%',
    fmtRating: (r) => String(r),
    // 里程碑：16000 以下每 500 一次，16000 以上每 100 一次
    scale: 1, tiers: [[16000, 500], [Infinity, 100]],
    ratingSub: (s) => [['BEST35 合计', s.parts ? String(s.parts[1]) : '—'], ['NEW15 合计', s.parts ? String(s.parts[0]) : '—']],
    // 游玩详情里游戏记录的「游玩后的 DX Rating」和「游玩前 = 游玩后 − 变动」也画进走势（同书签）
    extraSeries: (obs) => obs.filter((o) => o.src === 'p' && o.r > 0).flatMap((o) => {
      const ms = timeMs(o.t);
      return o.dr != null ? [{ ms: ms - 1, r: o.r - o.dr }, { ms, r: o.r }] : [{ ms, r: o.r }];
    }),
  },
  {
    id: 'ongeki', label: 'オンゲキ', color: '#e0508f',
    // v4 以前的记录书签会整份丢弃，这里也不显示
    normalize: (h) => (h.v === 4 ? h : { ...h, since: '', obs: [], snaps: [] }),
    // 谱面键直接用书签存的 k：一般是「曲名|难度」，同名曲（Singularity 等）是「曲名|难度|艺术家」，
    // プレイ履歴里分不出是哪个版本的游玩是「曲名|难度|?」（见 ongeki-score-export 的 histKeyOf / parsePlaylog）
    keyOf: () => (o) => {
      const extra = String(o.k || '').split('|')[2];
      if (extra == null) return { key: titleKey(o), kind: '' };
      return { key: titleKey(o) + '|' + extra, kind: '', suffix: extra === '?' ? '版本未知' : extra, unsure: extra === '?' };
    },
    diffName: (d) => ({ EXPERT: 'EXP', MASTER: 'MAS', LUNATIC: 'LUN' }[d] || d),
    diffColor: (d) => ({ EXPERT: '#e3374c', MASTER: '#9b3fd6', LUNATIC: '#d6336c' }[d] || '#888'),
    score: (o) => o.s, lamp: (o) => o.l, lamps: ['FC', 'AB', 'AB+'], fmtScore: num, fmtGain: (g) => '+' + num(g),
    fmtRating: (r) => Number(r).toFixed(3),
    // 里程碑：17.000 以下每 0.5 一次，17.000 以上每 0.1 一次
    scale: 1000, tiers: [[17000, 500], [Infinity, 100]],
    ratingSub: (s) => {
      const p = (i) => (s.parts ? (s.parts[i] / 1000).toFixed(3) : '—');
      return [['新曲枠', p(0)], ['ベスト枠', p(1)], ['P-SCORE枠', p(2)]];
    },
  },
];

// 比 u 高的下一个里程碑（整数单位）。tiers = [[上限, 间隔], ...]：u 低于某个上限时按那一段的间隔，
// 一段的上限本身也是里程碑（例如中二 15.00）
const nextMark = (tiers, u) => {
  const [limit, step] = tiers.find(([lim]) => u < lim);
  return Math.min((Math.floor(u / step) + 1) * step, limit);
};

// Rating 走势里每一次第一次跨过里程碑的时刻 → [{ ms, value }]；以及下一个里程碑
// 起点那次的 Rating 只当作出发点，不算里程碑。Rating 掉下来再涨回去不重复算
export function milestones(game, series) {
  const out = [];
  if (!series.length) return { list: out, next: null };
  const unit = (r) => Math.round(r * game.scale);
  let best = unit(series[0].r);
  series.forEach((p) => {
    const u = unit(p.r);
    if (u <= best) return;
    for (let m = nextMark(game.tiers, best); m <= u; m = nextMark(game.tiers, m)) out.push({ ms: p.ms, value: m / game.scale });
    best = u;
  });
  const now = unit(series[series.length - 1].r);
  const next = nextMark(game.tiers, best);
  return { list: out, next: { value: next / game.scale, gap: (next - now) / game.scale } };
}

// 一份历史记录 → { since, lastRun, rating, series, plays, chartCount, improved(startMs[, endMs]), milestones }
export function analyze(game, raw) {
  const hist = game.normalize({ ...raw, obs: raw.obs || [], snaps: raw.snaps || [] });
  const since = hist.since || '';
  const obs = hist.obs.filter((o) => o.t >= since && game.score(o) >= 0).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  const snaps = hist.snaps.filter((s) => s.t >= since);
  const sinceMs = since ? timeMs(since) : -Infinity;

  // 每个谱面的观测（时间、分数），按时间排好。fresh = 第一次出现时是新打的谱面
  // （maimai / オンゲキ 的起点一定是全曲扫描，所以起点之后才出现的就是新打的；中二见上面的 isNewChart）
  const keyOf = game.keyOf(obs);
  const isNew = game.isNewChart ? game.isNewChart(hist) : (o) => !!since && o.t > since;
  const charts = new Map();
  obs.forEach((o) => {
    // suffix：显示在曲名后面的区分（音击同名曲的艺术家）；unsure：分不出是哪个版本，不当作新打的谱面
    const { key, kind, suffix, unsure } = keyOf(o);
    if (!charts.has(key)) {
      // 第一次出现就是游戏标了 NEW RECORD 的游玩，也当作新打的：第一次打一定是 NEW RECORD，
      // 而以前打过的谱面一般早就被扫描记下了（例如中二早期的扫描没读 ULTIMA，第一次读到的 ULTIMA 就是这种情况）
      const firstNr = o.src === 'p' && !!o.nr;
      // ref：记录里的写法（曲名、难度、键），跳到 SBGA TOOL 的曲目页时用
      charts.set(key, { key, title: norm(o.n) + (suffix ? '（' + suffix + '）' : ''), d: o.d, kind, pts: [],
        fresh: !unsure && (isNew(o) || firstNr), unsure, ref: { n: o.n, d: o.d, kd: kind || o.kd, k: o.k } });
    }
    charts.get(key).pts.push({ ms: timeMs(o.t), t: o.t, v: game.score(o), lamp: game.lamp(o) || '', src: o.src });
  });

  // startMs 之后最佳分数提高了的谱面。起点（第一次记录）之前不知道成绩，所以比较的基准最早是起点那次的成绩扫描；
  // 基准里没有、而且是新打的谱面 = 这段时间里第一次打的（first），单独列出；
  // 不是新打的（以前就打过，只是起点那次没读到）以第一次读到的成绩为基准
  // endMs：只看到这个时间为止的成绩（一次出勤里推了哪些谱面）
  const improved = (startMs, endMs = Infinity) => {
    const cut = Math.max(startMs, sinceMs + 1);
    const out = [];
    charts.forEach((c) => {
      // 分不出版本的游玩可能来自不同的谱面，互相比较不算推分（游玩次数、出勤里照常统计）
      if (c.unsure) return;
      let before = null, after = null, at = 0;
      c.pts.forEach((p) => {
        if (p.ms > endMs) return;
        if (p.ms < cut) before = before == null ? p.v : Math.max(before, p.v);
        if (after == null || p.v > after) { after = p.v; at = p.ms; }
      });
      if (before == null && !c.fresh) before = c.pts[0].v;
      if (after == null || (before != null && after <= before)) return;
      out.push({
        key: c.key, title: c.title, diff: game.diffName(c.d) + (c.kind ? ' ' + c.kind : ''), diffColor: game.diffColor(c.d),
        from: before, to: after, gain: before == null ? 0 : after - before, first: before == null, at,
      });
    });
    return out.sort((a, b) => b.gain - a.gain || b.at - a.at);
  };

  const last = snaps[snaps.length - 1];
  const series = snaps.filter((s) => s.r > 0).map((s) => ({ ms: timeMs(s.t), r: +s.r }))
    .concat(game.extraSeries ? game.extraSeries(obs) : []).sort((a, b) => a.ms - b.ms);
  return {
    since,
    lastRun: lastRunOf({ obs, snaps }),
    rating: last && last.r > 0 ? { value: +last.r, text: game.fmtRating(last.r), sub: game.ratingSub(last) } : null,
    series,
    plays: obs.filter((o) => o.src === 'p').map((o) => timeMs(o.t)),
    chartCount: charts.size,
    improved,
    // 某个谱面（记录里的写法 { n, d, kd, k }）的全部记录，没有时 null
    chart: (o) => charts.get(keyOf(o).key) || null,
    chartByKey: (key) => charts.get(key) || null,
    milestones: milestones(game, series),
    // B50 图用：所有带曲目列表的快照（按时间从早到晚；书签每次运行、B50 有变化时存一个），
    // 默认用最后一个；以及游戏里的玩家名
    b50Snaps: snaps.filter((s) => (s.best || []).length || (s.news || []).length),
    get b50Snap() { return this.b50Snaps[this.b50Snaps.length - 1] || null; },
    playerName: hist.name || '',
    rawObs: obs, // 起点之后的观测记录（音击的 B50 图从成绩扫描里取プラチナスコア）
  };
}
