// maimai DX 的图片样式：maimai-dx-score 书签和 SBGA DASHBOARD 共用这一份。
// 书签运行时从 https://131a562.github.io/sbga-dashboard/src/draw-maimai.js 加载（B50、查分图用 drawImage；历史走势图用这里的颜色和标签），
// 面板的 b50-maimai.js 用它画快照的 B50。改样式只改这里，上传面板后书签和面板一起生效。
//   顶部：「maimai でらっくす <最新版本>  ·  玩家名」+ 大标题 + 副标题，右上统计框（B50 图：玩家名 + 大号 DX RATING，同 CHUNITHM）
//   卡片（每行 5 张，宽 1800px）：曲绘、序号、DX/STD、难度·定数（13⁺.8）、版本、曲名、达成率 + 评级、FC/AP、FS/FDX、DX 星、DX 分、单曲 rating
// 卡片的数据：{ title, difficulty, diffShort, kind, level, const, const_unknown, version, played（false = 未游玩）,
//   achievement（%）, rank, fc, sync, dx_score, dx_max, dx_star, rating }
const V = new URL(import.meta.url).search;
const { rrect, fit, profileHeader } = await import('./draw.js' + V);
export { rrect, fit };

export const IMG = { W: 1800, PAD: 28, COLS: 5, GAP: 10, CH: 124, HEAD: 168, SEC: 44, FOOT: 40 };
IMG.CW = Math.floor((IMG.W - IMG.PAD * 2 - IMG.GAP * (IMG.COLS - 1)) / IMG.COLS);
export const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","PingFang SC","Noto Sans CJK JP","Microsoft YaHei",sans-serif';
export const C = {
  bg: '#16151c', card: '#24222d', line: '#3a3745', fg: '#f3f1f8', muted: '#9d99ab', accent: '#ff5aa8', plat: '#7fe0ff',
  BASIC: '#3fbf6f', ADVANCED: '#f2a33a', EXPERT: '#e5484d', MASTER: '#9a5cf0', 'Re:MASTER': '#e3c8ff',
  'SSS+': '#ffd36b', SSS: '#ffc94a', 'SS+': '#f0b43c', SS: '#f0b43c', 'S+': '#e3a53a', S: '#e3a53a',
  'AP+': '#ffd36b', AP: '#ffc94a', 'FC+': '#7fe0ff', FC: '#4fc3f7',
  'FDX+': '#ff9a5a', FDX: '#ffb347', 'FS+': '#7ee08a', FS: '#5ccf6c', SYNC: '#9d99ab',
  DX: '#ff9a3c', STD: '#4aa3ff', star: ['#3a3745', '#5ccf6c', '#5ccf6c', '#ffb347', '#ffb347', '#ffd36b'],
};
export const f = (w, px) => `${w} ${px}px ${FONT}`;

// 定数的显示：13.8 → 13⁺.8（x.6 以上为「+」，等级读得到时以等级为准）
export const constParts = (s) => {
  if (s.const == null) return null;
  const i = Math.floor(s.const + 1e-9);
  const plus = s.level ? s.level.endsWith('+') : s.const - i >= 0.6 - 1e-9;
  return { int: String(i), plus, dec: s.const_unknown ? '.?' : '.' + Math.round((s.const - i) * 10) };
};
// 小标签：基线 y，返回宽度
export function pill(ctx, text, x, y, color, px = 12, ink = '#16151c') {
  ctx.font = f(800, px);
  const w = ctx.measureText(text).width + px;
  rrect(ctx, x, y - px - 2, w, px + 7, 4);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = ink; ctx.fillText(text, x + px / 2, y + 1);
  return w;
}
// 难度·定数标签：「MAS 13⁺.8」，+ 用小字号画在右上角
export function constPill(ctx, s, x, y, px = 13) {
  const p = constParts(s);
  const parts = p
    ? [[`${s.diffShort} ${p.int}`, px, 0], [p.plus ? '+' : '', px - 2, -px * 0.42], [p.dec, px, 0]]
    : [[`${s.diffShort} ?`, px, 0]];
  let w = px;
  for (const [t, size] of parts) { ctx.font = f(800, size); w += ctx.measureText(t).width; }
  rrect(ctx, x, y - px - 3, w, px + 9, 4);
  ctx.fillStyle = C[s.difficulty] || C.muted; ctx.fill();
  ctx.fillStyle = s.difficulty === 'Re:MASTER' ? '#3b1d5e' : '#16151c';
  let cx = x + px / 2;
  for (const [t, size, dy] of parts) { ctx.font = f(800, size); ctx.fillText(t, cx, y + 1 + dy); cx += ctx.measureText(t).width; }
  return w;
}
// DX 分的星（✦）用图形画，不依赖字体；颜色随星数变化（1-2 绿 / 3-4 橙 / 5 金）
export function drawStars(ctx, n, right, baseline, size = 12, gap = 2) {
  const total = 5 * size + 4 * gap;
  for (let i = 0; i < 5; i++) {
    const cx = right - total + i * (size + gap) + size / 2, cy = baseline - size / 2;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const r = k % 2 ? size * 0.2 : size / 2;
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      ctx[k ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = i < n ? C.star[n] : C.line;
    ctx.fill();
  }
  return total;
}

export function drawCard(ctx, s, label, x, y, jacket) {
  const { CW, CH } = IMG;
  // 底板
  rrect(ctx, x, y, CW, CH, 10); ctx.fillStyle = C.card; ctx.fill();
  // 曲绘
  ctx.save(); rrect(ctx, x, y, CW, CH, 10); ctx.clip();
  if (jacket) ctx.drawImage(jacket, x, y, CH, CH);
  else {
    ctx.fillStyle = C.line; ctx.fillRect(x, y, CH, CH);
    ctx.fillStyle = C.muted; ctx.font = f(700, 14); ctx.textAlign = 'center';
    ctx.fillText('NO IMAGE', x + CH / 2, y + CH / 2 + 5); ctx.textAlign = 'left';
  }
  ctx.fillStyle = C[s.difficulty] || C.muted; ctx.fillRect(x, y + CH - 6, CH, 6);
  ctx.restore();
  // 曲绘左上角：序号；左下角：DX / STD
  ctx.font = f(800, 13);
  const lw = ctx.measureText(label).width + 12;
  rrect(ctx, x + 4, y + 4, lw, 20, 5); ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(label, x + 10, y + 19);
  if (s.kind) pill(ctx, s.kind, x + 6, y + CH - 12, C[s.kind], 11, '#fff');

  // 文字区：每一行都先量宽度再放，右侧元素给左侧让位（不同系统字体宽度不同，不能写死位置）
  const L = x + CH + 10, R = x + CW - 10, TW = R - L;
  ctx.textAlign = 'left';
  const text = (t, tx, ty, font, color, maxW) => {
    ctx.font = font; ctx.fillStyle = color;
    const s2 = maxW != null ? fit(ctx, t, Math.max(0, maxW)) : t;
    if (maxW == null || maxW > 12) ctx.fillText(s2, tx, ty);
    return ctx.measureText(s2).width;
  };
  const textR = (t, ty, font, color, maxW) => { // 右对齐，返回宽度
    ctx.font = font;
    const s2 = fit(ctx, t, maxW);
    const w = ctx.measureText(s2).width;
    if (maxW > 12) { ctx.fillStyle = color; ctx.fillText(s2, R - w, ty); }
    return w;
  };
  const played = s.played !== false;
  // 第 1 行：难度·定数（左）  版本（右，空间不够时截断）
  let cx = L + constPill(ctx, s, L, y + 20) + 8;
  if (s.version) textR(s.version, y + 20, f(600, 12), C.muted, R - cx);
  // 第 2 行：曲名
  text(s.title, L, y + 45, f(700, 16), C.fg, TW);
  // 第 3 行：达成率 + 评级
  if (played) {
    cx = L + text(`${s.achievement.toFixed(4)}%`, L, y + 71, f(800, 18), C.fg);
    text(s.rank, cx + 5, y + 71, f(800, 14), C[s.rank] || C.muted, R - cx - 5);
  } else {
    text('未游玩', L, y + 71, f(700, 15), C.muted);
  }
  // 第 4 行：FC/AP、FS/FDX（左）  DX 星（右，没有 DX 分时不画）
  const starW = s.dx_max ? drawStars(ctx, s.dx_star, R, y + 93) : 0;
  cx = L;
  for (const t of [s.fc, s.sync === 'SYNC' ? '' : s.sync]) {
    if (!t) continue;
    ctx.font = f(800, 11);
    if (cx + ctx.measureText(t).width + 11 > R - starW - 6) break;
    cx += pill(ctx, t, cx, y + 93, C[t] || C.muted, 11) + 4;
  }
  // 第 5 行：DX 分 / 满分（左）  单曲 rating（右）
  const ratingW = textR(s.rating > 0 ? String(s.rating) : '—', y + 117, f(800, 22), s.rating > 0 ? C.accent : C.muted, TW);
  if (s.dx_max) {
    cx = L + text('DX ', L, y + 116, f(700, 11), C.muted);
    text(`${played ? s.dx_score.toLocaleString('en-US') : '—'} / ${s.dx_max.toLocaleString('en-US')}`, cx, y + 116, f(700, 13), C.plat, R - cx - ratingW - 8);
  }
}

// head：最上面一行（「maimai でらっくす <版本>  ·  玩家名」）；stats：[[标签, 数值, 说明]]（右上的统计框）；
// sections：[{ name, note, rows, label(s, i) }]；footer：页脚；jackets：卡片数据 → 加载好的曲绘（没有时 NO IMAGE）。返回 canvas
// profile（B50 图用）：{ kicker, name, rating, ratingLabel, stats: [[标签, 数值, 颜色]], note }，
//   有它时头部改成 CHUNITHM 那样的玩家名 + 大号 Rating（draw.js 的 profileHeader），head / title / subtitle / stats 不用
export function drawImage({ head, title, subtitle, stats, sections, footer, jackets, profile }) {
  const { W, PAD, COLS, GAP, CH, HEAD, SEC, FOOT, CW } = IMG;
  const rowsOf = (n) => Math.max(1, Math.ceil(n / COLS));
  const H = HEAD + sections.reduce((h, sec) => h + SEC + rowsOf(sec.rows.length) * (CH + GAP), 0) + FOOT;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  // 头部：左边标题，右边统计（副标题写到统计框前面为止）
  const boxW = 220, boxGap = 10;
  if (profile) {
    profileHeader(ctx, { W, PAD, f, C: { kicker: C.accent, fg: C.fg, muted: C.muted, rating: C.accent }, kicker: head, ...profile });
  } else {
    ctx.fillStyle = C.accent; ctx.font = f(800, 16); ctx.fillText(fit(ctx, head, 700), PAD, 42);
    ctx.fillStyle = C.fg; ctx.font = f(800, 52); ctx.fillText(fit(ctx, title, 760), PAD, 100);
    ctx.font = f(500, 15); ctx.fillStyle = C.muted;
    ctx.fillText(fit(ctx, subtitle, W - PAD * 2 - stats.length * (boxW + boxGap) - 20), PAD, 132);
  }
  (profile ? [] : stats).forEach(([label, value, note], i) => {
    const bx = W - PAD - (stats.length - i) * (boxW + boxGap) + boxGap;
    rrect(ctx, bx, 26, boxW, 112, 10); ctx.fillStyle = C.card; ctx.fill();
    ctx.fillStyle = C.muted; ctx.font = f(700, 14); ctx.fillText(label, bx + 14, 52);
    ctx.fillStyle = C.fg; ctx.font = f(800, 30); ctx.fillText(fit(ctx, value, boxW - 28), bx + 14, 92);
    ctx.fillStyle = C.muted; ctx.font = f(500, 13); ctx.fillText(fit(ctx, note, boxW - 28), bx + 14, 122);
  });
  // 各区块
  let y = HEAD;
  for (const sec of sections) {
    ctx.fillStyle = C.line; ctx.fillRect(PAD, y + 6, W - PAD * 2, 1);
    ctx.fillStyle = C.fg; ctx.font = f(800, 20); ctx.fillText(sec.name, PAD, y + 34);
    if (sec.note) {
      const nw = ctx.measureText(sec.name).width;
      ctx.font = f(500, 15); ctx.fillStyle = C.muted; ctx.fillText(sec.note, PAD + nw + 14, y + 34);
    }
    y += SEC;
    if (!sec.rows.length) {
      ctx.font = f(500, 15); ctx.fillStyle = C.muted; ctx.fillText('没有符合条件的谱面', PAD, y + 40);
    }
    sec.rows.forEach((s, i) => {
      drawCard(ctx, s, sec.label(s, i), PAD + (i % COLS) * (CW + GAP), y + Math.floor(i / COLS) * (CH + GAP), jackets.get(s));
    });
    y += rowsOf(sec.rows.length) * (CH + GAP);
  }
  ctx.font = f(500, 13); ctx.fillStyle = C.muted;
  ctx.fillText(fit(ctx, footer, W - PAD * 2), PAD, H - 16);
  return cv;
}
