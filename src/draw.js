// 三个游戏的图片样式（draw-chunithm.js / draw-maimai.js / draw-ongeki.js）共用的画图小工具。
// 这几个文件不依赖面板的其他部分，三个书签运行时也从这里加载（见各 draw-*.js 开头）
export function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function fit(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// B50 图的头部（照 CHUNITHM 的写法）：左边小字标题 + 大号玩家名；右边大号 Rating，左边依次是各枠的数值；最下面一行小字说明（右对齐）。
// 右边每一项先量宽度再从右往左排，玩家名写到最左一项前面为止。
// f(字重, 字号)：字体；C：{ kicker, fg, muted, rating }；stats：[[标签, 数值, 颜色]]（从左往右的顺序，颜色可省略）
export function profileHeader(g, { W, PAD, f, C, kicker, name, rating, ratingLabel = 'RATING', stats = [], note }) {
  const LABEL = PAD + 26, VALUE = PAD + 84; // 标签、数值的基线；数值和玩家名底边对齐
  let x = W - PAD;
  g.textAlign = 'right';
  for (const [label, value, color, px] of [[ratingLabel, rating, C.rating, 60], ...stats.slice().reverse().map(([l, v, c]) => [l, v, c || C.fg, 36])]) {
    g.font = f(700, 15); g.fillStyle = C.muted;
    const lw = g.measureText(label).width;
    g.fillText(label, x, LABEL);
    g.font = f(800, px); g.fillStyle = color;
    const vw = g.measureText(String(value)).width;
    g.fillText(String(value), x, VALUE);
    x -= Math.max(lw, vw) + 44;
  }
  if (note) { g.font = f(500, 14); g.fillStyle = C.muted; g.fillText(fit(g, note, W - PAD * 2), W - PAD, PAD + 120); }
  g.textAlign = 'left';
  g.fillStyle = C.kicker; g.font = f(800, 18); g.fillText(fit(g, kicker, x - PAD), PAD, PAD + 22);
  if (name) { g.fillStyle = C.fg; g.font = f(800, 52); g.fillText(fit(g, name, x - PAD), PAD, VALUE); }
}
