// Opslag (localStorage) en kleine hulpfuncties.
import { EXERCISES } from './data.js';

const KEY = 'lifegame.v1';

export const DEFAULT_SETTINGS = {
  waterGoal: 2000,        // ml
  proteinGoal: 120,       // gram
  sleepGoal: 8,           // uur
  bedtime: '23:00',
  bodyweight: 75,         // kg
  restSeconds: 90,
  restOn: true,
  weeklyWorkouts: 3,
  quests: { water: true, protein: true, sleep: true, compliment: true, tasks: true },
};

function fresh() {
  return {
    version: 1,
    created: todayKey(),
    settings: structuredClone(DEFAULT_SETTINGS),
    days: {},            // 'YYYY-MM-DD' -> { water, protein, sleep:{bed,wake}, compliments:[] }
    tasks: [],           // afspraken / taken / herinneringen
    workouts: [],        // afgeronde trainingen
    routines: [],
    customExercises: [],
    active: null,        // lopende training
    rest: null,          // { end, total }
    seenBadges: null,    // null = nog nooit berekend (geen meldingen bij eerste keer)
    lastLevel: null,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const base = fresh();
      return { ...base, ...s, settings: { ...base.settings, ...s.settings, quests: { ...base.settings.quests, ...(s.settings?.quests || {}) } } };
    }
  } catch (e) { console.error('Laden mislukt', e); }
  return fresh();
}

export let state = load();
export let version = 0;

export function save() {
  version++;
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('Opslaan mislukt', e); }
}

export function replaceState(s) {
  const base = fresh();
  state = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
  save();
}

export function resetState() {
  state = fresh();
  save();
}

// ---------- datums ----------
function pad(n) { return String(n).padStart(2, '0'); }
export function keyOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function todayKey() { return keyOf(new Date()); }
export function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); }
export function diffDays(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 864e5); }
export function weekKey(k) { // maandag van die week
  const d = parseKey(k); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return keyOf(d);
}
var DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
var MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export function fmtDate(k, long = false) {
  const d = parseKey(k);
  if (long) {
    const t = todayKey();
    if (k === t) return 'Vandaag';
    if (k === addDays(t, -1)) return 'Gisteren';
    if (k === addDays(t, 1)) return 'Morgen';
  }
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function fmtShort(k) { const d = parseKey(k); return `${d.getDate()}/${d.getMonth() + 1}`; }
export function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}u ${pad(m)}m` : `${m}:${pad(sec)}`;
}
export function fmtClock(ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

// ---------- dagen ----------
export function peekDay(k) {
  return state.days[k] || { water: 0, protein: 0, sleep: null, compliments: [] };
}
export function day(k) {
  if (!state.days[k]) state.days[k] = { water: 0, protein: 0, sleep: null, compliments: [] };
  return state.days[k];
}
export function sleepMinutes(sl) {
  if (!sl || !sl.bed || !sl.wake) return null;
  const [bh, bm] = sl.bed.split(':').map(Number);
  const [wh, wm] = sl.wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins <= 0) mins += 1440;
  return mins;
}

// ---------- oefeningen ----------
export function allExercises() { return [...EXERCISES, ...state.customExercises]; }
export function getExercise(id) {
  return EXERCISES.find(e => e.id === id) || state.customExercises.find(e => e.id === id)
    || { id, name: id, primary: [], secondary: [], kind: 'weight', missing: true };
}

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
export function num(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function fmtNum(n, dec = 0) {
  if (n == null) return '–';
  return Number(n).toLocaleString('nl-NL', { maximumFractionDigits: dec });
}
