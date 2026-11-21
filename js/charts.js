// Eenvoudige SVG-grafieken zonder externe bibliotheek (werkt ook offline).
import { esc } from './store.js';

const W = 340, PAD_L = 34, PAD_R = 8, PAD_T = 14, PAD_B = 22;

// Kies een maximum dat in 4 mooie stappen deelbaar is (bijv. 0-500-1000-1500-2000).
function niceMax(v) {
  if (v <= 0) return 4;
  const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p * 4;
  return 40 * p;
}
const fmtAxis = v => v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1).replace('.0', '').replace('.', ',')}k` : String(Math.round(v * 10) / 10).replace('.', ',');

function axes(H, max, n = 4) {
  let s = '';
  for (let i = 0; i <= n; i++) {
    const v = max * i / n, y = H - PAD_B - (H - PAD_T - PAD_B) * i / n;
    s += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y}" y2="${y}" class="grid"/>`;
    s += `<text x="${PAD_L - 5}" y="${y + 3.5}" class="ax" text-anchor="end">${fmtAxis(v)}</text>`;
  }
  return s;
}

// data: [{label, value, title}]
export function barChart(data, { height = 170, color = 'var(--accent)', goal = null, unit = '', labelEvery = 1, hitColor = null } = {}) {
  const H = height;
  const max = niceMax(Math.max(goal || 0, ...data.map(d => d.value)) * 1.05);
  const iw = W - PAD_L - PAD_R, bw = iw / data.length;
  let s = axes(H, max);
  data.forEach((d, i) => {
    const h = (H - PAD_T - PAD_B) * (d.value / max);
    const x = PAD_L + i * bw + bw * 0.18, y = H - PAD_B - h;
    const c = hitColor && goal && d.value >= goal ? hitColor : color;
    s += `<rect x="${x}" y="${y}" width="${bw * 0.64}" height="${Math.max(h, d.value ? 1.5 : 0)}" rx="3" fill="${c}"><title>${esc(d.title || d.label)}: ${esc(fmtAxis(d.value))} ${unit}</title></rect>`;
    if (i % labelEvery === 0 || i === data.length - 1) s += `<text x="${x + bw * 0.32}" y="${H - 7}" class="ax" text-anchor="middle">${esc(d.label)}</text>`;
  });
  if (goal) {
    const y = H - PAD_B - (H - PAD_T - PAD_B) * (goal / max);
    s += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y}" y2="${y}" class="goal"/><text x="${W - PAD_R}" y="${y - 4}" class="ax goal-t" text-anchor="end">doel</text>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${s}</svg>`;
}

// data: [{label, value}]
export function lineChart(data, { height = 170, color = 'var(--accent)', unit = '', labelEvery = 1 } = {}) {
  const H = height;
  if (!data.length) return '<p class="muted small">Nog geen gegevens.</p>';
  const vals = data.map(d => d.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const min = Math.max(0, Math.floor((lo - (hi - lo) * 0.2) / 5) * 5);
  const max = min + niceMax((hi - min) * 1.15 || 10);
  const iw = W - PAD_L - PAD_R, ih = H - PAD_T - PAD_B;
  const X = i => PAD_L + (data.length === 1 ? iw / 2 : iw * i / (data.length - 1));
  const Y = v => H - PAD_B - ih * (v - min) / (max - min);
  let s = '';
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4, y = Y(v);
    s += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y}" y2="${y}" class="grid"/><text x="${PAD_L - 5}" y="${y + 3.5}" class="ax" text-anchor="end">${fmtAxis(v)}</text>`;
  }
  const pts = data.map((d, i) => `${X(i)},${Y(d.value)}`).join(' ');
  s += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  data.forEach((d, i) => {
    s += `<circle cx="${X(i)}" cy="${Y(d.value)}" r="3.5" fill="${color}"><title>${esc(d.label)}: ${esc(fmtAxis(d.value))} ${unit}</title></circle>`;
    const last = i === data.length - 1;
    if (i % labelEvery === 0 || last) s += `<text x="${X(i)}" y="${H - 7}" class="ax" text-anchor="${last && data.length > 1 ? 'end' : i === 0 && data.length > 1 ? 'start' : 'middle'}">${esc(d.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${s}</svg>`;
}

// Horizontale balken: [{label, value, sub}]
export function hBars(data, { color = 'var(--accent)', max = null, unit = '' } = {}) {
  const m = max || Math.max(1, ...data.map(d => d.value));
  return `<div class="hbars">${data.map(d => `
    <div class="hbar"><span class="hbar-l">${esc(d.label)}</span>
      <span class="hbar-t"><span class="hbar-f" style="width:${Math.min(100, d.value / m * 100)}%;background:${d.color || color}"></span></span>
      <span class="hbar-v">${esc(fmtAxis(d.value))}${unit}</span></div>`).join('')}</div>`;
}
