"""Strategie: EMA-crossover met trendfilter en RSI-filter (alleen long, geen hefboom).

Instappen: snelle EMA kruist boven de langzame EMA, koers boven de trend-EMA
en RSI tussen rsi_min en rsi_max (momentum, maar niet overkocht).
Uitstappen: snelle EMA kruist onder de langzame EMA. Stop-loss, take-profit,
maximale duur en sluiten aan het eind van de dag regelt de engine.

Dit is een voorbeeldstrategie om mee te testen, geen bewezen winstgevende strategie.
"""
from __future__ import annotations

from .config import StrategyCfg
from .indicators import ema, rsi


class EmaRsiStrategy:
    def __init__(self, cfg: StrategyCfg):
        self.cfg = cfg

    @property
    def warmup(self) -> int:
        return max(self.cfg.ema_trend, self.cfg.ema_slow, self.cfg.rsi_period) + 1

    def compute(self, candles: list[list[float]]) -> dict:
        closes = [c[4] for c in candles]
        return {
            "close": closes,
            "fast": ema(closes, self.cfg.ema_fast),
            "slow": ema(closes, self.cfg.ema_slow),
            "trend": ema(closes, self.cfg.ema_trend),
            "rsi": rsi(closes, self.cfg.rsi_period),
        }

    def should_enter(self, ind: dict, i: int) -> bool:
        if i < self.warmup or i < 1:
            return False
        fast, slow = ind["fast"], ind["slow"]
        crossed_up = fast[i - 1] <= slow[i - 1] and fast[i] > slow[i]
        r = ind["rsi"][i]
        return (
            crossed_up
            and ind["close"][i] > ind["trend"][i]
            and r is not None
            and self.cfg.rsi_min <= r <= self.cfg.rsi_max
        )

    def should_exit(self, ind: dict, i: int) -> bool:
        if i < 1:
            return False
        fast, slow = ind["fast"], ind["slow"]
        return fast[i - 1] >= slow[i - 1] and fast[i] < slow[i]
