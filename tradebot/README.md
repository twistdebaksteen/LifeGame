# OKX day trade bot (ccxt)

Een bot die zelfstandig crypto daytradet op OKX, met een budget van maximaal €100.
Alleen kopen en verkopen (spot), geen hefboom en geen shorten.

> **Waarschuwing.** De meegeleverde strategie is een voorbeeld om mee te testen, geen bewezen
> winstgevende strategie. De meeste daytraders verliezen geld, en fees wegen bij €100 zwaar.
> Zet alleen geld in dat je kwijt kunt.

## Stappenplan

Werk deze stappen in volgorde af. Ga pas naar de volgende stap als de vorige goed gaat.

| Stap | Commando | Geld |
|---|---|---|
| 1. Backtest op historische data | `python -m bot backtest --days 60` | geen |
| 2. Paper trading met live koersen (1 à 2 weken) | `python -m bot paper` | nepgeld |
| 3. OKX demo trading (echte API, nepgeld) | `python -m bot live --demo` | nepgeld |
| 4. Live met €100 | `python -m bot live` | **echt** |

## Installeren

Je hebt Python 3.11 of nieuwer nodig.

```bash
cd tradebot
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m pytest                 # controle: alle tests moeten slagen
```

## API-sleutels (alleen voor stap 3 en 4)

1. Log in op OKX en ga naar **API → Create API key**.
2. Geef alleen de rechten **Read** en **Trade**. Zet **Withdraw nooit aan**.
3. Koppel de sleutel als het kan aan het IP-adres van de computer waarop de bot draait.
4. Kopieer `.env.example` naar `.env` en vul daar de key, de secret en de passphrase in.

Voor demo trading maak je aparte sleutels aan in de demo-omgeving van OKX en zet je die bij
`OKX_DEMO_...`. Zet `.env` nooit in git en plak sleutels nooit in een chat.

## Hoe de bot handelt

- **Candles van 5 minuten op BTC/EUR.** Dit stel je in via `config.toml`.
- **Instappen:** de EMA 9 kruist boven de EMA 21, de koers staat boven de EMA 100 en de RSI ligt tussen 50 en 70.
- **Uitstappen:** bij het eerste wat gebeurt van:
  - stop-loss op −1%
  - take-profit op +2%
  - de EMA 9 kruist onder de EMA 21
  - de positie staat er 4 uur
  - het is 23:50 UTC; de bot houdt niets overnacht
- **Fees:** de bot rekent met 0,15% per order, dus 0,3% per trade (kopen plus verkopen).

## Ingebouwde veiligheid

| Beveiliging | Standaard |
|---|---|
| Maximaal budget, ook als er meer op je account staat | €100 |
| Geen nieuwe trades meer die dag na een dagverlies van | €5 |
| Bot stopt volledig bij een totaal verlies van | €20 |
| Maximaal aantal trades per dag | 8 |
| Wachttijd na een verliestrade | 30 min |
| Bitcoin die je zelf al bezit wordt nooit verkocht | altijd |
| Live starten vraagt om bevestiging (typ `JA`) | altijd |

**Noodstop:** maak in de map `tradebot` een leeg bestand `STOP` aan (`touch STOP`). De bot
verkoopt dan een eventuele open positie en stopt. Met **Ctrl+C** stopt de bot zonder te
verkopen. Een open positie wordt dan bij de volgende start weer opgepakt, maar tussendoor
bewaakt niets de stop-loss.

Wil je na een totale stop opnieuw beginnen, verwijder dan `runtime/state_live.json`.

## Wat de bot bijhoudt (map `runtime/`)

- `trades_<modus>.csv`: elke trade met de prijzen, de fees en het resultaat.
- `state_<modus>.json`: de huidige positie en de winst of het verlies. Daardoor gaat er bij een herstart niets verloren.
- `bot_<modus>.log`: het volledige logboek.
- Met `python -m bot status` zie je de huidige stand.

## Waar laat je de bot draaien?

De bot moet continu aanstaan. Dat kan op je eigen pc (die mag dan niet in slaapstand), op een
Raspberry Pi of op een goedkope VPS (ongeveer €5 per maand). Op een server start je hem
bijvoorbeeld met:

```bash
nohup python -m bot paper > /dev/null 2>&1 &
```

## Opmerkingen

- **Exchange:** `id = "myokx"` verbindt met de Europese OKX-omgeving (eea.okx.com). Heb je een
  niet-Europees OKX-account, gebruik dan `"okx"`.
- **Demo trading:** dit ondersteunt mogelijk niet alle EUR-paren. Werkt BTC/EUR daar niet, gebruik
  dan in de demo tijdelijk `symbol = "BTC/USDT"`.
- **Fees:** controleer je eigen tarief op OKX en pas `fee_rate` aan.
- **Strategie:** de strategie staat in `bot/strategy.py`. Wijzig je die, test dan altijd eerst opnieuw met een backtest en paper trading.
