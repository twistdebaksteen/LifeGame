// Gestileerd lichaam (voor- en achterkant) waarbij spieren kleuren naar intensiteit.
import { MUSCLES } from './data.js';

// Vormen per spiergroep: [type, ...attributen]
const FRONT = {
  traps:     [['path', 'M41 34 L50 38 L59 34 L62 40 L50 42 L38 40 Z']],
  shoulders: [['ellipse', 29, 47, 8, 8], ['ellipse', 71, 47, 8, 8]],
  chest:     [['rect', 33, 42, 16.5, 20, 6], ['rect', 50.5, 42, 16.5, 20, 6]],
  biceps:    [['ellipse', 24, 68, 5, 11], ['ellipse', 76, 68, 5, 11]],
  forearms:  [['ellipse', 20.5, 94, 4.5, 13], ['ellipse', 79.5, 94, 4.5, 13]],
  abs:       [['rect', 39, 64, 22, 38, 6]],
  quads:     [['ellipse', 41.5, 134, 8.5, 24], ['ellipse', 58.5, 134, 8.5, 24]],
  calves:    [['ellipse', 41.5, 184, 5.5, 15], ['ellipse', 58.5, 184, 5.5, 15]],
};
const BACK = {
  traps:      [['path', 'M42 33 L50 36 L58 33 L66 42 L50 62 L34 42 Z']],
  shoulders:  [['ellipse', 29, 47, 8, 8], ['ellipse', 71, 47, 8, 8]],
  back:       [['path', 'M34 46 L48 64 L48 90 L38 86 L33 62 Z'], ['path', 'M66 46 L52 64 L52 90 L62 86 L67 62 Z']],
  triceps:    [['ellipse', 24, 68, 5, 11], ['ellipse', 76, 68, 5, 11]],
  forearms:   [['ellipse', 20.5, 94, 4.5, 13], ['ellipse', 79.5, 94, 4.5, 13]],
  lowerback:  [['rect', 41, 90, 18, 13, 4]],
  glutes:     [['ellipse', 42, 115, 9, 9.5], ['ellipse', 58, 115, 9, 9.5]],
  hamstrings: [['ellipse', 41.5, 146, 7.5, 20], ['ellipse', 58.5, 146, 7.5, 20]],
  calves:     [['ellipse', 41.5, 184, 6.5, 15], ['ellipse', 58.5, 184, 6.5, 15]],
};

function shape(s, cls, title) {
  const t = `<title>${title}</title>`;
  if (s[0] === 'ellipse') return `<ellipse cx="${s[1]}" cy="${s[2]}" rx="${s[3]}" ry="${s[4]}" class="${cls}">${t}</ellipse>`;
  if (s[0] === 'rect') return `<rect x="${s[1]}" y="${s[2]}" width="${s[3]}" height="${s[4]}" rx="${s[5]}" class="${cls}">${t}</rect>`;
  return `<path d="${s[1]}" class="${cls}">${t}</path>`;
}

function figure(map, values, label) {
  let s = `<circle cx="50" cy="17" r="10" class="body-base"/><rect x="45" y="26" width="10" height="9" rx="3" class="body-base"/>`;
  for (const [m, shapes] of Object.entries(map)) {
    const v = values[m] || 0;
    const lvl = v <= 0 ? 0 : v < 0.25 ? 1 : v < 0.5 ? 2 : v < 0.75 ? 3 : 4;
    for (const sh of shapes) s += shape(sh, `mus h${lvl}`, MUSCLES[m].name);
  }
  return `<figure class="body-fig"><svg viewBox="10 2 80 202">${s}</svg><figcaption>${label}</figcaption></figure>`;
}

// values: spiergroep -> 0..1
export function bodyMap(values) {
  return `<div class="body-map">${figure(FRONT, values, 'Voorkant')}${figure(BACK, values, 'Achterkant')}</div>
  <div class="heat-legend"><span>minder</span><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i><span>meer</span></div>`;
}
