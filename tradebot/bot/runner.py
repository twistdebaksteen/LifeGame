"""Doorlopende loop voor paper- en live-modus."""
from __future__ import annotations

import logging
import time
from pathlib import Path

import ccxt

from .engine import Engine

log = logging.getLogger("tradebot")

MAX_CONSECUTIVE_ERRORS = 20


def run_loop(engine: Engine, exchange, symbol: str, timeframe: str,
             poll_seconds: int, stop_file: Path, max_iterations: int | None = None) -> None:
    tf_ms = engine.tf_ms
    errors = 0
    iteration = 0
    log.info("Bot gestart op %s (%s). Stoppen: Ctrl+C, of maak het bestand %s aan.",
             symbol, timeframe, stop_file)
    while max_iterations is None or iteration < max_iterations:
        iteration += 1
        try:
            now = exchange.milliseconds()
            price = float(exchange.fetch_ticker(symbol)["last"])

            if stop_file.exists():
                log.warning("Noodstop-bestand gevonden.")
                if engine.position:
                    engine.exit(price, now, "noodstop")
                engine.halt("noodstop-bestand")
                break

            if engine.state["halted"]:
                if engine.position:
                    engine.exit(price, now, "gestopt")
                log.warning("Bot staat stil: %s. Verwijder state-bestand om opnieuw te beginnen.",
                            engine.state["halt_reason"])
                break

            engine.check_exits_price(now, price)

            candles = exchange.fetch_ohlcv(symbol, timeframe, limit=300)
            closed = [[float(x) for x in c[:6]] for c in candles if c[0] + tf_ms <= now]
            if closed and closed[-1][0] != engine.state["last_candle_ts"]:
                ind = engine.strategy.compute(closed)
                engine.on_closed_candle(ind, len(closed) - 1, closed[-1])
                engine.state["last_candle_ts"] = closed[-1][0]
                engine.state.save()
                pos = engine.position
                log.info("Koers %.2f | positie: %s | vandaag %+.2f EUR | totaal %+.2f EUR",
                         price,
                         f"{pos['amount']:.6f} @ {pos['entry_price']:.2f}" if pos else "geen",
                         engine.state["day_pnl"], engine.state["realized_pnl"])
            errors = 0
        except KeyboardInterrupt:
            raise
        except (ccxt.NetworkError, ccxt.ExchangeNotAvailable, ccxt.RequestTimeout) as e:
            errors += 1
            log.warning("Netwerkfout (%d): %s", errors, e)
            time.sleep(min(60, 5 * errors))
        except Exception as e:  # noqa: BLE001
            errors += 1
            log.exception("Fout (%d): %s", errors, e)
            time.sleep(min(60, 5 * errors))
        if errors >= MAX_CONSECUTIVE_ERRORS:
            log.error("Te veel fouten achter elkaar; bot stopt. Controleer je positie handmatig op OKX!")
            break
        time.sleep(poll_seconds)
