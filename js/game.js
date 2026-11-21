// Spelregels: XP, levels, records, quests en streaks.
// Alles wordt afgeleid uit de ruwe gegevens, zodat aanpassen of verwijderen altijd klopt.
import { state, getExercise, sleepMinutes, peekDay, todayKey, addDays, weekKey, keyOf } from './store.js';
import { MUSCLES, SKILLS } from './data.js';

export const XP = {
  workout: 50, perSet: 5, pr: 50, weeklyGoal: 100,
  water: 80, waterBonus: 30,
  protein: 70, proteinBonus: 30,
  sleep: 60, bedtimeBonus: 30,
  compliment: 15, complimentCap: 10,
  task: 25, taskOnTime: 15,
  perfectDay: 100, streakStep: 10, streakCap: 100,
};

const CURVE = { player: [100, 50], skill: [50, 25], muscle: [150, 75] };

export function levelInfo(xp, curve = 'player') {
  const [base, step] = CURVE[curve];
  let level = 1, need = base, rest = xp;
  while (rest >= need) { rest -= need; level++; need = base + step * (level - 1); }
  return { xp: Math.round(xp), level, into: Math.round(rest), need, pct: rest / need };
}

// ---------- sets ----------
export function setValid(kind, s) {
  if (!s) return false;
  if (kind === 'time') return s.sec > 0;
  if (kind === 'cardio') return s.min > 0 || s.km > 0;
  return s.reps > 0;
}
export function setVolume(kind, s, bw) {
  switch (kind) {
    case 'weight': return (s.kg || 0) * s.reps;
    case 'bw': return (bw * 0.6 + (s.kg || 0)) * s.reps;
    case 'time': return s.sec * 5;
    case 'cardio': return (s.min || 0) * 50 + (s.km || 0) * 100;
  }
  return 0;
}
export function e1rm(kg, reps) {
  if (!kg || !reps) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}
export function fmtSet(kind, s) {
  if (!s) return '–';
  const n = v => String(Math.round(v * 100) / 100).replace('.', ',');
  if (kind === 'time') return `${n(s.sec)} s`;
  if (kind === 'cardio') return [s.km ? `${n(s.km)} km` : '', s.min ? `${n(s.min)} min` : ''].filter(Boolean).join(' · ');
  if (kind === 'bw') return s.kg ? `+${n(s.kg)}kg × ${s.reps}` : `${s.reps} reps`;
  return `${n(s.kg || 0)}kg × ${s.reps}`;
}

function toMinFrom18(t) { const [h, m] = t.split(':').map(Number); return (h * 60 + m - 1080 + 1440) % 1440; }
export function bedtimeOk(bed, target) { return toMinFrom18(bed) <= toMinFrom18(target); }

// ---------- quests ----------
export function questsFor(d) {
  const S = state.settings, q = S.quests, dd = peekDay(d), list = [];
  if (q.water) list.push({ id: 'water', icon: '💧', name: `${S.waterGoal} ml water`, done: dd.water >= S.waterGoal, cur: dd.water, goal: S.waterGoal });
  if (q.protein) list.push({ id: 'protein', icon: '🥩', name: `${S.proteinGoal} g eiwit`, done: dd.protein >= S.proteinGoal, cur: dd.protein, goal: S.proteinGoal });
  if (q.sleep) {
    const mins = sleepMinutes(dd.sleep);
    list.push({ id: 'sleep', icon: '😴', name: `${String(S.sleepGoal).replace('.', ',')} uur slaap`, done: mins != null && mins >= S.sleepGoal * 60 - 15, cur: mins ? Math.round(mins / 6) / 10 : 0, goal: S.sleepGoal });
  }
  if (q.compliment) list.push({ id: 'compliment', icon: '💬', name: 'Compliment geven', done: dd.compliments.length >= 1, cur: dd.compliments.length, goal: 1 });
  if (q.tasks) {
    const due = state.tasks.filter(t => t.date === d);
    if (due.length) {
      const done = due.filter(t => t.done && t.doneAt && keyOf(new Date(t.doneAt)) <= d).length;
      list.push({ id: 'tasks', icon: '📅', name: 'Afspraken van de dag', done: done === due.length, cur: done, goal: due.length });
    }
  }
  return list;
}

export function taskOnTime(t) {
  if (!t.done || !t.doneAt) return false;
  const end = new Date(`${t.date}T${t.time || '23:59'}:59`);
  return t.doneAt <= end.getTime();
}

// ---------- de grote berekening ----------
export function computeAll() {
  const S = state.settings;
  const today = todayKey();
  const events = [];
  const add = (date, skill, xp, label) => { if (xp > 0) events.push({ date, skill, xp: Math.round(xp), label }); };

  // Trainingen
  const muscleXp = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, 0]));
  const weekSets = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, 0]));
  const bests = {};
  const workoutStats = {};
  const weekCount = {};
  const weekAgo = addDays(today, -6);
  let totalVolume = 0, totalPrs = 0, maxWorkoutVolume = 0;
  const lifts = { bench: 0, squat: 0, deadlift: 0, ohp: 0 };

  const ws = [...state.workouts].sort((a, b) => a.start - b.start);
  for (const w of ws) {
    const date = keyOf(new Date(w.start));
    const st = { volume: 0, sets: 0, xp: 0, muscleXp: {}, prs: [], cardioMin: 0 };
    for (const ex of w.exercises) {
      const e = getExercise(ex.exId);
      const prev = bests[ex.exId];
      const cur = { maxKg: 0, e1rm: 0, maxReps: 0, maxSec: 0, volume: 0, km: 0, min: 0 };
      for (const s of ex.sets) {
        if (!setValid(e.kind, s)) continue;
        const warm = s.type === 'warmup';
        st.sets++;
        const vol = setVolume(e.kind, s, S.bodyweight);
        if (e.kind === 'weight' || e.kind === 'bw') { st.volume += vol; cur.volume += vol; }
        if (e.kind === 'cardio') { st.cardioMin += s.min || 0; cur.km += s.km || 0; cur.min += s.min || 0; }
        const mx = vol / 10 * (warm ? 0.5 : 1);
        for (const m of e.primary) { st.muscleXp[m] = (st.muscleXp[m] || 0) + mx; if (date >= weekAgo) weekSets[m] += 1; }
        for (const m of e.secondary) { st.muscleXp[m] = (st.muscleXp[m] || 0) + mx * 0.5; if (date >= weekAgo) weekSets[m] += 0.5; }
        if (warm) continue;
        if (e.kind === 'weight') {
          cur.maxKg = Math.max(cur.maxKg, s.kg || 0);
          cur.e1rm = Math.max(cur.e1rm, e1rm(s.kg, s.reps));
        } else if (e.kind === 'bw') {
          cur.maxReps = Math.max(cur.maxReps, s.reps);
        } else if (e.kind === 'time') {
          cur.maxSec = Math.max(cur.maxSec, s.sec);
        }
      }
      if (prev) {
        if (cur.maxKg > prev.maxKg) st.prs.push({ exId: ex.exId, type: 'kg', label: 'Zwaarste gewicht', value: cur.maxKg });
        if (cur.e1rm > prev.e1rm + 0.01) st.prs.push({ exId: ex.exId, type: 'e1rm', label: 'Beste geschatte 1RM', value: cur.e1rm });
        if (cur.maxReps > prev.maxReps) st.prs.push({ exId: ex.exId, type: 'reps', label: 'Meeste herhalingen', value: cur.maxReps });
        if (cur.maxSec > prev.maxSec) st.prs.push({ exId: ex.exId, type: 'sec', label: 'Langste tijd', value: cur.maxSec });
      }
      const b = bests[ex.exId] ||= { maxKg: 0, e1rm: 0, maxReps: 0, maxSec: 0, history: [] };
      b.maxKg = Math.max(b.maxKg, cur.maxKg); b.e1rm = Math.max(b.e1rm, cur.e1rm);
      b.maxReps = Math.max(b.maxReps, cur.maxReps); b.maxSec = Math.max(b.maxSec, cur.maxSec);
      b.history.push({ date, ...cur });

      const n = e.name.toLowerCase();
      if (e.kind === 'weight') {
        if (/bench press/.test(n) && !/close grip|dumbbell/.test(n)) lifts.bench = Math.max(lifts.bench, cur.maxKg);
        if (/^squat|front squat/.test(n)) lifts.squat = Math.max(lifts.squat, cur.maxKg);
        if (/^deadlift/.test(n)) lifts.deadlift = Math.max(lifts.deadlift, cur.maxKg);
        if (/overhead press/.test(n)) lifts.ohp = Math.max(lifts.ohp, cur.maxKg);
      }
    }
    for (const [m, v] of Object.entries(st.muscleXp)) muscleXp[m] += v;
    st.xp = st.sets ? XP.workout + st.sets * XP.perSet + st.prs.length * XP.pr + Math.round(st.cardioMin) : 0;
    add(date, 'training', st.xp, w.name);
    const wk = weekKey(date);
    weekCount[wk] = (weekCount[wk] || 0) + 1;
    if (weekCount[wk] === S.weeklyWorkouts) add(date, 'training', XP.weeklyGoal, 'Weekdoel gehaald');
    totalVolume += st.volume; totalPrs += st.prs.length; maxWorkoutVolume = Math.max(maxWorkoutVolume, st.volume);
    workoutStats[w.id] = st;
  }

  // Dagelijkse dingen
  const dayKeys = Object.keys(state.days);
  let start = [state.created, ...dayKeys].sort()[0] || today;
  const perfect = {};
  let streak = 0, bestStreak = 0, perfectDays = 0;
  const runs = { water: [0, 0], protein: [0, 0], sleep: [0, 0] }; // [huidig, beste]
  let bedtimeCount = 0, complimentsTotal = 0, waterTotal = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const dd = peekDay(d);
    if (dd.water) add(d, 'voeding', Math.min(dd.water, S.waterGoal) / S.waterGoal * XP.water, 'Water');
    if (dd.water >= S.waterGoal) add(d, 'voeding', XP.waterBonus, 'Waterdoel');
    if (dd.protein) add(d, 'voeding', Math.min(dd.protein, S.proteinGoal) / S.proteinGoal * XP.protein, 'Eiwit');
    if (dd.protein >= S.proteinGoal) add(d, 'voeding', XP.proteinBonus, 'Eiwitdoel');
    const mins = sleepMinutes(dd.sleep);
    if (mins) {
      add(d, 'slaap', Math.min(mins / (S.sleepGoal * 60), 1) * XP.sleep, 'Slaap');
      if (bedtimeOk(dd.sleep.bed, S.bedtime)) { add(d, 'slaap', XP.bedtimeBonus, 'Op tijd naar bed'); bedtimeCount++; }
    }
    const nc = dd.compliments.length;
    complimentsTotal += nc; waterTotal += dd.water || 0;
    add(d, 'sociaal', Math.min(nc, XP.complimentCap) * XP.compliment, 'Complimenten');

    const qs = questsFor(d);
    const isToday = d === today;
    for (const k of ['water', 'protein', 'sleep']) {
      const q = qs.find(x => x.id === k);
      if (q?.done) { runs[k][0]++; runs[k][1] = Math.max(runs[k][1], runs[k][0]); }
      else if (!isToday) runs[k][0] = 0;
    }
    const isPerfect = qs.length > 0 && qs.every(x => x.done);
    perfect[d] = isPerfect;
    if (isPerfect) {
      streak++; perfectDays++;
      bestStreak = Math.max(bestStreak, streak);
      add(d, 'bonus', XP.perfectDay + Math.min(streak * XP.streakStep, XP.streakCap), `Perfecte dag (streak ${streak})`);
    } else if (!isToday) streak = 0;
  }

  // Afspraken
  let tasksDone = 0, tasksOnTime = 0;
  for (const t of state.tasks) {
    if (!t.done || !t.doneAt) continue;
    tasksDone++;
    const mult = t.priority === 'high' ? 2 : 1;
    const on = taskOnTime(t);
    if (on) tasksOnTime++;
    add(keyOf(new Date(t.doneAt)), 'afspraken', (XP.task + (on ? XP.taskOnTime : 0)) * mult, t.title);
  }

  // Optellen
  const skills = Object.fromEntries(Object.keys(SKILLS).map(k => [k, 0]));
  const dayXp = {};
  let total = 0;
  for (const ev of events) {
    total += ev.xp;
    if (skills[ev.skill] != null) skills[ev.skill] += ev.xp;
    dayXp[ev.date] = (dayXp[ev.date] || 0) + ev.xp;
  }

  const muscles = {};
  for (const m of Object.keys(MUSCLES)) muscles[m] = { ...levelInfo(muscleXp[m], 'muscle'), weekSets: weekSets[m] };

  return {
    events, dayXp, perfect,
    player: levelInfo(total, 'player'),
    skills: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, levelInfo(v, 'skill')])),
    muscles, bests, workoutStats,
    streak, bestStreak, perfectDays,
    counters: {
      workouts: ws.length, totalVolume, maxWorkoutVolume, totalPrs, lifts,
      complimentsTotal, waterTotal, tasksDone, tasksOnTime, bedtimeCount, perfectDays, bestStreak,
      waterBest: runs.water[1], proteinBest: runs.protein[1], sleepBest: runs.sleep[1],
    },
  };
}

// Vorige prestaties van een oefening (voor de "Vorige"-kolom).
export function previousSets(exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const w = state.workouts[i];
    const ex = w.exercises.find(e => e.exId === exId);
    if (ex && ex.sets.length) return ex.sets;
  }
  return null;
}

// XP die een lopende training nu waard zou zijn (indicatie).
export function liveWorkoutXp(active, G) {
  let sets = 0, prs = 0;
  for (const ex of active.exercises) {
    const e = getExercise(ex.exId);
    const b = G.bests[ex.exId];
    let kg = 0, r = 0, reps = 0, sec = 0;
    for (const s of ex.sets) {
      if (!s.done || !setValid(e.kind, s)) continue;
      sets++;
      if (s.type === 'warmup') continue;
      kg = Math.max(kg, s.kg || 0); r = Math.max(r, e1rm(s.kg, s.reps)); reps = Math.max(reps, s.reps || 0); sec = Math.max(sec, s.sec || 0);
    }
    if (b) {
      if (e.kind === 'weight') { if (kg > b.maxKg) prs++; if (r > b.e1rm + 0.01) prs++; }
      if (e.kind === 'bw' && reps > b.maxReps) prs++;
      if (e.kind === 'time' && sec > b.maxSec) prs++;
    }
  }
  return { sets, prs, xp: sets ? XP.workout + sets * XP.perSet + prs * XP.pr : 0 };
}

// Is deze ene set een record t.o.v. eerdere trainingen?
export function setIsPr(exId, kind, s, G) {
  const b = G.bests[exId];
  if (!b || !s.done || s.type === 'warmup' || !setValid(kind, s)) return false;
  if (kind === 'weight') return (s.kg || 0) > b.maxKg || e1rm(s.kg, s.reps) > b.e1rm + 0.01;
  if (kind === 'bw') return s.reps > b.maxReps;
  if (kind === 'time') return s.sec > b.maxSec;
  return false;
}
