// Vaste gegevens: spiergroepen, oefeningen, vaardigheden.

export const MUSCLES = {
  chest:      { name: 'Borst' },
  back:       { name: 'Rug (lats)' },
  traps:      { name: 'Trapezius' },
  shoulders:  { name: 'Schouders' },
  biceps:     { name: 'Biceps' },
  triceps:    { name: 'Triceps' },
  forearms:   { name: 'Onderarmen' },
  abs:        { name: 'Buikspieren' },
  lowerback:  { name: 'Onderrug' },
  glutes:     { name: 'Bilspieren' },
  quads:      { name: 'Quadriceps' },
  hamstrings: { name: 'Hamstrings' },
  calves:     { name: 'Kuiten' },
  cardio:     { name: 'Conditie' },
};

// kind: weight = kg × reps, bw = lichaamsgewicht (+ extra kg) × reps,
//       assisted = lichaamsgewicht min hulpgewicht × reps, time = seconden, cardio = km + minuten
// [naam, primair, secundair, kind]
const RAW = [
  ['Bench Press (Barbell)', ['chest'], ['triceps', 'shoulders'], 'weight'],
  ['Bench Press (Dumbbell)', ['chest'], ['triceps', 'shoulders'], 'weight'],
  ['Incline Bench Press (Barbell)', ['chest'], ['shoulders', 'triceps'], 'weight'],
  ['Incline Bench Press (Dumbbell)', ['chest'], ['shoulders', 'triceps'], 'weight'],
  ['Decline Bench Press (Barbell)', ['chest'], ['triceps'], 'weight'],
  ['Chest Press (Machine)', ['chest'], ['triceps', 'shoulders'], 'weight'],
  ['Chest Fly (Dumbbell)', ['chest'], ['shoulders'], 'weight'],
  ['Cable Fly Crossovers', ['chest'], ['shoulders'], 'weight'],
  ['Butterfly (Pec Deck)', ['chest'], [], 'weight'],
  ['Push Up', ['chest'], ['triceps', 'shoulders'], 'bw'],
  ['Chest Dip', ['chest'], ['triceps', 'shoulders'], 'bw'],
  ['Triceps Dip', ['triceps'], ['chest', 'shoulders'], 'bw'],

  ['Overhead Press (Barbell)', ['shoulders'], ['triceps', 'traps'], 'weight'],
  ['Shoulder Press (Dumbbell)', ['shoulders'], ['triceps'], 'weight'],
  ['Shoulder Press (Machine)', ['shoulders'], ['triceps'], 'weight'],
  ['Arnold Press (Dumbbell)', ['shoulders'], ['triceps'], 'weight'],
  ['Lateral Raise (Dumbbell)', ['shoulders'], [], 'weight'],
  ['Lateral Raise (Cable)', ['shoulders'], [], 'weight'],
  ['Front Raise (Dumbbell)', ['shoulders'], [], 'weight'],
  ['Rear Delt Reverse Fly (Dumbbell)', ['shoulders'], ['traps'], 'weight'],
  ['Face Pull', ['shoulders'], ['traps'], 'weight'],
  ['Upright Row (Barbell)', ['shoulders'], ['traps', 'biceps'], 'weight'],
  ['Shrug (Barbell)', ['traps'], ['forearms'], 'weight'],
  ['Shrug (Dumbbell)', ['traps'], ['forearms'], 'weight'],

  ['Pull Up', ['back'], ['biceps'], 'bw'],
  ['Chin Up', ['back'], ['biceps'], 'bw'],
  ['Lat Pulldown (Cable)', ['back'], ['biceps'], 'weight'],
  ['Lat Pulldown (Machine)', ['back'], ['biceps'], 'weight'],
  ['Straight Arm Lat Pulldown (Cable)', ['back'], [], 'weight'],
  ['Bent Over Row (Barbell)', ['back'], ['biceps', 'traps', 'lowerback'], 'weight'],
  ['Pendlay Row (Barbell)', ['back'], ['biceps', 'traps'], 'weight'],
  ['Dumbbell Row', ['back'], ['biceps', 'traps'], 'weight'],
  ['Seated Cable Row - V Grip (Cable)', ['back'], ['biceps', 'traps'], 'weight'],
  ['Seated Row (Machine)', ['back'], ['biceps', 'traps'], 'weight'],
  ['T Bar Row', ['back'], ['biceps', 'traps'], 'weight'],

  ['Deadlift (Barbell)', ['hamstrings', 'glutes', 'lowerback'], ['back', 'traps', 'forearms', 'quads'], 'weight'],
  ['Romanian Deadlift (Barbell)', ['hamstrings'], ['glutes', 'lowerback'], 'weight'],
  ['Romanian Deadlift (Dumbbell)', ['hamstrings'], ['glutes', 'lowerback'], 'weight'],
  ['Good Morning (Barbell)', ['hamstrings'], ['lowerback', 'glutes'], 'weight'],
  ['Back Extension (Hyperextension)', ['lowerback'], ['glutes', 'hamstrings'], 'bw'],

  ['Squat (Barbell)', ['quads'], ['glutes', 'hamstrings', 'lowerback'], 'weight'],
  ['Front Squat (Barbell)', ['quads'], ['glutes', 'abs'], 'weight'],
  ['Goblet Squat', ['quads'], ['glutes'], 'weight'],
  ['Hack Squat (Machine)', ['quads'], ['glutes'], 'weight'],
  ['Leg Press (Machine)', ['quads'], ['glutes', 'hamstrings'], 'weight'],
  ['Bulgarian Split Squat', ['quads'], ['glutes', 'hamstrings'], 'weight'],
  ['Lunge (Dumbbell)', ['quads'], ['glutes', 'hamstrings'], 'weight'],
  ['Leg Extension (Machine)', ['quads'], [], 'weight'],
  ['Lying Leg Curl (Machine)', ['hamstrings'], [], 'weight'],
  ['Seated Leg Curl (Machine)', ['hamstrings'], [], 'weight'],
  ['Hip Thrust (Barbell)', ['glutes'], ['hamstrings'], 'weight'],
  ['Glute Bridge', ['glutes'], ['hamstrings'], 'bw'],
  ['Hip Abduction (Machine)', ['glutes'], [], 'weight'],
  ['Hip Adduction (Machine)', ['quads'], [], 'weight'],
  ['Standing Calf Raise (Machine)', ['calves'], [], 'weight'],
  ['Seated Calf Raise', ['calves'], [], 'weight'],

  ['Bicep Curl (Barbell)', ['biceps'], ['forearms'], 'weight'],
  ['Bicep Curl (Dumbbell)', ['biceps'], ['forearms'], 'weight'],
  ['Bicep Curl (Cable)', ['biceps'], ['forearms'], 'weight'],
  ['EZ Bar Biceps Curl', ['biceps'], ['forearms'], 'weight'],
  ['Hammer Curl (Dumbbell)', ['biceps'], ['forearms'], 'weight'],
  ['Preacher Curl (Barbell)', ['biceps'], [], 'weight'],
  ['Triceps Pushdown', ['triceps'], [], 'weight'],
  ['Triceps Rope Pushdown', ['triceps'], [], 'weight'],
  ['Skullcrusher (Barbell)', ['triceps'], [], 'weight'],
  ['Overhead Triceps Extension (Cable)', ['triceps'], [], 'weight'],
  ['Triceps Extension (Dumbbell)', ['triceps'], [], 'weight'],
  ['Close Grip Bench Press (Barbell)', ['triceps'], ['chest', 'shoulders'], 'weight'],
  ['Wrist Curl (Barbell)', ['forearms'], [], 'weight'],
  ['Farmers Walk', ['forearms', 'traps'], ['abs'], 'weight'],

  ['Crunch', ['abs'], [], 'bw'],
  ['Cable Crunch', ['abs'], [], 'weight'],
  ['Hanging Leg Raise', ['abs'], [], 'bw'],
  ['Russian Twist', ['abs'], [], 'bw'],
  ['Ab Wheel', ['abs'], ['lowerback'], 'bw'],
  ['Plank', ['abs'], ['lowerback'], 'time'],

  // Extra varianten (o.a. uit Hevy)
  ['Chest Fly (Machine)', ['chest'], ['shoulders'], 'weight'],
  ['Iso-Lateral Chest Press (Machine)', ['chest'], ['triceps', 'shoulders'], 'weight'],
  ['Incline Chest Press (Machine)', ['chest'], ['shoulders', 'triceps'], 'weight'],
  ['Bench Press (Smith Machine)', ['chest'], ['triceps', 'shoulders'], 'weight'],
  ['Overhead Press (Dumbbell)', ['shoulders'], ['triceps'], 'weight'],
  ['Shoulder Press (Machine Plates)', ['shoulders'], ['triceps'], 'weight'],
  ['Seated Shoulder Press (Machine)', ['shoulders'], ['triceps'], 'weight'],
  ['Rear Delt Reverse Fly (Machine)', ['shoulders'], ['traps'], 'weight'],
  ['Rear Delt Reverse Fly (Cable)', ['shoulders'], ['traps'], 'weight'],
  ['Iso-Lateral Row (Machine)', ['back'], ['biceps', 'traps'], 'weight'],
  ['Iso-Lateral High Row (Machine)', ['back'], ['biceps', 'traps'], 'weight'],
  ['Meadows Rows (Barbell)', ['back'], ['biceps', 'traps'], 'weight'],
  ['Pull Up (Assisted)', ['back'], ['biceps'], 'assisted'],
  ['Chin Up (Assisted)', ['back'], ['biceps'], 'assisted'],
  ['Triceps Dip (Assisted)', ['triceps'], ['chest', 'shoulders'], 'assisted'],
  ['Dead Hang', ['forearms'], ['back'], 'time'],
  ['Preacher Curl (Machine)', ['biceps'], [], 'weight'],
  ['Preacher Curl (Dumbbell)', ['biceps'], [], 'weight'],
  ['Seated Incline Curl (Dumbbell)', ['biceps'], ['forearms'], 'weight'],
  ['Reverse Curl (Barbell)', ['forearms'], ['biceps'], 'weight'],
  ['Single Arm Triceps Pushdown (Cable)', ['triceps'], [], 'weight'],
  ['Wrist Roller', ['forearms'], [], 'weight'],
  ['Crunch (Machine)', ['abs'], [], 'weight'],
  ['Knee Raise Parallel Bars', ['abs'], [], 'bw'],
  ['Leg Press Horizontal (Machine)', ['quads'], ['glutes', 'hamstrings'], 'weight'],
  ['Squat (Smith Machine)', ['quads'], ['glutes', 'hamstrings'], 'weight'],
  ['Standing Calf Raise (Smith)', ['calves'], [], 'weight'],
  ['Standing Calf Raise (Dumbbell)', ['calves'], [], 'weight'],

  ['Running', ['cardio'], ['quads', 'calves'], 'cardio'],
  ['Treadmill', ['cardio'], ['quads', 'calves'], 'cardio'],
  ['Cycling', ['cardio'], ['quads'], 'cardio'],
  ['Rowing Machine', ['cardio'], ['back'], 'cardio'],
  ['Walking', ['cardio'], ['calves'], 'cardio'],
  ['Stair Machine', ['cardio'], ['quads', 'glutes'], 'cardio'],
];

export function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const EXERCISES = RAW.map(([name, primary, secondary, kind]) => ({
  id: slug(name), name, primary, secondary, kind, builtin: true,
}));

// Gok spiergroepen op basis van de naam (voor geïmporteerde onbekende oefeningen).
const GUESS = [
  [/calf/, ['calves'], [], 'weight'],
  [/\bplank|\bhold\b|\bhang\b/, ['abs'], [], 'time'],
  [/\brun(ning)?\b|\bcycl|\bbike|rowing|\bwalk|elliptical|stair|swim|jump rope|treadmill/, ['cardio'], [], 'cardio'],
  [/crunch|sit ?up|leg raise|knee raise|\bab\b|\babs\b|oblique|twist|v ?up/, ['abs'], [], 'bw'],
  [/romanian|stiff leg/, ['hamstrings'], ['glutes', 'lowerback'], 'weight'],
  [/deadlift/, ['hamstrings', 'glutes', 'lowerback'], ['back'], 'weight'],
  [/hip thrust|glute|abduct|donkey/, ['glutes'], ['hamstrings'], 'weight'],
  [/leg curl|hamstring|nordic/, ['hamstrings'], [], 'weight'],
  [/squat|leg press|lunge|leg extension|step ?up|adduct|split/, ['quads'], ['glutes'], 'weight'],
  [/shrug/, ['traps'], [], 'weight'],
  [/rear delt|reverse fly|face pull/, ['shoulders'], ['traps'], 'weight'],
  [/skull|tricep|pushdown|close grip|kickback/, ['triceps'], [], 'weight'],
  [/wrist|grip|farmer|reverse curl/, ['forearms'], [], 'weight'],
  [/curl/, ['biceps'], ['forearms'], 'weight'],
  [/pull ?up|chin ?up|pulldown|\brows?\b|pullover/, ['back'], ['biceps'], 'weight'],
  [/bench|chest|\bfly|flye|pec|push ?up|\bdip/, ['chest'], ['triceps', 'shoulders'], 'weight'],
  [/shoulder|overhead|military|lateral raise|front raise|delt|arnold|upright/, ['shoulders'], ['triceps'], 'weight'],
  [/back extension|hyperextension|good morning|superman/, ['lowerback'], ['glutes'], 'bw'],
];

export function guessExercise(name, hint = {}) {
  const n = name.toLowerCase();
  for (const [re, primary, secondary, kind] of GUESS) {
    if (re.test(n)) {
      let k = kind;
      if (/assist/.test(n)) k = 'assisted';
      else if (hint.hasDistance || (hint.hasDuration && !hint.hasReps)) k = hint.hasDistance ? 'cardio' : 'time';
      else if (k === 'bw' && hint.hasWeight) k = 'weight';
      return { primary, secondary, kind: k };
    }
  }
  let kind = /assist/.test(n) ? 'assisted' : 'weight';
  if (hint.hasDistance) kind = 'cardio';
  else if (hint.hasDuration && !hint.hasReps) kind = 'time';
  return { primary: [], secondary: [], kind };
}

// Grote vaardigheden die samen je spelerslevel vormen.
export const SKILLS = {
  training:  { name: 'Training',   icon: '🏋️', color: '#4f8cff' },
  voeding:   { name: 'Voeding',    icon: '🥩', color: '#ff9f43' },
  slaap:     { name: 'Slaap',      icon: '😴', color: '#a78bfa' },
  afspraken: { name: 'Afspraken',  icon: '📅', color: '#22c3a6' },
  sociaal:   { name: 'Sociaal',    icon: '💬', color: '#ff6b9a' },
};

export const SET_TYPES = {
  normal:  { label: null, short: '' },
  warmup:  { label: 'Warming-up', short: 'W' },
  failure: { label: 'Tot falen', short: 'F' },
  drop:    { label: 'Dropset', short: 'D' },
};
