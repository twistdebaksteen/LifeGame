// Badges: elk badge heeft een voortgang [huidig, doel].
import { state } from './store.js';

const B = [];
const def = (id, icon, name, desc, group, fn) => B.push({ id, icon, name, desc, group, fn });

// Training
def('w1', '🏁', 'Eerste training', 'Rond je eerste training af', 'Training', c => [c.workouts, 1]);
def('w10', '🏋️', 'Vaste klant', '10 trainingen afgerond', 'Training', c => [c.workouts, 10]);
def('w50', '🦾', 'Gym rat', '50 trainingen afgerond', 'Training', c => [c.workouts, 50]);
def('w100', '🏛️', 'Monument', '100 trainingen afgerond', 'Training', c => [c.workouts, 100]);
def('w250', '👑', 'Legende', '250 trainingen afgerond', 'Training', c => [c.workouts, 250]);
def('pr1', '🏆', 'Eerste record', 'Verbeter een persoonlijk record', 'Training', c => [c.totalPrs, 1]);
def('pr25', '🥇', 'Recordjager', '25 persoonlijke records', 'Training', c => [c.totalPrs, 25]);
def('pr100', '💎', 'Onstopbaar', '100 persoonlijke records', 'Training', c => [c.totalPrs, 100]);
def('vol10k', '📦', '10 ton', '10.000 kg volume in één training', 'Training', c => [Math.round(c.maxWorkoutVolume), 10000]);
def('vol1m', '🌋', 'Miljoenclub', '1.000.000 kg totaal volume', 'Training', c => [Math.round(c.totalVolume), 1000000]);
def('bench60', '🛋️', 'Bench 60', '60 kg bankdrukken', 'Krachtmijlpalen', c => [c.lifts.bench, 60]);
def('benchbw', '⚖️', 'Eigen gewicht', 'Bankdruk je lichaamsgewicht', 'Krachtmijlpalen', c => [c.lifts.bench, state.settings.bodyweight]);
def('bench100', '💯', 'Bench 100', '100 kg bankdrukken', 'Krachtmijlpalen', c => [c.lifts.bench, 100]);
def('squat100', '🦵', 'Squat 100', '100 kg squatten', 'Krachtmijlpalen', c => [c.lifts.squat, 100]);
def('squat140', '🐘', 'Squat 140', '140 kg squatten', 'Krachtmijlpalen', c => [c.lifts.squat, 140]);
def('dl140', '🏗️', 'Deadlift 140', '140 kg deadliften', 'Krachtmijlpalen', c => [c.lifts.deadlift, 140]);
def('dl180', '🚜', 'Deadlift 180', '180 kg deadliften', 'Krachtmijlpalen', c => [c.lifts.deadlift, 180]);
def('ohp60', '🙌', 'Overhead 60', '60 kg overhead press', 'Krachtmijlpalen', c => [c.lifts.ohp, 60]);

// Spieren
def('m5', '💪', 'Eerste spier lvl 5', 'Een spiergroep op level 5', 'Spieren', (c, G) => [maxMuscle(G), 5]);
def('m15', '🔥', 'Specialist', 'Een spiergroep op level 15', 'Spieren', (c, G) => [maxMuscle(G), 15]);
def('allround', '🧬', 'Allrounder', 'Alle spiergroepen minstens level 5', 'Spieren', (c, G) => [minMuscle(G), 5]);
def('legs10', '🍗', 'Never skip leg day', 'Quadriceps op level 10', 'Spieren', (c, G) => [G.muscles.quads.level, 10]);

// Gezondheid
def('water7', '💧', 'Gehydrateerd', '7 dagen op rij je waterdoel', 'Gezondheid', c => [c.waterBest, 7]);
def('water30', '🌊', 'Waterval', '30 dagen op rij je waterdoel', 'Gezondheid', c => [c.waterBest, 30]);
def('water100l', '🚰', '100 liter', 'In totaal 100 liter water', 'Gezondheid', c => [Math.round(c.waterTotal / 1000), 100]);
def('prot7', '🥩', 'Eiwitmachine', '7 dagen op rij je eiwitdoel', 'Gezondheid', c => [c.proteinBest, 7]);
def('prot30', '🍳', 'Bouwstoffen', '30 dagen op rij je eiwitdoel', 'Gezondheid', c => [c.proteinBest, 30]);
def('sleep7', '😴', 'Uitgerust', '7 nachten op rij genoeg slaap', 'Gezondheid', c => [c.sleepBest, 7]);
def('sleep30', '🛌', 'Slaapkampioen', '30 nachten op rij genoeg slaap', 'Gezondheid', c => [c.sleepBest, 30]);
def('bed20', '🌙', 'Vroege vogel', '20 keer op tijd naar bed', 'Gezondheid', c => [c.bedtimeCount, 20]);

// Sociaal
def('c1', '😊', 'Eerste compliment', 'Geef je eerste compliment', 'Sociaal', c => [c.complimentsTotal, 1]);
def('c25', '🌻', 'Zonnetje', '25 complimenten gegeven', 'Sociaal', c => [c.complimentsTotal, 25]);
def('c100', '💖', 'Hartenbreker', '100 complimenten gegeven', 'Sociaal', c => [c.complimentsTotal, 100]);
def('c500', '🌈', 'Positiviteitsmachine', '500 complimenten gegeven', 'Sociaal', c => [c.complimentsTotal, 500]);

// Afspraken
def('t10', '✅', 'Afmaker', '10 afspraken/taken afgerond', 'Afspraken', c => [c.tasksDone, 10]);
def('t50', '📋', 'Betrouwbaar', '50 afspraken/taken afgerond', 'Afspraken', c => [c.tasksDone, 50]);
def('ontime25', '⏰', 'Altijd op tijd', '25 keer op tijd afgerond', 'Afspraken', c => [c.tasksOnTime, 25]);

// Algemeen
def('perfect1', '⭐', 'Perfecte dag', 'Alle dagelijkse quests op één dag', 'Algemeen', c => [c.perfectDays, 1]);
def('streak3', '🔥', 'Op stoom', '3 perfecte dagen op rij', 'Algemeen', c => [c.bestStreak, 3]);
def('streak7', '☄️', 'Weekstreak', '7 perfecte dagen op rij', 'Algemeen', c => [c.bestStreak, 7]);
def('streak30', '🌟', 'Maandstreak', '30 perfecte dagen op rij', 'Algemeen', c => [c.bestStreak, 30]);
def('lvl5', '🎖️', 'Level 5', 'Bereik spelerslevel 5', 'Algemeen', (c, G) => [G.player.level, 5]);
def('lvl10', '🏅', 'Level 10', 'Bereik spelerslevel 10', 'Algemeen', (c, G) => [G.player.level, 10]);
def('lvl25', '🎗️', 'Level 25', 'Bereik spelerslevel 25', 'Algemeen', (c, G) => [G.player.level, 25]);
def('lvl50', '🏆', 'Level 50', 'Bereik spelerslevel 50', 'Algemeen', (c, G) => [G.player.level, 50]);

const BODY = ['chest', 'back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'lowerback', 'glutes', 'quads', 'hamstrings', 'calves'];
function maxMuscle(G) { return Math.max(...BODY.map(m => G.muscles[m].level)); }
function minMuscle(G) { return Math.min(...BODY.map(m => G.muscles[m].level)); }

export function evalBadges(G) {
  return B.map(b => {
    const [cur, goal] = b.fn(G.counters, G);
    return { ...b, cur, goal, done: cur >= goal, pct: Math.min(1, goal ? cur / goal : 0) };
  });
}
