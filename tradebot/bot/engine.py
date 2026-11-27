"""Engine: koppelt strategie, risicobeheer en broker. Wordt gedeeld door backtest, paper en live."""
from __future__ import annotations

import csv
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from .config import Config

log = logging.getLogger("tradebot")

DEFAULT_STATE = {
    "position": None,
    "realized_pnl": 0.0,
    "fees_paid": 0.0,
    "day": None,
    "day_pnl": 0.0,
    "day_trades": 0,
    "cooldown_until": 0,
    "halted": False,
    "halt_reason": None,
    "last_candle_ts": None,
    "trades": 0,
    "wins": 0,
}


def utc_minutes(ts_ms: int) -> int:
    t = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    return t.hour * 60 + t.minute


def utc_day(ts_ms: int) -> str:
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def parse_hhmm(s: str) -> int | None:
    if not s:
        return None
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def fmt_ts(ts_ms: int) -> str:
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


class State:
    """Bot-status, optioneel bewaard als JSON zodat een herstart niets vergeet."""

    def __init__(self, path: str | Path | None = None):
        self.path = Path(path) if path else None
        self.data = dict(DEFAULT_STATE)
        if self.path and self.path.exists():
            self.data.update(json.loads(self.path.read_text()))

    def __getitem__(self, k):
        return self.data[k]

    def __setitem__(self, k, v):
        self.data[k] = v

    def save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=2))
        os.replace(tmp, self.path)


class Journal:
    FIELDS = ["entry_time", "exit_time", "entry_price", "exit_price", "amount",
              "cost_eur", "proceeds_eur", "fees_eur", "pnl_eur", "pnl_pct", "reason"]

    def __init__(self, path: str | Path | None = None):
        self.path = Path(path) if path else None
        self.rows: list[dict] = []

    def record(self, row: dict) -> None:
        self.rows.append(row)
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        new = not self.path.exists()
        with open(self.path, "a", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=self.FIELDS)
            if new:
                w.writeheader()
            w.writerow(row)


class Engine:
    def __init__(self, cfg: Config, strategy, broker, state: State | None = None,
                 journal: Journal | None = None, tf_ms: int = 300_000):
        self.cfg = cfg
        self.strategy = strategy
        self.broker = broker
        self.state = state or State()
        self.journal = journal or Journal()
        self.tf_ms = tf_ms
        self.no_entry_after = parse_hhmm(cfg.risk.no_entry_after_utc)
        self.flatten_at = parse_hhmm(cfg.risk.flatten_at_utc)

    # ---------- hulpfuncties ----------
    @property
    def position(self):
        return self.state["position"]

    def _roll_day(self, ts: int) -> None:
        day = utc_day(ts)
        if self.state["day"] != day:
            self.state["day"] = day
            self.state["day_pnl"] = 0.0
            self.state["day_trades"] = 0

    def budget(self) -> float:
        """Nooit meer inzetten dan startkapitaal + gerealiseerde winst/verlies."""
        own = self.cfg.capital.start_eur + self.state["realized_pnl"]
        return max(0.0, min(own, self.broker.quote_free())) * self.cfg.capital.position_fraction

    def _past(self, ts: int, limit: int | None) -> bool:
        return limit is not None and utc_minutes(ts) >= limit

    def entry_block_reason(self, close_ts: int, price: float) -> str | None:
        r = self.cfg.risk
        s = self.state
        if s["halted"]:
            return "gestopt"
        if s["day_trades"] >= r.max_trades_per_day:
            return "max trades per dag"
        if s["day_pnl"] <= -r.max_daily_loss_eur:
            return "daglimiet verlies"
        if close_ts < s["cooldown_until"]:
            return "afkoelperiode na verlies"
        if self._past(close_ts, self.no_entry_after) or self._past(close_ts, self.flatten_at):
            return "te laat op de dag"
        if self.budget() < self.broker.min_cost(price):
            return "budget onder minimale ordergrootte"
        return None

    # ---------- acties ----------
    def enter(self, price: float, ts: int, reason: str = "signal") -> None:
        cost = self.budget()
        fill = self.broker.buy(cost, price)
        sl = self.cfg.strategy.stop_loss_pct / 100
        tp = self.cfg.strategy.take_profit_pct / 100
        self.state["position"] = {
            "entry_price": fill.price,
            "amount": fill.amount,
            "cost": fill.quote,
            "fee": fill.fee_quote,
            "stop": fill.price * (1 - sl),
            "take_profit": fill.price * (1 + tp),
            "entry_ts": ts,
            "bars_held": 0,
        }
        self.state["day_trades"] += 1
        self.state["fees_paid"] += fill.fee_quote
        log.info("[%s] KOOP %.8f @ %.2f (%.2f EUR, %s)", fmt_ts(ts), fill.amount, fill.price, fill.quote, reason)
        self.state.save()

    def exit(self, price: float, ts: int, reason: str) -> float:
        pos = self.position
        fill = self.broker.sell(pos["amount"], price)
        pnl = fill.quote - pos["cost"]
        s = self.state
        s["realized_pnl"] += pnl
        s["day_pnl"] += pnl
        s["fees_paid"] += fill.fee_quote
        s["trades"] += 1
        if pnl > 0:
            s["wins"] += 1
        else:
            s["cooldown_until"] = ts + self.cfg.risk.cooldown_bars_after_loss * self.tf_ms
        s["position"] = None
        self.journal.record({
            "entry_time": fmt_ts(pos["entry_ts"]),
            "exit_time": fmt_ts(ts),
            "entry_price": round(pos["entry_price"], 2),
            "exit_price": round(fill.price, 2),
            "amount": round(pos["amount"], 8),
            "cost_eur": round(pos["cost"], 4),
            "proceeds_eur": round(fill.quote, 4),
            "fees_eur": round(pos["fee"] + fill.fee_quote, 4),
            "pnl_eur": round(pnl, 4),
            "pnl_pct": round(pnl / pos["cost"] * 100, 3) if pos["cost"] else 0,
            "reason": reason,
        })
        log.info("[%s] VERKOOP @ %.2f (%s) resultaat %+.2f EUR, totaal %+.2f EUR",
                 fmt_ts(ts), fill.price, reason, pnl, s["realized_pnl"])
        if s["realized_pnl"] <= -self.cfg.risk.max_total_loss_eur and not s["halted"]:
            self.halt(f"totale verlieslimiet bereikt ({s['realized_pnl']:.2f} EUR)")
        self.state.save()
        return pnl

    def halt(self, reason: str) -> None:
        self.state["halted"] = True
        self.state["halt_reason"] = reason
        log.warning("BOT GESTOPT: %s", reason)
        self.state.save()

    # ---------- beslismomenten ----------
    def check_exits_price(self, ts: int, price: float) -> None:
        """Live/paper: stop-loss, take-profit en einde-dag op de actuele prijs."""
        self._roll_day(ts)
        pos = self.position
        if not pos:
            return
        if price <= pos["stop"]:
            self.exit(price, ts, "stop_loss")
        elif price >= pos["take_profit"]:
            self.exit(price, ts, "take_profit")
        elif self._past(ts, self.flatten_at):
            self.exit(price, ts, "einde_dag")

    def check_exits_bar(self, candle: list[float]) -> None:
        """Backtest: stop-loss/take-profit binnen een candle (stop-loss eerst = voorzichtig)."""
        ts, o, h, l = candle[0], candle[1], candle[2], candle[3]
        self._roll_day(ts)
        pos = self.position
        if not pos:
            return
        if l <= pos["stop"]:
            self.exit(min(o, pos["stop"]), ts + self.tf_ms, "stop_loss")
        elif h >= pos["take_profit"]:
            self.exit(max(o, pos["take_profit"]), ts + self.tf_ms, "take_profit")

    def on_closed_candle(self, ind: dict, i: int, candle: list[float]) -> None:
        close_ts = candle[0] + self.tf_ms
        price = candle[4]
        self._roll_day(close_ts)
        pos = self.position
        if pos:
            pos["bars_held"] += 1
            if self._past(close_ts, self.flatten_at):
                self.exit(price, close_ts, "einde_dag")
            elif self.strategy.should_exit(ind, i):
                self.exit(price, close_ts, "signaal_uit")
            elif pos["bars_held"] >= self.cfg.strategy.max_hold_bars:
                self.exit(price, close_ts, "max_duur")
            else:
                self.state.save()
            return
        if self.strategy.should_enter(ind, i):
            blocked = self.entry_block_reason(close_ts, price)
            if blocked:
                log.info("[%s] Instapsignaal genegeerd: %s", fmt_ts(close_ts), blocked)
            else:
                self.enter(price, close_ts)
