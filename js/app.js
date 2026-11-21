import * as S from './store.js';
import { esc, fmtNum, fmtDate, todayKey, addDays, num, uid, getExercise, allExercises, peekDay, day, sleepMinutes } from './store.js';
import { MUSCLES, SKILLS, SET_TYPES, slug } from './data.js';
import { computeAll, questsFor, previousSets, liveWorkoutXp, setIsPr, setValid, setVolume, fmtSet, XP, taskOnTime, bedtimeOk, e1rm } from './game.js';
import { evalBadges } from './badges.js';
import { barChart, lineChart, hBars } from './charts.js';
import { bodyMap } from './body.js';
import { importHevy } from './csv.js';

const $ = s => document.querySelector(s);
const BODY = ['chest', 'back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'lowerback', 'glutes', 'quads', 'hamstrings', 'calves'];

const ui = {
  tab: 'today', date: todayKey(), workoutOpen: false, muscleMode: 'week',
  statsEx: null, historyLimit: 15, picker: { q: '', muscle: null },
};

let G, BADGES;
function recompute() { G = computeAll(); BADGES = evalBadges(G); }

// ---------------------------------------------------------------- kern
function commit({ silent = false } = {}) {
  const prevXp = G ? G.player.xp : 0;
  S.save();
  recompute();
  const delta = G.player.xp - prevXp;
  if (!silent && delta > 0) toast(`+${fmtNum(delta)} XP`, 'xp');
  checkProgress();
  render();
}

function checkProgress() {
  const st = S.state;
  const done = BADGES.filter(b => b.done).map(b => b.id);
  if (st.seenBadges == null) { st.seenBadges = done; st.lastLevel = G.player.level; S.save(); return; }
  const fresh = done.filter(id => !st.seenBadges.includes(id));
  for (const id of fresh) { const b = BADGES.find(x => x.id === id); toast(`${b.icon} Badge: ${b.name}`, 'badge'); }
  let changed = false;
  if (fresh.length) { st.seenBadges = [...st.seenBadges, ...fresh]; changed = true; }
  if (G.player.level > st.lastLevel) {
    const lvl = G.player.level;
    setTimeout(() => $('#modal').classList.contains('open') ? toast(`⬆️ Level ${lvl}!`, 'badge') : levelUp(lvl), 350);
  }
  if (G.player.level !== st.lastLevel) { st.lastLevel = G.player.level; changed = true; }
  if (changed) S.save();
}

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.textContent = text;
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2700);
}

function openModal(html, cls = '') {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet ${cls}"><div class="grab"></div>${html}</div>`;
  m.classList.add('open');
  document.body.classList.add('noscroll');
}
function closeModal() {
  const m = $('#modal'); m.classList.remove('open'); m.innerHTML = '';
  document.body.classList.remove('noscroll');
}

const bar = (pct, color = 'var(--accent)', cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct * 100))}%;background:${color}"></i></div>`;
const title = lvl => lvl >= 50 ? 'Legende' : lvl >= 35 ? 'Kampioen' : lvl >= 20 ? 'Held' : lvl >= 10 ? 'Avonturier' : lvl >= 5 ? 'Strijder' : 'Beginner';

// ---------------------------------------------------------------- render
function render() {
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const view = { today: viewToday, training: viewTraining, agenda: viewAgenda, stats: viewStats, profile: viewProfile }[ui.tab];
  $('#view').innerHTML = view();
  const wo = $('#workout');
  if (S.state.active && ui.workoutOpen) {
    const y = wo.scrollTop;
    wo.innerHTML = viewWorkout(); wo.classList.add('open'); wo.scrollTop = y;
    document.body.classList.add('noscroll');
  } else {
    wo.classList.remove('open'); wo.innerHTML = '';
    if (!$('#modal').classList.contains('open')) document.body.classList.remove('noscroll');
  }
  const mini = $('#mini');
  if (S.state.active && !ui.workoutOpen) {
    mini.innerHTML = `<button data-a="openWorkout"><span>🏋️ ${esc(S.state.active.name)}</span><b id="mini-elapsed">${S.fmtDuration(Date.now() - S.state.active.start)}</b><span class="go">Hervat ›</span></button>`;
    mini.hidden = false;
  } else mini.hidden = true;
  tick();
}

// ---------------------------------------------------------------- Vandaag
function viewToday() {
  const d = ui.date, today = todayKey(), isToday = d === today;
  const st = S.state.settings, dd = peekDay(d), P = G.player;
  const qs = questsFor(d);
  const qDone = qs.filter(q => q.done).length;
  const mins = sleepMinutes(dd.sleep);
  const tasks = S.state.tasks.filter(t => t.date === d).sort(byTime);
  const weekStart = S.weekKey(today);
  const weekW = S.state.workouts.filter(w => S.keyOf(new Date(w.start)) >= weekStart).length;
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;

  return `
  <div class="datebar">
    <button class="icon" data-a="day" data-n="-1" aria-label="Vorige dag">‹</button>
    <div><b>${fmtDate(d, true)}</b>${isToday ? '' : `<small>${fmtDate(d)}</small>`}</div>
    <button class="icon" data-a="day" data-n="1" ${isToday ? 'disabled' : ''} aria-label="Volgende dag">›</button>
  </div>

  ${standalone ? '' : `<div class="card hint">📲 <b>Tip:</b> tik in Safari op <b>Deel</b> → <b>Zet op beginscherm</b>. Dan werkt LifeGame als een echte app, ook offline.</div>`}

  <section class="card player-card">
    <div class="pc-top">
      <div class="lvl-badge"><small>LVL</small>${P.level}</div>
      <div class="pc-mid">
        <div class="pc-title">${title(P.level)}</div>
        ${bar(P.pct, 'var(--gold)', 'thick')}
        <div class="small muted">${fmtNum(P.into)} / ${fmtNum(P.need)} XP naar level ${P.level + 1}</div>
      </div>
    </div>
    <div class="pc-stats">
      <div><b>🔥 ${G.streak}</b><small>streak</small></div>
      <div><b>+${fmtNum(G.dayXp[d] || 0)}</b><small>XP ${isToday ? 'vandaag' : 'die dag'}</small></div>
      <div><b>${fmtNum(P.xp)}</b><small>totaal XP</small></div>
    </div>
  </section>

  <section class="card">
    <div class="card-h"><h3>Dagelijkse quests</h3><span class="pill ${qDone === qs.length && qs.length ? 'ok' : ''}">${qDone}/${qs.length}</span></div>
    <ul class="quests">${qs.map(q => `
      <li class="${q.done ? 'done' : ''}"><span class="qi">${q.icon}</span><span class="qn">${esc(q.name)}</span>
      <span class="qp">${q.id === 'sleep' ? `${String(q.cur).replace('.', ',')}u` : q.id === 'water' ? `${fmtNum(q.cur)} ml` : q.id === 'protein' ? `${fmtNum(q.cur)} g` : `${q.cur}/${q.goal}`}</span>
      <span class="qc">${q.done ? '✓' : ''}</span></li>`).join('')}
    </ul>
    <p class="small muted">Alles af = <b>+${XP.perfectDay} XP</b> + streakbonus (+${XP.streakStep} per dag op rij, max +${XP.streakCap}).</p>
  </section>

  <section class="card">
    <div class="card-h"><h3>💧 Water</h3><span class="big">${fmtNum(dd.water)}<small> / ${fmtNum(st.waterGoal)} ml</small></span></div>
    ${bar(dd.water / st.waterGoal, 'var(--water)', 'thick')}
    <div class="btnrow">
      <button class="chip-btn" data-a="water" data-n="-250">−250</button>
      <button class="chip-btn primary" data-a="water" data-n="250">+250 ml</button>
      <button class="chip-btn primary" data-a="water" data-n="500">+500 ml</button>
      <button class="chip-btn primary" data-a="water" data-n="750">+750 ml</button>
    </div>
  </section>

  <section class="card">
    <div class="card-h"><h3>🥩 Eiwit</h3><span class="big">${fmtNum(dd.protein)}<small> / ${fmtNum(st.proteinGoal)} g</small></span></div>
    ${bar(dd.protein / st.proteinGoal, 'var(--protein)', 'thick')}
    <div class="btnrow">
      <button class="chip-btn" data-a="protein" data-n="-10">−10</button>
      <button class="chip-btn primary" data-a="protein" data-n="10">+10 g</button>
      <button class="chip-btn primary" data-a="protein" data-n="20">+20 g</button>
      <button class="chip-btn primary" data-a="protein" data-n="30">+30 g</button>
    </div>
    <div class="inline-form"><input id="prot-custom" type="text" inputmode="decimal" placeholder="Ander aantal gram"><button class="chip-btn" data-a="proteinCustom">Toevoegen</button></div>
  </section>

  <section class="card">
    <div class="card-h"><h3>😴 Slaap</h3><span class="big">${mins ? `${Math.floor(mins / 60)}u ${String(mins % 60).padStart(2, '0')}m` : '–'}<small> / ${String(st.sleepGoal).replace('.', ',')}u</small></span></div>
    ${bar((mins || 0) / (st.sleepGoal * 60), 'var(--sleep)', 'thick')}
    <div class="sleep-row">
      <label>Naar bed<input type="time" data-sleep="bed" value="${esc(dd.sleep?.bed || '')}"></label>
      <label>Wakker<input type="time" data-sleep="wake" value="${esc(dd.sleep?.wake || '')}"></label>
    </div>
    <p class="small muted">De nacht vóór ${isToday ? 'vandaag' : fmtDate(d)}. Bedtijddoel ${esc(st.bedtime)}${dd.sleep?.bed ? (bedtimeOk(dd.sleep.bed, st.bedtime) ? ' — <span class="ok-t">op tijd ✓ +' + XP.bedtimeBonus + ' XP</span>' : ' — <span class="warn-t">te laat</span>') : ''}</p>
  </section>

  <section class="card">
    <div class="card-h"><h3>💬 Complimenten</h3><span class="big">${dd.compliments.length}</span></div>
    <div class="inline-form"><input id="comp-note" type="text" placeholder="Aan wie / waarvoor? (optioneel)"><button class="chip-btn primary" data-a="compliment">+ Gegeven</button></div>
    ${dd.compliments.length ? `<ul class="mini-list">${dd.compliments.map((c, i) => `<li><span class="muted">${S.fmtClock(c.t)}</span> ${esc(c.note || 'Compliment')}<button class="x" data-a="delCompliment" data-i="${i}" aria-label="Verwijder">×</button></li>`).join('')}</ul>` : ''}
    <p class="small muted">+${XP.compliment} XP per compliment (max ${XP.complimentCap} per dag).</p>
  </section>

  <section class="card">
    <div class="card-h"><h3>📅 Afspraken ${isToday ? 'vandaag' : ''}</h3><button class="link" data-a="newTask" data-date="${d}">+ Nieuw</button></div>
    ${tasks.length ? `<ul class="tasks">${tasks.map(taskRow).join('')}</ul>` : '<p class="muted small">Niets gepland.</p>'}
  </section>

  <section class="card">
    <div class="card-h"><h3>🏋️ Training deze week</h3><span class="big">${weekW}<small> / ${st.weeklyWorkouts}</small></span></div>
    ${bar(weekW / st.weeklyWorkouts, 'var(--accent)', 'thick')}
    <p class="small muted">Weekdoel gehaald = +${XP.weeklyGoal} XP bonus.</p>
    ${S.state.active ? `<button class="btn primary full" data-a="openWorkout">Hervat training</button>` : `<button class="btn primary full" data-a="startEmpty">Start training</button>`}
  </section>`;
}

const byTime = (a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'));
const TASK_TYPES = { afspraak: '📍 Afspraak', taak: '☑️ Taak', herinnering: '🔔 Herinnering' };
function taskXp(t) { return (XP.task + XP.taskOnTime) * (t.priority === 'high' ? 2 : 1); }
function taskRow(t) {
  const late = !t.done && (t.date < todayKey() || (t.date === todayKey() && t.time && t.time < S.fmtClock(Date.now())));
  return `<li class="task ${t.done ? 'done' : ''} ${late ? 'late' : ''}">
    <button class="check ${t.done ? 'on' : ''}" data-a="toggleTask" data-id="${t.id}" aria-label="Afvinken">${t.done ? '✓' : ''}</button>
    <div class="t-main" data-a="editTask" data-id="${t.id}">
      <div class="t-title">${t.priority === 'high' ? '⭐ ' : ''}${esc(t.title)}</div>
      <div class="t-sub">${TASK_TYPES[t.type] || ''}${t.time ? ` · ${esc(t.time)}` : ''}${t.repeat && t.repeat !== 'none' ? ' · 🔁' : ''}${t.done ? (taskOnTime(t) ? ' · op tijd ✓' : ' · te laat') : ` · +${taskXp(t)} XP`}</div>
    </div></li>`;
}

// ---------------------------------------------------------------- Training
function viewTraining() {
  const vals = {};
  if (ui.muscleMode === 'week') { for (const m of BODY) vals[m] = Math.min(1, G.muscles[m].weekSets / 12); }
  else { const mx = Math.max(1, ...BODY.map(m => G.muscles[m].level)); for (const m of BODY) vals[m] = G.muscles[m].xp ? G.muscles[m].level / mx : 0; }
  const ws = [...S.state.workouts].sort((a, b) => b.start - a.start);
  const list = ws.slice(0, ui.historyLimit);
  const muscles = [...BODY, 'cardio'].sort((a, b) => G.muscles[b].xp - G.muscles[a].xp);

  return `
  <h1 class="page-h">Training</h1>
  ${S.state.active
    ? `<button class="btn primary full big-btn" data-a="openWorkout">▶ Hervat: ${esc(S.state.active.name)}</button>`
    : `<button class="btn primary full big-btn" data-a="startEmpty">+ Start lege training</button>`}

  ${S.state.routines.length ? `<section class="card"><div class="card-h"><h3>Routines</h3></div>
    <ul class="routines">${S.state.routines.map(r => `<li><div><b>${esc(r.name)}</b><small>${r.exercises.map(e => esc(getExercise(e.exId).name)).join(', ')}</small></div>
      <button class="chip-btn primary" data-a="startRoutine" data-id="${r.id}">Start</button><button class="x" data-a="delRoutine" data-id="${r.id}" aria-label="Verwijder">×</button></li>`).join('')}</ul></section>` : ''}

  <section class="card">
    <div class="card-h"><h3>Lichaam</h3>
      <div class="seg"><button class="${ui.muscleMode === 'week' ? 'on' : ''}" data-a="muscleMode" data-m="week">Deze week</button><button class="${ui.muscleMode === 'level' ? 'on' : ''}" data-a="muscleMode" data-m="level">Level</button></div>
    </div>
    ${bodyMap(vals)}
    <p class="small muted center">${ui.muscleMode === 'week' ? 'Sets per spiergroep in de laatste 7 dagen (secundair telt half). 12+ sets = vol.' : 'Level per spiergroep ten opzichte van je sterkste.'}</p>
  </section>

  <section class="card">
    <div class="card-h"><h3>Spiergroepen</h3></div>
    <ul class="muscles">${muscles.map(m => { const M = G.muscles[m]; return `
      <li><div class="m-top"><span>${esc(MUSCLES[m].name)}</span><span class="m-lvl">lvl ${M.level}</span></div>
      ${bar(M.pct, m === 'cardio' ? 'var(--water)' : 'var(--accent)')}
      <div class="m-sub small muted"><span>${fmtNum(M.into)} / ${fmtNum(M.need)} XP</span><span>${fmtNum(M.weekSets, 1)} sets deze week</span></div></li>`; }).join('')}
    </ul>
    <p class="small muted">Spier-XP = volume (kg × reps) ÷ 10. Primaire spier 100%, secundaire 50%. Warming-up telt half.</p>
  </section>

  <section class="card">
    <div class="card-h"><h3>Geschiedenis</h3><span class="muted small">${ws.length} trainingen</span></div>
    ${list.length ? `<ul class="history">${list.map(w => { const st = G.workoutStats[w.id] || {}; return `
      <li data-a="workoutDetail" data-id="${w.id}"><div class="h-top"><b>${esc(w.name)}</b><span class="muted small">${fmtDate(S.keyOf(new Date(w.start)))}</span></div>
      <div class="h-sub small muted">⏱ ${S.fmtDuration(w.end - w.start)} · ${fmtNum(st.volume)} kg · ${st.sets} sets${st.prs?.length ? ` · <span class="gold-t">🏆 ${st.prs.length}</span>` : ''} · <span class="xp-t">+${st.xp} XP</span></div>
      <div class="h-ex small">${w.exercises.map(e => esc(getExercise(e.exId).name)).join(' · ')}</div></li>`; }).join('')}</ul>
      ${ws.length > ui.historyLimit ? `<button class="btn full" data-a="moreHistory">Toon meer</button>` : ''}`
    : '<p class="muted small">Nog geen trainingen. Start er een, of importeer je Hevy-geschiedenis via Profiel.</p>'}
  </section>`;
}

function newSet(type = 'normal') { return { kg: null, reps: null, km: null, min: null, sec: null, done: false, type }; }
function startWorkout(name, exercises = []) {
  S.state.active = { id: uid(), name, start: Date.now(), exercises };
  ui.workoutOpen = true;
  commit({ silent: true });
}
function defaultName() {
  const h = new Date().getHours();
  return h < 12 ? 'Ochtendtraining' : h < 18 ? 'Middagtraining' : 'Avondtraining';
}
function copyExercises(list) {
  return list.map(e => ({ exId: e.exId, sets: (e.sets || Array.from({ length: e.n || 3 }, () => ({ type: 'normal' }))).map(s => newSet(s.type || 'normal')) }));
}

const COLS = {
  weight: [['kg', 'KG'], ['reps', 'REPS']],
  bw: [['kg', '+KG'], ['reps', 'REPS']],
  time: [['sec', 'SEC']],
  cardio: [['km', 'KM'], ['min', 'MIN']],
};

function viewWorkout() {
  const A = S.state.active;
  const live = liveWorkoutXp(A, G);
  let vol = 0;
  for (const ex of A.exercises) { const e = getExercise(ex.exId); for (const s of ex.sets) if (s.done && setValid(e.kind, s) && (e.kind === 'weight' || e.kind === 'bw')) vol += setVolume(e.kind, s, S.state.settings.bodyweight); }
  const rest = S.state.rest;

  return `
  <div class="wo-head">
    <button class="icon round" data-a="closeWorkout" aria-label="Minimaliseer">⌄</button>
    <span class="wo-time" id="wo-elapsed">${S.fmtDuration(Date.now() - A.start)}</span>
    <button class="icon round ${S.state.settings.restOn ? 'on' : ''}" data-a="toggleRest" aria-label="Rusttimer">⏱</button>
    <button class="btn primary" data-a="finishWorkout">Klaar</button>
  </div>
  <div class="wo-body">
    <input class="wo-name" data-wname value="${esc(A.name)}" aria-label="Naam training">
    <div class="wo-stats"><div><b>${fmtNum(vol)}</b><small>kg volume</small></div><div><b>${live.sets}</b><small>sets</small></div><div><b class="gold-t">${live.prs}</b><small>records</small></div><div><b class="xp-t">+${live.xp}</b><small>XP</small></div></div>

    ${A.exercises.map((ex, i) => {
      const e = getExercise(ex.exId), cols = COLS[e.kind] || COLS.weight;
      const prev = previousSets(ex.exId);
      return `
      <section class="ex">
        <div class="ex-h"><div><div class="ex-name">${esc(e.name)}</div><div class="ex-mus small muted">${[...e.primary, ...e.secondary].map(m => MUSCLES[m]?.name).filter(Boolean).join(' · ') || 'geen spiergroep ingesteld'}</div></div>
          <button class="icon" data-a="exMenu" data-i="${i}" aria-label="Opties">⋮</button></div>
        <div class="sets c${cols.length}">
          <div class="sr head"><span>SET</span><span>VORIGE</span>${cols.map(c => `<span>${c[1]}</span>`).join('')}<span>✓</span></div>
          ${ex.sets.map((s, j) => {
            const p = prev?.[j];
            const pr = setIsPr(ex.exId, e.kind, s, G);
            const typeShort = SET_TYPES[s.type]?.short;
            return `<div class="sr ${s.done ? 'done' : ''}">
              <button class="setno t-${s.type}" data-a="cycleType" data-i="${i}" data-j="${j}">${typeShort || (ex.sets.slice(0, j + 1).filter(x => x.type !== 'warmup').length)}${pr ? '<i class="pr">🏆</i>' : ''}</button>
              <span class="prev" data-a="usePrev" data-i="${i}" data-j="${j}">${p ? esc(fmtSet(e.kind, p)) : '–'}</span>
              ${cols.map(([f]) => `<input type="text" inputmode="decimal" data-in="${i}.${j}.${f}" value="${s[f] ?? ''}" placeholder="${p?.[f] ?? ''}">`).join('')}
              <button class="tick ${s.done ? 'on' : ''}" data-a="tickSet" data-i="${i}" data-j="${j}" aria-label="Set klaar">✓</button>
            </div>`;
          }).join('')}
        </div>
        <button class="btn full ghost" data-a="addSet" data-i="${i}">+ Set toevoegen</button>
      </section>`;
    }).join('')}

    <button class="btn primary full" data-a="openPicker">+ Oefening toevoegen</button>
    <button class="btn full danger-t" data-a="discardWorkout">Training annuleren</button>
    <p class="small muted center">Tik op een setnummer voor warming-up (W), tot falen (F) of dropset (D). Tik op "vorige" om die waarden over te nemen.</p>
  </div>
  ${rest ? `<div class="rest">
    <div class="rest-bar"><i id="rest-bar"></i></div>
    <div class="rest-time" id="rest-time">${S.fmtDuration(rest.end - Date.now())}</div>
    <div class="btnrow"><button class="chip-btn" data-a="restAdj" data-n="-15">−15</button><button class="chip-btn" data-a="restAdj" data-n="15">+15</button><button class="chip-btn primary" data-a="restSkip">Overslaan</button></div>
  </div>` : ''}`;
}

// ---------------------------------------------------------------- Agenda
function viewAgenda() {
  const today = todayKey(), tom = addDays(today, 1);
  const open = S.state.tasks.filter(t => !t.done).sort(byTime);
  const late = open.filter(t => t.date < today);
  const tday = open.filter(t => t.date === today);
  const tomorrow = open.filter(t => t.date === tom);
  const later = open.filter(t => t.date > tom);
  const done = S.state.tasks.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt).slice(0, 15);
  const grp = (h, l, cls = '') => l.length ? `<section class="card ${cls}"><div class="card-h"><h3>${h}</h3><span class="muted small">${l.length}</span></div><ul class="tasks">${l.map(taskRow).join('')}</ul></section>` : '';
  const laterByDate = {};
  for (const t of later) (laterByDate[t.date] ||= []).push(t);

  return `
  <h1 class="page-h">Afspraken</h1>
  <button class="btn primary full big-btn" data-a="newTask" data-date="${today}">+ Nieuwe afspraak of taak</button>
  <div class="tiles three">
    <div class="tile"><b>${G.counters.tasksDone}</b><small>afgerond</small></div>
    <div class="tile"><b>${G.counters.tasksOnTime}</b><small>op tijd</small></div>
    <div class="tile"><b>lvl ${G.skills.afspraken.level}</b><small>afspraken</small></div>
  </div>
  ${grp('⚠️ Te laat', late, 'late-card')}
  ${grp('Vandaag', tday)}
  ${grp('Morgen', tomorrow)}
  ${Object.entries(laterByDate).map(([d, l]) => grp(fmtDate(d), l)).join('')}
  ${!open.length ? '<section class="card"><p class="muted">Niets open. Lekker bezig! 🎉</p></section>' : ''}
  ${grp('Recent afgerond', done)}
  <p class="small muted center">+${XP.task} XP per afgeronde taak, +${XP.taskOnTime} als het op tijd is. ⭐ Belangrijk = dubbele XP.<br>Herinneringen verschijnen in de app; een web-app kan op iPhone geen meldingen inplannen.</p>`;
}

function taskForm(t, date) {
  const isNew = !t;
  t = t || { title: '', type: 'afspraak', date: date || todayKey(), time: '', priority: 'normal', repeat: 'none', note: '' };
  openModal(`
    <h2>${isNew ? 'Nieuwe afspraak' : 'Bewerken'}</h2>
    <form id="task-form" class="form">
      <label>Wat?<input name="title" required value="${esc(t.title)}" placeholder="Bijv. tandarts, mama bellen…"></label>
      <div class="seg wide" data-radio="type">${Object.entries(TASK_TYPES).map(([k, v]) => `<button type="button" class="${t.type === k ? 'on' : ''}" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="two"><label>Datum<input name="date" type="date" required value="${esc(t.date)}"></label><label>Tijd (optioneel)<input name="time" type="time" value="${esc(t.time || '')}"></label></div>
      <div class="two"><label>Belang<select name="priority"><option value="normal">Normaal</option><option value="high" ${t.priority === 'high' ? 'selected' : ''}>⭐ Belangrijk (2× XP)</option></select></label>
      <label>Herhalen<select name="repeat">${[['none', 'Nooit'], ['daily', 'Elke dag'], ['weekly', 'Elke week'], ['monthly', 'Elke maand']].map(([v, l]) => `<option value="${v}" ${t.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label>Notitie<input name="note" value="${esc(t.note || '')}"></label>
      <button class="btn primary full" type="submit">Opslaan</button>
      ${isNew ? '' : `<button class="btn full danger-t" type="button" data-a="delTask" data-id="${t.id}">Verwijderen</button>`}
    </form>`);
  const form = $('#task-form');
  form.dataset.type = t.type;
  form.onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(form);
    const data = { title: f.get('title').trim(), type: form.dataset.type, date: f.get('date'), time: f.get('time'), priority: f.get('priority'), repeat: f.get('repeat'), note: f.get('note') };
    if (!data.title) return;
    if (isNew) S.state.tasks.push({ id: uid(), done: false, doneAt: null, ...data });
    else Object.assign(S.state.tasks.find(x => x.id === t.id), data);
    closeModal(); commit();
  };
}

function nextDate(d, rep) {
  const x = S.parseKey(d);
  if (rep === 'daily') x.setDate(x.getDate() + 1);
  else if (rep === 'weekly') x.setDate(x.getDate() + 7);
  else if (rep === 'monthly') x.setMonth(x.getMonth() + 1);
  return S.keyOf(x);
}

// ---------------------------------------------------------------- Stats
function viewStats() {
  const today = todayKey(), st = S.state.settings, c = G.counters;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const lbl = d => String(S.parseKey(d).getDate());
  const xpData = days.map(d => ({ label: lbl(d), value: G.dayXp[d] || 0, title: fmtDate(d) }));
  const water = days.map(d => ({ label: lbl(d), value: peekDay(d).water || 0, title: fmtDate(d) }));
  const prot = days.map(d => ({ label: lbl(d), value: peekDay(d).protein || 0, title: fmtDate(d) }));
  const sleep = days.map(d => ({ label: lbl(d), value: Math.round((sleepMinutes(peekDay(d).sleep) || 0) / 6) / 10, title: fmtDate(d) }));

  const weeks = Array.from({ length: 12 }, (_, i) => addDays(S.weekKey(today), (i - 11) * 7));
  const volWeek = weeks.map(w => ({ label: S.fmtShort(w), value: 0, title: `week van ${fmtDate(w)}` }));
  const compWeek = weeks.map(w => ({ label: S.fmtShort(w), value: 0 }));
  for (const w of S.state.workouts) {
    const i = weeks.indexOf(S.weekKey(S.keyOf(new Date(w.start))));
    if (i >= 0) volWeek[i].value += G.workoutStats[w.id]?.volume || 0;
  }
  for (const [d, dd] of Object.entries(S.state.days)) {
    const i = weeks.indexOf(S.weekKey(d));
    if (i >= 0) compWeek[i].value += dd.compliments?.length || 0;
  }

  // Oefening-progressie
  const withHist = Object.entries(G.bests).filter(([, b]) => b.history.length).map(([id, b]) => ({ id, e: getExercise(id), n: b.history.length })).sort((a, b) => b.n - a.n);
  if (!ui.statsEx || !G.bests[ui.statsEx]) ui.statsEx = withHist[0]?.id || null;
  let exBlock = '<p class="muted small">Nog geen trainingen.</p>';
  if (ui.statsEx) {
    const e = getExercise(ui.statsEx), b = G.bests[ui.statsEx];
    const h = b.history.slice(-20);
    const metric = e.kind === 'weight' ? ['e1rm', 'Geschatte 1RM (kg)'] : e.kind === 'bw' ? ['maxReps', 'Meeste reps in één set'] : e.kind === 'time' ? ['maxSec', 'Langste set (sec)'] : ['km', 'Afstand (km)'];
    const data = h.map(x => ({ label: S.fmtShort(x.date), value: Math.round(x[metric[0]] * 10) / 10 }));
    exBlock = `
      <select class="sel" data-statsex>${withHist.map(x => `<option value="${x.id}" ${x.id === ui.statsEx ? 'selected' : ''}>${esc(x.e.name)} (${x.n}×)</option>`).join('')}</select>
      <div class="tiles three">
        ${e.kind === 'weight' ? `<div class="tile"><b>${fmtNum(b.maxKg, 1)}</b><small>zwaarste kg</small></div><div class="tile"><b>${fmtNum(b.e1rm, 1)}</b><small>beste 1RM (geschat)</small></div>` : ''}
        ${e.kind === 'bw' ? `<div class="tile"><b>${b.maxReps}</b><small>meeste reps</small></div>` : ''}
        ${e.kind === 'time' ? `<div class="tile"><b>${b.maxSec}s</b><small>langste</small></div>` : ''}
        <div class="tile"><b>${b.history.length}</b><small>keer gedaan</small></div>
      </div>
      <p class="small muted">${metric[1]}</p>
      ${lineChart(data, { labelEvery: Math.ceil(data.length / 6) })}`;
  }

  const musBars = [...BODY].map(m => ({ label: MUSCLES[m].name, value: G.muscles[m].weekSets })).sort((a, b) => b.value - a.value);

  return `
  <h1 class="page-h">Statistieken</h1>
  <div class="tiles">
    <div class="tile"><b>${fmtNum(G.player.xp)}</b><small>totaal XP</small></div>
    <div class="tile"><b>${c.workouts}</b><small>trainingen</small></div>
    <div class="tile"><b>${fmtNum(c.totalVolume / 1000, 1)}t</b><small>totaal volume</small></div>
    <div class="tile"><b>${c.totalPrs}</b><small>records</small></div>
    <div class="tile"><b>${c.complimentsTotal}</b><small>complimenten</small></div>
    <div class="tile"><b>${c.bestStreak}</b><small>beste streak</small></div>
  </div>
  <section class="card"><div class="card-h"><h3>XP per dag</h3><span class="muted small">14 dagen</span></div>${barChart(xpData, { color: 'var(--gold)', unit: 'XP' })}</section>
  <section class="card"><div class="card-h"><h3>Oefening-progressie</h3></div>${exBlock}</section>
  <section class="card"><div class="card-h"><h3>Trainingsvolume per week</h3><span class="muted small">kg</span></div>${barChart(volWeek, { unit: 'kg', labelEvery: 2 })}</section>
  <section class="card"><div class="card-h"><h3>Sets per spiergroep</h3><span class="muted small">laatste 7 dagen</span></div>${hBars(musBars, { max: Math.max(12, ...musBars.map(x => x.value)) })}<p class="small muted">Richtlijn voor spiergroei: zo'n 10–20 sets per spiergroep per week.</p></section>
  <section class="card"><div class="card-h"><h3>💧 Water</h3><span class="muted small">ml</span></div>${barChart(water, { color: 'var(--water)', goal: st.waterGoal, unit: 'ml', labelEvery: 2 })}</section>
  <section class="card"><div class="card-h"><h3>🥩 Eiwit</h3><span class="muted small">gram</span></div>${barChart(prot, { color: 'var(--protein)', goal: st.proteinGoal, unit: 'g', labelEvery: 2 })}</section>
  <section class="card"><div class="card-h"><h3>😴 Slaap</h3><span class="muted small">uren</span></div>${barChart(sleep, { color: 'var(--sleep)', goal: st.sleepGoal, unit: 'uur', labelEvery: 2 })}</section>
  <section class="card"><div class="card-h"><h3>💬 Complimenten per week</h3></div>${barChart(compWeek, { color: 'var(--social)', labelEvery: 2 })}</section>`;
}

// ---------------------------------------------------------------- Profiel
function viewProfile() {
  const P = G.player, st = S.state.settings;
  const done = BADGES.filter(b => b.done).length;
  const groups = [...new Set(BADGES.map(b => b.group))];
  const customs = S.state.customExercises;
  const set = (k, label, unit, step = 1, type = 'number') => `<label class="setting"><span>${label}</span><span class="sv"><input type="${type}" ${type === 'number' ? `inputmode="decimal" step="${step}"` : ''} data-setting="${k}" value="${esc(st[k])}">${unit ? `<small>${unit}</small>` : ''}</span></label>`;
  const QN = { water: '💧 Water', protein: '🥩 Eiwit', sleep: '😴 Slaap', compliment: '💬 Compliment', tasks: '📅 Afspraken' };

  return `
  <h1 class="page-h">Profiel</h1>
  <section class="card player-card big">
    <div class="pc-top"><div class="lvl-badge xl"><small>LVL</small>${P.level}</div>
      <div class="pc-mid"><div class="pc-title">${title(P.level)}</div>${bar(P.pct, 'var(--gold)', 'thick')}<div class="small muted">${fmtNum(P.into)} / ${fmtNum(P.need)} XP · totaal ${fmtNum(P.xp)} XP</div></div></div>
  </section>

  <section class="card">
    <div class="card-h"><h3>Vaardigheden</h3></div>
    <ul class="skills">${Object.entries(SKILLS).map(([k, s]) => { const L = G.skills[k]; return `
      <li><span class="sk-i" style="background:${s.color}22;color:${s.color}">${s.icon}</span>
      <div class="sk-m"><div class="m-top"><span>${s.name}</span><span class="m-lvl">lvl ${L.level}</span></div>${bar(L.pct, s.color)}<div class="small muted">${fmtNum(L.into)} / ${fmtNum(L.need)} XP · totaal ${fmtNum(L.xp)}</div></div></li>`; }).join('')}
    </ul>
  </section>

  <section class="card">
    <div class="card-h"><h3>Badges</h3><span class="pill">${done}/${BADGES.length}</span></div>
    ${groups.map(g => `<h4 class="grp">${g}</h4><div class="badges">${BADGES.filter(b => b.group === g).map(b => `
      <button class="badge ${b.done ? 'got' : ''}" data-a="badge" data-id="${b.id}"><span class="b-i">${b.icon}</span><span class="b-n">${esc(b.name)}</span>${b.done ? '' : bar(b.pct, 'var(--gold)', 'thin')}</button>`).join('')}</div>`).join('')}
  </section>

  <section class="card">
    <div class="card-h"><h3>Doelen & instellingen</h3></div>
    ${set('waterGoal', 'Waterdoel', 'ml', 100)}
    ${set('proteinGoal', 'Eiwitdoel', 'g', 5)}
    ${set('sleepGoal', 'Slaapdoel', 'uur', 0.25)}
    ${set('bedtime', 'Bedtijd', '', 1, 'time')}
    ${set('weeklyWorkouts', 'Trainingen per week', '×', 1)}
    ${set('bodyweight', 'Lichaamsgewicht', 'kg', 0.5)}
    ${set('restSeconds', 'Rusttimer', 'sec', 15)}
    <h4 class="grp">Dagelijkse quests</h4>
    ${Object.entries(QN).map(([k, l]) => `<label class="setting"><span>${l}</span><input type="checkbox" class="switch" data-quest="${k}" ${st.quests[k] ? 'checked' : ''}></label>`).join('')}
  </section>

  <section class="card">
    <div class="card-h"><h3>Eigen oefeningen</h3><button class="link" data-a="newExercise">+ Nieuw</button></div>
    ${customs.length ? `<ul class="mini-list">${customs.map(e => `<li><div><b>${esc(e.name)}</b><br><small class="${e.guessed ? 'warn-t' : 'muted'}">${e.guessed ? 'Spieren gegokt — check even: ' : ''}${[...e.primary, ...e.secondary].map(m => MUSCLES[m]?.name).join(', ') || 'geen spiergroep'}</small></div><button class="chip-btn" data-a="editExercise" data-id="${e.id}">Bewerk</button></li>`).join('')}</ul>` : '<p class="muted small">Nog geen eigen oefeningen.</p>'}
  </section>

  <section class="card">
    <div class="card-h"><h3>Gegevens</h3></div>
    <label class="btn full file-btn">📥 Importeer Hevy CSV<input type="file" accept=".csv,text/csv,text/plain" data-file="hevy" hidden></label>
    <p class="small muted">In Hevy: Profiel → ⚙️ Instellingen → Export & Import Data → Export Workouts. Sla het bestand op in Bestanden en kies het hier.</p>
    <button class="btn full" data-a="exportData">💾 Backup downloaden</button>
    <label class="btn full file-btn">♻️ Backup terugzetten<input type="file" accept=".json,application/json" data-file="backup" hidden></label>
    <p class="small muted">Je gegevens staan alleen op deze telefoon. Maak af en toe een backup en zet die in iCloud Drive.</p>
    <button class="btn full danger-t" data-a="resetAll">Alles wissen</button>
  </section>

  <details class="card rules"><summary><h3>Hoe verdien ik XP?</h3></summary>
    <table>
      <tr><td>Training afgerond</td><td>+${XP.workout} + ${XP.perSet} per set</td></tr>
      <tr><td>Persoonlijk record</td><td>+${XP.pr} per record</td></tr>
      <tr><td>Weekdoel trainingen</td><td>+${XP.weeklyGoal}</td></tr>
      <tr><td>Water</td><td>tot +${XP.water}, doel +${XP.waterBonus}</td></tr>
      <tr><td>Eiwit</td><td>tot +${XP.protein}, doel +${XP.proteinBonus}</td></tr>
      <tr><td>Slaap</td><td>tot +${XP.sleep}, op tijd naar bed +${XP.bedtimeBonus}</td></tr>
      <tr><td>Compliment</td><td>+${XP.compliment} (max ${XP.complimentCap}/dag)</td></tr>
      <tr><td>Afspraak/taak</td><td>+${XP.task}, op tijd +${XP.taskOnTime}, ⭐ = 2×</td></tr>
      <tr><td>Perfecte dag</td><td>+${XP.perfectDay} + ${XP.streakStep}/streakdag</td></tr>
      <tr><td>Spier-XP</td><td>kg × reps ÷ 10</td></tr>
    </table>
  </details>
  <p class="small muted center">LifeGame · alles lokaal op je telefoon</p>`;
}

function levelUp(lvl) {
  openModal(`<div class="levelup"><div class="lu-burst">⬆️</div><h2>Level ${lvl}!</h2><p>Je bent nu <b>${title(lvl)}</b>. Ga zo door!</p><button class="btn primary full" data-a="closeModal">Top!</button></div>`, 'center-sheet');
}

// ---------------------------------------------------------------- Oefeningen kiezen
function openPicker() {
  ui.picker = { q: '', muscle: null };
  openModal(`
    <h2>Oefening toevoegen</h2>
    <input class="search" data-picker placeholder="Zoeken…" autocomplete="off">
    <div class="chips scroll">${['', ...BODY, 'cardio'].map(m => `<button class="chip ${m === '' ? 'on' : ''}" data-a="pickerMuscle" data-m="${m}">${m ? MUSCLES[m].name : 'Alles'}</button>`).join('')}</div>
    <ul class="pick-list" id="pick-list">${pickerList()}</ul>
    <button class="btn full" data-a="newExercise" data-addafter="1">+ Eigen oefening maken</button>`, 'tall');
}
function pickerList() {
  const q = ui.picker.q.toLowerCase(), m = ui.picker.muscle;
  const used = new Set(S.state.workouts.flatMap(w => w.exercises.map(e => e.exId)));
  const list = allExercises().filter(e => (!q || e.name.toLowerCase().includes(q)) && (!m || e.primary.includes(m) || e.secondary.includes(m)))
    .sort((a, b) => (used.has(b.id) - used.has(a.id)) || a.name.localeCompare(b.name));
  if (!list.length) return '<li class="muted small">Niets gevonden. Maak hieronder een eigen oefening.</li>';
  return list.map(e => `<li data-a="pickEx" data-id="${e.id}"><b>${esc(e.name)}</b><small>${e.primary.map(x => MUSCLES[x]?.name).join(', ')}${e.secondary.length ? ' · ' + e.secondary.map(x => MUSCLES[x]?.name).join(', ') : ''}</small></li>`).join('');
}

function exerciseForm(e, addAfter) {
  const isNew = !e;
  e = e || { name: ui.picker.q || '', kind: 'weight', primary: [], secondary: [] };
  const KINDS = { weight: 'Gewicht × reps', bw: 'Lichaamsgewicht', time: 'Tijd', cardio: 'Cardio' };
  const chips = (sel, role) => `<div class="chips wrap" data-role="${role}">${[...BODY, 'cardio'].map(m => `<button type="button" class="chip ${sel.includes(m) ? 'on' : ''}" data-m="${m}">${MUSCLES[m].name}</button>`).join('')}</div>`;
  openModal(`
    <h2>${isNew ? 'Eigen oefening' : 'Oefening bewerken'}</h2>
    <form id="ex-form" class="form">
      <label>Naam<input name="name" required value="${esc(e.name)}"></label>
      <div class="seg wide" data-radio="kind">${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="${e.kind === k ? 'on' : ''}" data-v="${k}">${v}</button>`).join('')}</div>
      <h4 class="grp">Primaire spieren (100% XP)</h4>${chips(e.primary, 'primary')}
      <h4 class="grp">Secundaire spieren (50% XP)</h4>${chips(e.secondary, 'secondary')}
      <button class="btn primary full" type="submit">Opslaan</button>
    </form>`, 'tall');
  const form = $('#ex-form');
  form.dataset.kind = e.kind;
  form.querySelectorAll('[data-role] .chip').forEach(c => c.onclick = () => c.classList.toggle('on'));
  form.onsubmit = ev => {
    ev.preventDefault();
    const name = new FormData(form).get('name').trim();
    if (!name) return;
    const pick = r => [...form.querySelectorAll(`[data-role="${r}"] .chip.on`)].map(c => c.dataset.m);
    const data = { name, kind: form.dataset.kind, primary: pick('primary'), secondary: pick('secondary') };
    data.secondary = data.secondary.filter(m => !data.primary.includes(m));
    let id;
    if (isNew) {
      id = 'c-' + slug(name);
      if (allExercises().some(x => x.id === id)) id += '-' + uid().slice(-4);
      S.state.customExercises.push({ id, ...data, custom: true });
    } else {
      Object.assign(S.state.customExercises.find(x => x.id === e.id), data, { guessed: false });
      id = e.id;
    }
    closeModal();
    if (addAfter && S.state.active) addExerciseToWorkout(id);
    commit({ silent: true });
  };
}

function addExerciseToWorkout(id) {
  const prev = previousSets(id);
  const sets = prev ? prev.map(s => newSet(s.type)) : [newSet(), newSet(), newSet()];
  S.state.active.exercises.push({ exId: id, sets });
}

function workoutDetail(id) {
  const w = S.state.workouts.find(x => x.id === id); if (!w) return;
  const st = G.workoutStats[id] || { prs: [], muscleXp: {} };
  const mx = Object.entries(st.muscleXp).sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ label: MUSCLES[m].name, value: Math.round(v) }));
  openModal(`
    <h2>${esc(w.name)}</h2>
    <p class="muted small">${fmtDate(S.keyOf(new Date(w.start)))} · ${S.fmtClock(w.start)} · ${S.fmtDuration(w.end - w.start)}</p>
    <div class="tiles four"><div class="tile"><b>${fmtNum(st.volume)}</b><small>kg</small></div><div class="tile"><b>${st.sets}</b><small>sets</small></div><div class="tile"><b class="gold-t">${st.prs.length}</b><small>records</small></div><div class="tile"><b class="xp-t">+${st.xp}</b><small>XP</small></div></div>
    ${st.prs.length ? `<ul class="pr-list">${st.prs.map(p => `<li>🏆 <b>${esc(getExercise(p.exId).name)}</b> — ${p.label}: ${fmtNum(p.value, 1)}${p.type === 'reps' ? ' reps' : p.type === 'sec' ? ' s' : ' kg'}</li>`).join('')}</ul>` : ''}
    ${w.exercises.map(ex => { const e = getExercise(ex.exId); return `<div class="d-ex"><b>${esc(e.name)}</b><ol>${ex.sets.map(s => `<li><span class="t-${s.type}">${SET_TYPES[s.type]?.short || ''}</span> ${esc(fmtSet(e.kind, s))}</li>`).join('')}</ol></div>`; }).join('')}
    ${mx.length ? `<h4 class="grp">Spier-XP</h4>${hBars(mx, { unit: ' XP' })}` : ''}
    <div class="btn-stack">
      <button class="btn primary full" data-a="repeatWorkout" data-id="${w.id}">↻ Herhaal deze training</button>
      <button class="btn full" data-a="saveRoutine" data-id="${w.id}">Opslaan als routine</button>
      <button class="btn full danger-t" data-a="delWorkout" data-id="${w.id}">Verwijderen</button>
    </div>`, 'tall');
}

// ---------------------------------------------------------------- acties
let audio;
function beep() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    for (const [t, f] of [[0, 880], [0.18, 1175]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.25, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.16);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.17);
    }
  } catch { /* geen geluid */ }
}

const A = {
  tab: el => { ui.tab = el.dataset.tab; if (ui.tab === 'today') ui.date = todayKey(); render(); window.scrollTo(0, 0); },
  day: el => { const n = addDays(ui.date, +el.dataset.n); if (n <= todayKey()) { ui.date = n; render(); } },
  water: el => { const d = day(ui.date); d.water = Math.max(0, d.water + +el.dataset.n); commit(); },
  protein: el => { const d = day(ui.date); d.protein = Math.max(0, d.protein + +el.dataset.n); commit(); },
  proteinCustom: () => { const v = num($('#prot-custom').value); if (v) { const d = day(ui.date); d.protein = Math.max(0, d.protein + v); commit(); } },
  compliment: () => { const note = $('#comp-note').value.trim(); day(ui.date).compliments.push({ t: Date.now(), note }); commit(); },
  delCompliment: el => { day(ui.date).compliments.splice(+el.dataset.i, 1); commit({ silent: true }); },

  newTask: el => taskForm(null, el.dataset.date),
  editTask: el => taskForm(S.state.tasks.find(t => t.id === el.dataset.id)),
  delTask: el => { if (!confirm('Verwijderen?')) return; S.state.tasks = S.state.tasks.filter(t => t.id !== el.dataset.id); closeModal(); commit({ silent: true }); },
  toggleTask: el => {
    const t = S.state.tasks.find(x => x.id === el.dataset.id);
    t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
    if (t.done && t.repeat && t.repeat !== 'none' && !t.spawned) {
      t.spawned = true;
      S.state.tasks.push({ ...t, id: uid(), date: nextDate(t.date, t.repeat), done: false, doneAt: null, spawned: false });
    }
    commit();
  },

  startEmpty: () => { if (!S.state.active) startWorkout(defaultName()); else { ui.workoutOpen = true; render(); } },
  openWorkout: () => { ui.workoutOpen = true; render(); },
  closeWorkout: () => { ui.workoutOpen = false; render(); },
  startRoutine: el => {
    if (S.state.active) return toast('Er loopt al een training');
    const r = S.state.routines.find(x => x.id === el.dataset.id);
    startWorkout(r.name, copyExercises(r.exercises));
  },
  delRoutine: el => { if (!confirm('Routine verwijderen?')) return; S.state.routines = S.state.routines.filter(r => r.id !== el.dataset.id); commit({ silent: true }); },
  repeatWorkout: el => {
    if (S.state.active) return toast('Er loopt al een training');
    const w = S.state.workouts.find(x => x.id === el.dataset.id);
    closeModal(); startWorkout(w.name, copyExercises(w.exercises));
  },
  saveRoutine: el => {
    const w = S.state.workouts.find(x => x.id === el.dataset.id);
    const name = prompt('Naam van de routine', w.name); if (!name) return;
    S.state.routines.push({ id: uid(), name, exercises: w.exercises.map(e => ({ exId: e.exId, sets: e.sets.map(s => ({ type: s.type })) })) });
    closeModal(); commit({ silent: true }); toast('Routine opgeslagen');
  },
  delWorkout: el => { if (!confirm('Training definitief verwijderen?')) return; S.state.workouts = S.state.workouts.filter(w => w.id !== el.dataset.id); closeModal(); commit({ silent: true }); },
  workoutDetail: el => workoutDetail(el.dataset.id),
  moreHistory: () => { ui.historyLimit += 20; render(); },
  muscleMode: el => { ui.muscleMode = el.dataset.m; render(); },

  openPicker: () => openPicker(),
  pickerMuscle: el => {
    ui.picker.muscle = el.dataset.m || null;
    el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    $('#pick-list').innerHTML = pickerList();
  },
  pickEx: el => { addExerciseToWorkout(el.dataset.id); closeModal(); commit({ silent: true }); },
  newExercise: el => exerciseForm(null, !!el.dataset.addafter),
  editExercise: el => exerciseForm(S.state.customExercises.find(e => e.id === el.dataset.id)),

  addSet: el => {
    const ex = S.state.active.exercises[+el.dataset.i];
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(newSet(last && last.type !== 'warmup' ? last.type : 'normal'));
    commit({ silent: true });
  },
  cycleType: el => {
    const s = S.state.active.exercises[+el.dataset.i].sets[+el.dataset.j];
    const order = ['normal', 'warmup', 'failure', 'drop'];
    s.type = order[(order.indexOf(s.type) + 1) % order.length];
    commit({ silent: true });
  },
  usePrev: el => {
    const i = +el.dataset.i, j = +el.dataset.j, ex = S.state.active.exercises[i];
    const p = previousSets(ex.exId)?.[j]; if (!p) return;
    for (const f of ['kg', 'reps', 'km', 'min', 'sec']) if (p[f] != null) ex.sets[j][f] = p[f];
    commit({ silent: true });
  },
  tickSet: el => {
    const i = +el.dataset.i, j = +el.dataset.j, ex = S.state.active.exercises[i], s = ex.sets[j];
    const e = getExercise(ex.exId);
    if (!s.done) {
      const p = previousSets(ex.exId)?.[j] || (j > 0 ? ex.sets[j - 1] : null);
      for (const [f] of COLS[e.kind] || COLS.weight) if (s[f] == null && p?.[f] != null) s[f] = p[f];
      if (e.kind === 'weight' && s.kg == null && s.reps != null) s.kg = 0;
      if (!setValid(e.kind, s)) return toast('Vul eerst de waarden in');
      s.done = true;
      if (S.state.settings.restOn) S.state.rest = { end: Date.now() + S.state.settings.restSeconds * 1000, total: S.state.settings.restSeconds * 1000 };
      if (setIsPr(ex.exId, e.kind, s, G)) toast('🏆 Nieuw record!', 'badge');
    } else s.done = false;
    commit({ silent: true });
  },
  exMenu: el => {
    const i = +el.dataset.i, ex = S.state.active.exercises[i];
    openModal(`<h2>${esc(getExercise(ex.exId).name)}</h2><div class="btn-stack">
      <button class="btn full" data-a="exAct" data-act="delSet" data-i="${i}">Laatste set verwijderen</button>
      <button class="btn full" data-a="exAct" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑ Omhoog</button>
      <button class="btn full" data-a="exAct" data-act="down" data-i="${i}" ${i === S.state.active.exercises.length - 1 ? 'disabled' : ''}>↓ Omlaag</button>
      <button class="btn full danger-t" data-a="exAct" data-act="del" data-i="${i}">Oefening verwijderen</button></div>`);
  },
  exAct: el => {
    const i = +el.dataset.i, L = S.state.active.exercises;
    if (el.dataset.act === 'delSet') L[i].sets.pop();
    if (el.dataset.act === 'del') L.splice(i, 1);
    if (el.dataset.act === 'up' && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
    if (el.dataset.act === 'down' && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
    closeModal(); commit({ silent: true });
  },
  toggleRest: () => { S.state.settings.restOn = !S.state.settings.restOn; if (!S.state.settings.restOn) S.state.rest = null; toast(`Rusttimer ${S.state.settings.restOn ? 'aan' : 'uit'}`); commit({ silent: true }); },
  restAdj: el => { const r = S.state.rest; if (!r) return; r.end += +el.dataset.n * 1000; r.total = Math.max(r.total, r.end - Date.now()); commit({ silent: true }); },
  restSkip: () => { S.state.rest = null; commit({ silent: true }); },
  discardWorkout: () => { if (!confirm('Training annuleren? Alles van deze training gaat verloren.')) return; S.state.active = null; S.state.rest = null; ui.workoutOpen = false; commit({ silent: true }); },
  finishWorkout: () => {
    const act = S.state.active;
    const exercises = act.exercises.map(ex => {
      const e = getExercise(ex.exId);
      return { exId: ex.exId, sets: ex.sets.filter(s => s.done && setValid(e.kind, s)).map(s => { const o = { type: s.type, done: true }; for (const f of ['kg', 'reps', 'km', 'min', 'sec']) if (s[f] != null) o[f] = s[f]; return o; }) };
    }).filter(ex => ex.sets.length);
    if (!exercises.length) {
      if (confirm('Er zijn nog geen sets afgevinkt. Training annuleren?')) { S.state.active = null; S.state.rest = null; ui.workoutOpen = false; commit({ silent: true }); }
      return;
    }
    const open = act.exercises.reduce((n, ex) => n + ex.sets.filter(s => !s.done).length, 0);
    if (open && !confirm(`${open} set(s) zijn niet afgevinkt en worden niet opgeslagen. Afronden?`)) return;
    const w = { id: act.id, name: act.name.trim() || defaultName(), start: act.start, end: Date.now(), exercises };
    S.state.workouts.push(w);
    S.state.active = null; S.state.rest = null; ui.workoutOpen = false;
    commit();
    workoutDetail(w.id);
    $('#modal .sheet h2').insertAdjacentHTML('beforebegin', '<div class="done-banner">🎉 Training voltooid!</div>');
  },

  badge: el => {
    const b = BADGES.find(x => x.id === el.dataset.id);
    openModal(`<div class="levelup"><div class="lu-burst ${b.done ? '' : 'locked'}">${b.icon}</div><h2>${esc(b.name)}</h2><p>${esc(b.desc)}</p>
      ${bar(b.pct, 'var(--gold)', 'thick')}<p class="muted">${fmtNum(b.cur, 1)} / ${fmtNum(b.goal, 1)}${b.done ? ' — behaald ✓' : ''}</p>
      <button class="btn full" data-a="closeModal">Sluiten</button></div>`, 'center-sheet');
  },
  closeModal: () => closeModal(),

  exportData: () => {
    const blob = new Blob([JSON.stringify(S.state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `lifegame-backup-${todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  resetAll: () => {
    if (!confirm('Echt ALLES wissen? Dit kan niet ongedaan worden.')) return;
    if (!confirm('Weet je het zeker? Maak eventueel eerst een backup.')) return;
    S.resetState(); G = null; recompute(); checkProgress(); render();
  },
};

// ---------------------------------------------------------------- events
document.addEventListener('click', e => {
  if (e.target.id === 'modal') return closeModal();
  const radio = e.target.closest('[data-radio] button');
  if (radio) {
    const wrap = radio.parentElement;
    wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === radio));
    wrap.closest('form').dataset[wrap.dataset.radio] = radio.dataset.v;
    return;
  }
  const el = e.target.closest('[data-a], [data-tab]');
  if (!el || el.disabled) return;
  if (el.dataset.tab && !el.dataset.a) return A.tab(el);
  A[el.dataset.a]?.(el, e);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.in && S.state.active) {
    const [i, j, f] = t.dataset.in.split('.');
    const s = S.state.active.exercises[+i]?.sets[+j];
    if (s) { s[f] = num(t.value); S.save(); }
  } else if ('wname' in t.dataset && S.state.active) {
    S.state.active.name = t.value; S.save();
  } else if ('picker' in t.dataset) {
    ui.picker.q = t.value; $('#pick-list').innerHTML = pickerList();
  }
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.sleep) {
    const d = day(ui.date);
    const cur = d.sleep || { bed: '', wake: '' };
    cur[t.dataset.sleep] = t.value;
    d.sleep = cur.bed || cur.wake ? cur : null;
    commit();
  } else if (t.dataset.setting) {
    const k = t.dataset.setting;
    if (k === 'bedtime') S.state.settings[k] = t.value || '23:00';
    else { const v = num(t.value); if (v && v > 0) S.state.settings[k] = v; }
    commit({ silent: true });
  } else if (t.dataset.quest) {
    S.state.settings.quests[t.dataset.quest] = t.checked; commit({ silent: true });
  } else if ('statsex' in t.dataset) {
    ui.statsEx = t.value; render();
  } else if (t.dataset.file && t.files?.[0]) {
    const text = await t.files[0].text();
    t.value = '';
    try {
      if (t.dataset.file === 'hevy') {
        const r = importHevy(text);
        commit({ silent: true });
        openModal(`<div class="levelup"><div class="lu-burst">📥</div><h2>Import klaar</h2>
          <p><b>${r.added}</b> trainingen en <b>${r.sets}</b> sets geïmporteerd${r.skipped ? `, ${r.skipped} overgeslagen (bestonden al)` : ''}.</p>
          ${r.created.length ? `<p class="small">${r.created.length} onbekende oefening(en) toegevoegd met gegokte spiergroepen. Controleer ze onder <b>Profiel → Eigen oefeningen</b>.</p>` : ''}
          <button class="btn primary full" data-a="closeModal">Top</button></div>`, 'center-sheet');
      } else {
        const data = JSON.parse(text);
        if (!data || !data.settings || !Array.isArray(data.workouts)) throw new Error('Geen geldige LifeGame-backup');
        if (!confirm('Huidige gegevens vervangen door deze backup?')) return;
        S.replaceState(data); recompute(); render(); toast('Backup teruggezet');
      }
    } catch (err) { alert('Importeren mislukt: ' + err.message); }
  }
});

// Tellers en rusttimer
function tick() {
  const act = S.state.active;
  if (act) {
    const t = S.fmtDuration(Date.now() - act.start);
    const a = $('#wo-elapsed'); if (a) a.textContent = t;
    const b = $('#mini-elapsed'); if (b) b.textContent = t;
  }
  const r = S.state.rest;
  if (r) {
    const left = r.end - Date.now();
    if (left <= 0) {
      S.state.rest = null; S.save(); beep(); toast('⏱ Rust voorbij — volgende set!');
      if (ui.workoutOpen) render();
      return;
    }
    const el = $('#rest-time'); if (el) el.textContent = S.fmtDuration(left);
    const br = $('#rest-bar'); if (br) br.style.width = `${Math.max(0, left / r.total * 100)}%`;
  }
}
setInterval(tick, 500);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ui.date !== todayKey() && ui.tab === 'today' && !$('#modal').classList.contains('open')) {
    ui.date = todayKey(); recompute(); render();
  }
});

// ---------------------------------------------------------------- start
recompute();
checkProgress();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
