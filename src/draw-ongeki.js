// オンゲキ 的图片样式：ongeki-score-export 书签和 SBGA DASHBOARD 共用这一份。
// 书签运行时从 https://131a562.github.io/sbga-dashboard/src/draw-ongeki.js 加载（B50、查分图用 drawImage；历史走势图用这里的颜色和标签），
// 面板的 b50-ongeki.js 用它画快照的 B50。改样式只改这里，上传面板后书签和面板一起生效。
//   左边：大卡片（每行 5 张）；右边（可选）：P-SCORE50 的小卡片（每行 2 张），有右边栏时宽约 2240px
//   顶部：「O.N.G.E.K.I. Re:Fresh」+ 大标题 + 副标题，右上角统计框（B50 图：玩家名 + 大号 RATING，同 CHUNITHM）
// 卡片的数据：{ title, difficulty, remaster, level（等级，带 + 的画成 13⁺.8）, const, const_unknown, played（false = 未游玩）,
//   technical_score, rank, lamp, full_bell, platinum_score, platinum_max, platinum_star, rating, ps_rating, frame（含 P27 时右上角标 P-SCORE枠的名次） }
const V = new URL(import.meta.url).search;
const { rrect, fit, profileHeader } = await import('./draw.js' + V);
export { rrect, fit };

export const IMG = { W: 1800, PAD: 28, COLS: 5, GAP: 10, CH: 124, HEAD: 168, SEC: 44, FOOT: 40 };
IMG.CW = Math.floor((IMG.W - IMG.PAD * 2 - IMG.GAP * (IMG.COLS - 1)) / IMG.COLS);
export const SIDE = { CW: 206, CH: 62, GAP: 6, COLS: 2, MARGIN: 24 };
SIDE.W = SIDE.CW * SIDE.COLS + SIDE.GAP * (SIDE.COLS - 1);
export const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","PingFang SC","Noto Sans CJK JP","Microsoft YaHei",sans-serif';
export const C = {
  bg: '#16151c', card: '#24222d', line: '#3a3745', fg: '#f3f1f8', muted: '#9d99ab', accent: '#ff5aa8', plat: '#7fe0ff',
  BASIC: '#3fbf6f', ADVANCED: '#f2a33a', EXPERT: '#e5484d', MASTER: '#9a5cf0', LUNATIC: '#e8e5f0',
  'SSS+': '#ffd36b', SSS: '#ffc94a', SS: '#f0b43c', S: '#e3a53a',
  'AB+': '#ff7ab8', AB: '#ffb347', FC: '#4fc3f7', FB: '#ffe066', star: '#ffd36b',
};
export const DIFF_SHORT = { BASIC: 'BAS', ADVANCED: 'ADV', EXPERT: 'EXP', MASTER: 'MAS', LUNATIC: 'LUN' };
export const f = (w, px) => `${w} ${px}px ${FONT}`;
// P-rate：小数点后 3〜5 位（末尾的 0 去掉，至少留 3 位）
export const fmtPs = (v) => v.toFixed(5).replace(/(\.\d{3}\d*?)0+$/, '$1');

// 小标签：基线 y，返回宽度
export function pill(ctx, text, x, y, color, px = 12, ink = '#16151c') {
  ctx.font = f(800, px);
  const w = ctx.measureText(text).width + px;
  rrect(ctx, x, y - px - 2, w, px + 7, 4);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = ink; ctx.fillText(text, x + px / 2, y + 1);
  return w;
}
// 难度 + 定数标签。等级带 + 的写成「13⁺.8」：加号小一号、画在整数部分右上角；不带 + 的写「13.5」
export function constPill(ctx, s, x, y, color, px = 12) {
  const ink = '#16151c';
  const head = `${s.remaster ? 'Re:M' : DIFF_SHORT[s.difficulty] || ''} `;
  let intPart = '?', tail = '';
  if (s.const != null) {
    const [i, d] = s.const.toFixed(1).split('.');
    intPart = i; tail = '.' + d;
  }
  if (s.const_unknown) tail += '?';
  const plus = String(s.level || '').endsWith('+');
  const big = f(800, px), small = f(800, Math.round(px * 0.75));
  ctx.font = big;
  const wHead = ctx.measureText(head + intPart).width, wTail = ctx.measureText(tail).width;
  ctx.font = small;
  const wPlus = plus ? ctx.measureText('+').width + 1 : 0;
  const w = wHead + wPlus + wTail + px;
  rrect(ctx, x, y - px - 2, w, px + 7, 4);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = ink;
  let tx = x + px / 2;
  ctx.font = big; ctx.fillText(head + intPart, tx, y + 1); tx += wHead;
  if (plus) { ctx.font = small; ctx.fillText('+', tx, y + 1 - px * 0.42); tx += wPlus; } // 右上角
  ctx.font = big; ctx.fillText(tail, tx, y + 1);
  return w;
}
// ☆ 用图形画，不依赖字体（iOS 上 ★☆ 字符宽度不同，会和旁边的文字重叠）
export function drawStars(ctx, n, right, baseline, size = 11, gap = 2) {
  const total = 5 * size + 4 * gap;
  for (let i = 0; i < 5; i++) {
    const cx = right - total + i * (size + gap) + size / 2, cy = baseline - size / 2;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? size * 0.22 : size / 2;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      ctx[k ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = i < Math.min(n, 5) ? C.star : C.line;
    ctx.fill();
  }
  return total;
}

// 大卡片。mode: 'ts'（单曲 rating 为主）或 'ps'（P-rating 为主）
export function drawCard(ctx, s, label, x, y, jacket, mode) {
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
  // 曲绘左上角：序号
  ctx.font = f(800, 13);
  const lw = ctx.measureText(label).width + 12;
  rrect(ctx, x + 4, y + 4, lw, 20, 5); ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(label, x + 10, y + 19);

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

  // 第 1 行：难度·定数、等级（左）  所在枠（右，空间不够时截断）
  let cx = L + constPill(ctx, s, L, y + 19, C[s.difficulty] || C.muted) + 8;
  // 右上角只标 P-SCORE枠的名次（如 P27）；P50 图里左上角已经是 P 名次，不重复
  const pRank = mode === 'ps' ? '' : (String(s.frame || '').match(/P\d+/) || [''])[0];
  if (pRank) textR(pRank, y + 19, f(700, 12), C.plat, R - cx);

  // 第 2 行：曲名
  text(s.title, L, y + 42, f(700, 16), C.fg, TW);

  // 第 3 行：TS + 评级（左）  次要数值（右）
  const sub = mode === 'ps'
    ? (s.rating > 0 ? `R ${s.rating.toFixed(3)}` : '')
    : (s.ps_rating > 0 ? `P ${fmtPs(s.ps_rating)}` : '');
  if (played) {
    cx = L + text(s.technical_score.toLocaleString('en-US'), L, y + 66, f(800, 18), C.fg);
    cx += 5 + text(s.rank, cx + 5, y + 66, f(800, 14), C[s.rank] || C.muted);
  } else {
    cx = L + text('未游玩', L, y + 66, f(700, 15), C.muted);
  }
  if (sub) textR(sub, y + 66, f(600, 12), mode === 'ps' ? C.accent : C.plat, R - cx - 8);

  // 第 4 行：灯 / FB（左）  ☆（右）
  const starW = drawStars(ctx, s.platinum_star, R, y + 89);
  cx = L;
  if (played) {
    for (const [t, c] of [[C[s.lamp] ? s.lamp : '', C[s.lamp]], [s.full_bell ? 'FB' : '', C.FB]]) {
      if (!t) continue;
      ctx.font = f(800, 11);
      if (cx + ctx.measureText(t).width + 11 > R - starW - 6) break;
      cx += pill(ctx, t, cx, y + 89, c, 11) + 4;
    }
  }

  // 第 5 行：プラチナスコア（左）  主要数值（右）
  const main = mode === 'ps' ? s.ps_rating : s.rating;
  const mainW = textR(main > 0 ? (mode === 'ps' ? fmtPs(main) : main.toFixed(3)) : '—', y + 115, f(800, 22),
    main > 0 ? (mode === 'ps' ? C.plat : C.accent) : C.muted, TW);
  const ps = s.platinum_score
    ? `PS ${s.platinum_score.toLocaleString('en-US')}${s.platinum_max ? '/' + s.platinum_max.toLocaleString('en-US') : ''}`
    : 'PS —';
  text(ps, L, y + 114, f(600, 11), C.muted, TW - mainW - 8);
}

// 右侧栏的 P-SCORE50 小卡片（曲绘 + 名次 + 曲名 + 难度·定数 + PS 比例 + ☆ + P-rate），每行 2 张
export function drawPCard(ctx, s, label, x, y, jacket) {
  const { CW, CH } = SIDE;
  rrect(ctx, x, y, CW, CH, 8); ctx.fillStyle = C.card; ctx.fill();
  ctx.save(); rrect(ctx, x, y, CW, CH, 8); ctx.clip();
  if (jacket) ctx.drawImage(jacket, x, y, CH, CH);
  else { ctx.fillStyle = C.line; ctx.fillRect(x, y, CH, CH); }
  ctx.fillStyle = C[s.difficulty] || C.muted; ctx.fillRect(x, y + CH - 4, CH, 4);
  ctx.restore();
  ctx.font = f(800, 11);
  const lw = ctx.measureText(label).width + 8;
  rrect(ctx, x + 3, y + 3, lw, 16, 4); ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(label, x + 7, y + 15);
  const L = x + CH + 8, R = x + CW - 8;
  ctx.font = f(700, 13); ctx.fillStyle = C.fg;
  ctx.fillText(fit(ctx, s.title, R - L), L, y + 18);
  const pw = constPill(ctx, s, L, y + 37, C[s.difficulty] || C.muted, 10);
  if (s.platinum_max) {
    ctx.font = f(600, 10); ctx.fillStyle = C.muted;
    const pct = ((s.platinum_score / s.platinum_max) * 100).toFixed(1) + '%';
    const w = ctx.measureText(pct).width;
    if (L + pw + 6 + w <= R) ctx.fillText(pct, R - w, y + 37);
  }
  drawStars(ctx, s.platinum_star, L + 53, y + 56, 9, 2);
  ctx.font = f(800, 15); ctx.fillStyle = C.plat;
  const t = fmtPs(s.ps_rating);
  ctx.fillText(t, R - ctx.measureText(t).width, y + 57);
}

// stats：[[标签, 数值, 说明]]（右上的统计框）；sections：[{ name, note, rows, label(s, i), mode }]；
// side（可选）：右侧栏 { name, note, rows, label(s, i) }，用 P-SCORE50 小卡片排列；footer：页脚；
// jackets：卡片数据 → 加载好的曲绘（没有时 NO IMAGE）。返回 canvas
// profile（B50 图用）：{ kicker, name, rating, ratingLabel, stats: [[标签, 数值, 颜色]], note }，
//   有它时头部改成 CHUNITHM 那样的玩家名 + 大号 Rating（draw.js 的 profileHeader），title / subtitle / stats 不用
export function drawImage({ title, subtitle, stats, sections, side, footer, jackets, profile }) {
  const { PAD, COLS, GAP, CH, HEAD, SEC, FOOT, CW } = IMG;
  const mainRight = IMG.W - PAD; // 主区域（大卡片）的右边界
  const sideX = mainRight + SIDE.MARGIN;
  const W = side ? sideX + SIDE.W + PAD : IMG.W;
  const rowsOf = (n) => Math.max(1, Math.ceil(n / COLS));
  const mainH = sections.reduce((h, sec) => h + SEC + rowsOf(sec.rows.length) * (CH + GAP), 0);
  const sideH = side ? SEC + Math.max(1, Math.ceil(side.rows.length / SIDE.COLS)) * (SIDE.CH + SIDE.GAP) : 0;
  const H = HEAD + Math.max(mainH, sideH) + FOOT;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  // 头部：左边标题，右边统计（副标题写到统计框前面为止）
  const boxW = 200, boxGap = 10;
  if (profile) {
    profileHeader(ctx, { W, PAD, f, C: { kicker: C.accent, fg: C.fg, muted: C.muted, rating: C.accent }, kicker: 'O.N.G.E.K.I. Re:Fresh', ...profile });
  } else {
    ctx.fillStyle = C.accent; ctx.font = f(800, 16); ctx.fillText('O.N.G.E.K.I. Re:Fresh', PAD, 42);
    ctx.fillStyle = C.fg; ctx.font = f(800, 52); ctx.fillText(title, PAD, 100);
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
  // 右侧栏
  if (side) {
    ctx.fillStyle = C.line; ctx.fillRect(sideX, HEAD + 6, SIDE.W, 1);
    ctx.fillStyle = C.fg; ctx.font = f(800, 20); ctx.fillText(side.name, sideX, HEAD + 34);
    if (side.note) {
      const nw = ctx.measureText(side.name).width;
      ctx.font = f(500, 13); ctx.fillStyle = C.muted;
      ctx.fillText(fit(ctx, side.note, SIDE.W - nw - 10), sideX + nw + 10, HEAD + 34);
    }
    if (!side.rows.length) {
      ctx.font = f(500, 14); ctx.fillStyle = C.muted;
      ctx.fillText('还没有拿到☆的谱面', sideX, HEAD + SEC + 30);
      ctx.font = f(500, 12);
      ctx.fillText('プラチナスコア达到满分的 94% 才有 ☆1', sideX, HEAD + SEC + 52);
    }
    side.rows.forEach((s, i) => {
      drawPCard(ctx, s, side.label(s, i), sideX + (i % SIDE.COLS) * (SIDE.CW + SIDE.GAP),
        HEAD + SEC + Math.floor(i / SIDE.COLS) * (SIDE.CH + SIDE.GAP), jackets.get(s));
    });
  }
  // 各区块
  let y = HEAD;
  for (const sec of sections) {
    ctx.fillStyle = C.line; ctx.fillRect(PAD, y + 6, mainRight - PAD, 1);
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
      drawCard(ctx, s, sec.label(s, i), PAD + (i % COLS) * (CW + GAP), y + Math.floor(i / COLS) * (CH + GAP), jackets.get(s), sec.mode || 'ts');
    });
    y += rowsOf(sec.rows.length) * (CH + GAP);
  }
  ctx.font = f(500, 13); ctx.fillStyle = C.muted;
  ctx.fillText(fit(ctx, footer, W - PAD * 2), PAD, H - 16);
  return cv;
}
