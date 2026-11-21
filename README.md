# LifeGame 🎮

Maak een game van je dagelijks leven. Verdien XP, stijg in level en verzamel badges met:

- **Training**: workouts loggen zoals in Hevy (sets, kg, reps, vorige prestaties, rusttimer, routines), met een **level per spiergroep**, een lichaamskaart en automatische **persoonlijke records**
- **Voeding**: water en eiwit met één tik
- **Slaap**: bedtijd en opstaan, met bonus als je op tijd naar bed gaat
- **Afspraken**: taken en afspraken, ook herhalend, met extra XP als je ze op tijd afrondt
- **Sociaal**: complimenten die je geeft
- **Dagelijkse quests en streaks**, **45 badges** en **grafieken** van alles

Alles staat lokaal op je telefoon. Er zijn geen accounts, geen server en geen koppelingen.

## Op je iPhone zetten

De app is een web-app (PWA) en moet één keer ergens online staan:

1. Op GitHub ga je naar **Settings → Pages**, kies je **Deploy from a branch** en selecteer je de branch met deze code (map `/ (root)`).
   Let op: bij een privé-repository werkt GitHub Pages alleen met een betaald GitHub-abonnement. Je kunt de map ook gratis neerzetten op bijvoorbeeld Netlify of Cloudflare Pages.
2. Open de link in **Safari** op je iPhone.
3. Tik op **Deel → Zet op beginscherm**.

Daarna opent LifeGame als een echte app en werkt hij ook offline.

## Je Hevy-geschiedenis importeren

1. In Hevy ga je naar **Profiel → ⚙️ Instellingen → Export & Import Data → Export Workouts** en bewaar je het CSV-bestand in Bestanden.
2. In LifeGame kies je **Profiel → Importeer Hevy CSV**.

Oefeningen die LifeGame niet kent krijgen gegokte spiergroepen. Controleer die onder **Profiel → Eigen oefeningen**.

## Backups

Je gegevens staan alleen in de browseropslag van je telefoon. Download af en toe een backup via **Profiel → Backup downloaden** en bewaar die in iCloud Drive.

## Lokaal draaien

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Structuur

| Bestand | Inhoud |
|---|---|
| `js/data.js` | spiergroepen, oefeningen (met spierverdeling), vaardigheden |
| `js/game.js` | XP-regels, levels, records, quests, streaks |
| `js/badges.js` | alle badges |
| `js/app.js` | schermen en interactie |
| `js/csv.js` | Hevy-import |
| `js/charts.js`, `js/body.js` | grafieken en lichaamskaart (SVG) |
| `sw.js` | offline-ondersteuning |

De XP-waarden staan bovenaan `js/game.js` (`XP = {...}`) en zijn makkelijk aan te passen.
