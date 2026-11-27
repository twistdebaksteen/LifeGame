"""Historische candles ophalen (met cache) en nepdata genereren voor tests."""
from __future__ import annotations

import csv
import logging
import math
import random
import time
from pathlib import Path

log = logging.getLogger("tradebot")


def fetch_history(exchange, symbol: str, timeframe: str, days: int,
                  cache_dir: str | Path = "data") -> list[list[float]]:
    tf_ms = exchange.parse_timeframe(timeframe) * 1000
    now = exchange.milliseconds()
    since = now - days * 86_400_000
    cache = Path(cache_dir) / f"{exchange.id}_{symbol.replace('/', '-')}_{timeframe}_{days}d.csv"
    if cache.exists() and time.time() - cache.stat().st_mtime < 3600:
        log.info("Data uit cache: %s", cache)
        return read_csv(cache)

    candles: dict[int, list[float]] = {}
    cursor = since
    while cursor < now - tf_ms:
        batch = exchange.fetch_ohlcv(symbol, timeframe, since=cursor, limit=100)
        if not batch:
            break
        for c in batch:
            if since <= c[0] and c[0] + tf_ms <= now:  # alleen afgesloten candles
                candles[c[0]] = [float(x) for x in c[:6]]
        nxt = batch[-1][0] + tf_ms
        if nxt <= cursor:
            break
        cursor = nxt
        time.sleep(exchange.rateLimit / 1000)
    rows = [candles[k] for k in sorted(candles)]
    write_csv(cache, rows)
    log.info("%d candles opgehaald en bewaard in %s", len(rows), cache)
    return rows


def write_csv(path: str | Path, rows: list[list[float]]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["timestamp", "open", "high", "low", "close", "volume"])
        w.writerows(rows)


def read_csv(path: str | Path) -> list[list[float]]:
    with open(path) as fh:
        r = csv.reader(fh)
        next(r)
        return [[float(x) for x in row] for row in r]


def synthetic_candles(n: int = 8640, start_price: float = 80_000.0, tf_ms: int = 300_000,
                      seed: int = 42, start_ts: int = 1_767_225_600_000) -> list[list[float]]:
    """Willekeurige koersen met wisselende trends. Alleen om de code te testen,
    zegt niets over echte winstgevendheid."""
    rng = random.Random(seed)
    price = start_price
    drift = 0.0
    out = []
    for i in range(n):
        if i % 288 == 0:
            drift = rng.gauss(0, 0.0004)
        o = price
        hi = lo = o
        p = o
        for _ in range(5):
            p *= math.exp(drift / 5 + rng.gauss(0, 0.0015 / math.sqrt(5)))
            hi, lo = max(hi, p), min(lo, p)
        price = p
        out.append([start_ts + i * tf_ms, o, hi, lo, p, rng.uniform(1, 10)])
    return out
