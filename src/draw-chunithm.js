// CHUNITHM 的图片样式：chuni-b50 书签和 SBGA DASHBOARD 共用这一份。
// 书签运行时从 https://131a562.github.io/sbga-dashboard/src/draw-chunithm.js 加载（B50、定数筛选、历史走势的图都用这里的底色、标题和卡片），
// 面板的 b50-chunithm.js 用它画快照的 B50。改样式只改这里，上传面板后书签和面板一起生效。
//   深蓝紫渐变背景 + 细斜线；左上「CHUNITHM  RATING  BEST 50」+ 玩家名；右上 RATING（金色大字）、NEW 20 AVG、BEST 30 AVG
//   卡片：半透明底 + 难度颜色描边，曲绘、序号 #1、曲名、难度·定数徽章（14⁺.7）、评级、AJ/FC、分数、单曲 Rating；宽 1592px
// 卡片的数据：{ title, diff（0〜4）, constant, estimated（定数未公开、按等级估算）, score, lamp, rating, img（加载好的曲绘或 null） }
const V = new URL(import.meta.url).search;
const { rrect, fit } = await import('./draw.js' + V);
export { fit };
export const round = rrect;

// iOS / macOS 用 Hiragino，Android 用 Noto CJK，Windows 用 Meiryo；简体中文字形缺失时由 PingFang / YaHei 补上
export const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Noto Sans CJK JP","Yu Gothic","Meiryo",' +
  '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
export const DIFFS = [
  { key: 'bas', short: 'BAS', color: '#22bb5b' },
  { key: 'adv', short: 'ADV', color: '#e8a10a' },
  { key: 'exp', short: 'EXP', color: '#e3374c' },
  { key: 'mas', short: 'MAS', color: '#9b3fd6' },
  { key: 'ult', short: 'ULT', color: '#1a1a1a' },
];
export const COLS = 5, CW = 296, CH = 112, GAP = 12, PAD = 32;
export const W = PAD * 2 + COLS * CW + (COLS - 1) * GAP;
export const rows = (n) => Math.ceil(n / COLS);
export const floor2 = (x) => (Math.floor(x * 100 + 1e-6) / 100).toFixed(2);
export const scoreRank = (s) => [
  [1009000, 'SSS+'], [1007500, 'SSS'], [1005000, 'SS+'], [1000000, 'SS'], [990000, 'S+'], [975000, 'S'],
  [950000, 'AAA'], [925000, 'AA'], [900000, 'A'], [800000, 'BBB'], [700000, 'BB'], [600000, 'B'], [500000, 'C'],
].find(([b]) => s >= b)?.[1] || 'D';

export function newCanvas(h, w = W) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  if (!g) throw new Error('浏览器无法创建这么大的图片（' + w + '×' + h + '），请缩小定数范围。');
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#141a33'); bg.addColorStop(0.55, '#1d1438'); bg.addColorStop(1, '#0d2230');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.06; g.strokeStyle = '#fff'; g.lineWidth = 1;
  for (let x = -h; x < w; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); }
  g.globalAlpha = 1;
  g.textBaseline = 'alphabetic';
  return { cv, g };
}

export function header(g, kicker, name) {
  g.fillStyle = '#ffffff99'; g.font = '600 20px ' + FONT;
  g.fillText(kicker, PAD, PAD + 22);
  g.fillStyle = '#fff'; g.font = 'bold 48px ' + FONT;
  g.fillText(fit(g, name, 620), PAD, PAD + 82);
}

export function stat(g, label, val, x, color, big) {
  g.textAlign = 'right';
  g.fillStyle = '#ffffff99'; g.font = '600 16px ' + FONT;
  g.fillText(label, x, PAD + 30);
  g.fillStyle = color; g.font = 'bold ' + (big ? 56 : 36) + 'px ' + FONT;
  g.fillText(val, x, PAD + (big ? 88 : 80));
  g.textAlign = 'left';
}

export function sectionTitle(g, label, y, color) {
  g.fillStyle = color; g.fillRect(PAD, y + 12, 6, 28);
  g.fillStyle = '#fff'; g.font = 'bold 26px ' + FONT;
  g.fillText(label, PAD + 16, y + 36);
}

// 难度 + 定数徽章，画在基线 y 处，返回宽度。卡片和书签的历史图共用。
// c：定数（0 = 未知，写「?」；省略 = 只写难度）；est：定数未公开、按等级估算。
// 写法同 maimai / 音击：14+（14.5〜14.9）写成「14⁺.7」，加号小一号、画在整数部分右上角；估算的写「14⁺.?」
export function diffBadge(g, diff, x, y, c, est) {
  const d = DIFFS[diff] || DIFFS[3];
  const ci = Math.floor((c || 0) + 1e-9);
  const head = d.short + (c == null ? '' : ' ' + (c ? ci : '?'));
  const plus = c > 0 && c - ci >= 0.5 - 1e-9;
  const tail = !c ? '' : est ? '.?' : '.' + Math.round((c - ci) * 10);
  g.font = 'bold 13px ' + FONT;
  const wHead = g.measureText(head).width, wTail = g.measureText(tail).width;
  g.font = 'bold 10px ' + FONT;
  const wPlus = plus ? g.measureText('+').width + 1 : 0;
  const bw = wHead + wPlus + wTail + 14;
  rrect(g, x, y - 15, bw, 20, 4);
  g.fillStyle = d.color; g.fill();
  if (d.key === 'ult') { g.strokeStyle = '#e33'; g.lineWidth = 1.5; g.stroke(); }
  g.fillStyle = '#fff';
  g.font = 'bold 13px ' + FONT; g.fillText(head, x + 7, y);
  if (plus) { g.font = 'bold 10px ' + FONT; g.fillText('+', x + 7 + wHead, y - 6); }
  g.font = 'bold 13px ' + FONT; g.fillText(tail, x + 7 + wHead + wPlus, y);
  return bw;
}

export function card(g, s, label, x, y) {
  const w = CW, h = CH;
  const d = DIFFS[s.diff] || DIFFS[3];
  rrect(g, x, y, w, h, 10);
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fill();
  g.lineWidth = 2; g.strokeStyle = d.key === 'ult' ? '#e8e8e8' : d.color; g.stroke();

  // 曲绘
  const J = h - 16, jx = x + 8, jy = y + 8;
  g.save(); rrect(g, jx, jy, J, J, 6); g.clip();
  if (s.img) g.drawImage(s.img, jx, jy, J, J);
  else { g.fillStyle = '#ffffff1a'; g.fillRect(jx, jy, J, J); g.fillStyle = '#ffffff55'; g.font = '12px ' + FONT; g.fillText('NO IMAGE', jx + 18, jy + J / 2 + 4); }
  g.restore();
  // 序号
  g.font = 'bold 13px ' + FONT;
  const lw = Math.max(34, g.measureText(label).width + 10);
  g.fillStyle = 'rgba(0,0,0,.7)'; rrect(g, jx, jy, lw, 20, 5); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.fillText(label, jx + lw / 2, jy + 15); g.textAlign = 'left';

  const tx = jx + J + 10, tw = x + w - tx - 10;
  g.fillStyle = '#fff'; g.font = 'bold 16px ' + FONT;
  g.fillText(fit(g, s.title, tw), tx, y + 28);

  const bw = diffBadge(g, s.diff, tx, y + 53, s.constant || 0, s.estimated);
  const rk = scoreRank(s.score);
  g.fillStyle = rk.startsWith('SSS') ? '#ffd65a' : rk.startsWith('SS') ? '#ffe9a8' : '#ddd';
  g.font = 'bold 15px ' + FONT;
  g.fillText(rk, tx + bw + 8, y + 54);
  if (s.lamp) {
    const rw = g.measureText(rk).width;
    g.fillStyle = s.lamp === 'FC' ? '#7ee0ff' : '#ffb86b';
    g.font = 'bold 13px ' + FONT;
    g.fillText(s.lamp, tx + bw + 8 + rw + 8, y + 54);
  }

  g.fillStyle = '#fff'; g.font = 'bold 22px ' + FONT;
  g.fillText(s.score.toLocaleString('en-US'), tx, y + h - 16);
  g.textAlign = 'right';
  g.fillStyle = '#ffd65a'; g.font = 'bold 20px ' + FONT;
  g.fillText(floor2(s.rating), x + w - 10, y + h - 16);
  g.textAlign = 'left';
}

// B50 图。rating：游戏内 Rating 的文字（没有时用 (B30+N20)/50 的计算值）；footer：页脚文字（书签写生成日期，面板写快照时间）
export function drawB50({ name, rating, best, news, footer }) {
  const HEAD = 190, SEC = 56, FOOT = 50;
  const H = HEAD + SEC + rows(best.length) * (CH + GAP) + SEC + rows(news.length) * (CH + GAP) + FOOT;
  const { cv, g } = newCanvas(H);
  const sum = (l) => l.reduce((a, s) => a + s.rating, 0);
  const bAvg = best.length ? sum(best) / best.length : 0;
  const nAvg = news.length ? sum(news) / news.length : 0;
  const total = (sum(best) + sum(news)) / 50;

  header(g, 'CHUNITHM  RATING  BEST 50', String(name || ''));
  const rx = W - PAD;
  stat(g, 'RATING', rating || floor2(total), rx, '#ffd65a', true);
  stat(g, 'NEW 20 AVG', floor2(nAvg), rx - 260, '#7ee0ff');
  stat(g, 'BEST 30 AVG', floor2(bAvg), rx - 460, '#c9a2ff');
  g.fillStyle = '#ffffff80'; g.font = '14px ' + FONT; g.textAlign = 'right';
  g.fillText('计算值 (B30+N20)/50 = ' + floor2(total) + '　·　单曲最高 ' + floor2(Math.max(0, ...[...best, ...news].map((s) => s.rating))), rx, PAD + 122);
  g.textAlign = 'left';
  g.fillStyle = '#ffffff33'; g.fillRect(PAD, HEAD - 22, W - PAD * 2, 2);

  let y = HEAD;
  const section = (label, list, color) => {
    sectionTitle(g, label, y, color);
    y += SEC;
    list.forEach((s, i) => card(g, s, '#' + (i + 1), PAD + (i % COLS) * (CW + GAP), y + Math.floor(i / COLS) * (CH + GAP)));
    y += rows(list.length) * (CH + GAP);
  };
  section('BEST 30', best, '#c9a2ff');
  section('NEW 20', news, '#7ee0ff');
  g.fillStyle = '#ffffff66'; g.font = '13px ' + FONT;
  g.fillText(footer, PAD, H - 20);
  return cv;
}
