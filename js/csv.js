// Import van een Hevy CSV-export (Profiel → Instellingen → Export & Import → Export Workouts).
import { state, allExercises, uid, keyOf, setMeasurement } from './store.js';
import { slug, guessExercise } from './data.js';

export function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const MON = { jan: 0, feb: 1, mar: 2, mrt: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11 };
export function parseHevyDate(s) {
  if (!s) return null;
  let m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (m && MON[m[2].toLowerCase()] != null) return new Date(+m[3], MON[m[2].toLowerCase()], +m[1], +m[4], +m[5]).getTime();
  m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

const n = v => { if (v == null || v === '') return null; const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };

export function importHevy(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('Leeg bestand');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = name => head.indexOf(name);
  const C = {
    title: col('title'), start: col('start_time'), end: col('end_time'), ex: col('exercise_title'),
    type: col('set_type'), kg: col('weight_kg'), lbs: col('weight_lbs'), reps: col('reps'),
    km: col('distance_km'), mi: col('distance_miles'), dur: col('duration_seconds'),
  };
  if (C.start < 0 || C.ex < 0) throw new Error('Dit lijkt geen Hevy-export (kolommen start_time / exercise_title ontbreken).');

  const groups = new Map();
  for (const r of rows.slice(1)) {
    const start = parseHevyDate(r[C.start]);
    if (!start) continue;
    const key = `${r[C.title]}|${start}`;
    if (!groups.has(key)) groups.set(key, { title: r[C.title] || 'Training', start, end: parseHevyDate(r[C.end]) || start, rows: [] });
    groups.get(key).rows.push(r);
  }

  const existing = new Set(state.workouts.map(w => w.start));
  const byName = new Map(allExercises().map(e => [e.name.toLowerCase(), e]));
  const created = [];
  let added = 0, skipped = 0, sets = 0;

  for (const g of [...groups.values()].sort((a, b) => a.start - b.start)) {
    if (existing.has(g.start)) { skipped++; continue; }
    const w = { id: uid(), name: g.title, start: g.start, end: g.end, exercises: [], imported: true };
    for (const r of g.rows) {
      const name = (r[C.ex] || '').trim();
      if (!name) continue;
      const kg = C.kg >= 0 ? n(r[C.kg]) : (C.lbs >= 0 && n(r[C.lbs]) != null ? n(r[C.lbs]) * 0.4536 : null);
      const reps = n(r[C.reps]);
      const km = C.km >= 0 ? n(r[C.km]) : (C.mi >= 0 && n(r[C.mi]) != null ? n(r[C.mi]) * 1.609 : null);
      const sec = n(r[C.dur]);
      let e = byName.get(name.toLowerCase());
      if (!e) {
        const g2 = guessExercise(name, { hasWeight: !!kg, hasReps: !!reps, hasDistance: !!km, hasDuration: !!sec });
        e = { id: 'c-' + slug(name), name, ...g2, custom: true, guessed: true };
        state.customExercises.push(e);
        byName.set(name.toLowerCase(), e);
        created.push(e);
      }
      let ex = w.exercises[w.exercises.length - 1];
      if (!ex || ex.exId !== e.id) { ex = { exId: e.id, sets: [] }; w.exercises.push(ex); }
      const t = (r[C.type] || 'normal').toLowerCase();
      const set = { type: t.startsWith('warm') ? 'warmup' : t.startsWith('fail') ? 'failure' : t.startsWith('drop') ? 'drop' : 'normal', done: true };
      if (e.kind === 'cardio') { set.km = km || 0; set.min = sec ? Math.round(sec / 6) / 10 : 0; }
      else if (e.kind === 'time') set.sec = sec || 0;
      else { set.kg = kg || 0; set.reps = reps || 0; }
      ex.sets.push(set); sets++;
    }
    if (w.exercises.length) { state.workouts.push(w); added++; }
  }
  state.workouts.sort((a, b) => a.start - b.start);
  return { added, skipped, sets, created };
}

export function csvKind(text) {
  const head = (parseCSV(text.split(/\r?\n/)[0])[0] || []).map(h => h.trim().toLowerCase());
  if (head.includes('exercise_title')) return 'workouts';
  if (head.includes('date') && head.some(h => h.endsWith('_cm') || h === 'weight_kg')) return 'measurements';
  return null;
}

// Hevy "Export Measurements": date, weight_kg, fat_percent, neck_cm, ...
export function importHevyMeasurements(text) {
  const rows = parseCSV(text);
  const head = rows[0].map(h => h.trim().toLowerCase());
  const di = head.indexOf('date');
  let count = 0;
  for (const r of rows.slice(1)) {
    const t = parseHevyDate(r[di]);
    if (!t) continue;
    const vals = {};
    head.forEach((h, i) => { if (i !== di) { const v = n(r[i]); if (v != null) vals[h] = v; } });
    if (!Object.keys(vals).length) continue;
    setMeasurement(keyOf(new Date(t)), vals);
    count++;
  }
  return { count };
}
