"""Laden van config.toml en API-sleutels (.env)."""
from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field, fields
from pathlib import Path


@dataclass
class ExchangeCfg:
    id: str = "myokx"
    symbol: str = "BTC/EUR"
    timeframe: str = "5m"
    fee_rate: float = 0.0015
    slippage: float = 0.0005


@dataclass
class CapitalCfg:
    start_eur: float = 100.0
    position_fraction: float = 0.98


@dataclass
class StrategyCfg:
    ema_fast: int = 9
    ema_slow: int = 21
    ema_trend: int = 100
    rsi_period: int = 14
    rsi_min: float = 50.0
    rsi_max: float = 70.0
    stop_loss_pct: float = 1.0
    take_profit_pct: float = 2.0
    max_hold_bars: int = 48


@dataclass
class RiskCfg:
    max_daily_loss_eur: float = 5.0
    max_total_loss_eur: float = 20.0
    max_trades_per_day: int = 8
    cooldown_bars_after_loss: int = 6
    no_entry_after_utc: str = "23:00"
    flatten_at_utc: str = "23:50"


@dataclass
class RuntimeCfg:
    poll_seconds: int = 15
    dir: str = "runtime"


@dataclass
class Config:
    exchange: ExchangeCfg = field(default_factory=ExchangeCfg)
    capital: CapitalCfg = field(default_factory=CapitalCfg)
    strategy: StrategyCfg = field(default_factory=StrategyCfg)
    risk: RiskCfg = field(default_factory=RiskCfg)
    runtime: RuntimeCfg = field(default_factory=RuntimeCfg)


def _build(cls, data: dict):
    known = {f.name for f in fields(cls)}
    unknown = set(data) - known
    if unknown:
        raise ValueError(f"Onbekende instelling(en) in [{cls.__name__}]: {sorted(unknown)}")
    return cls(**data)


def load_config(path: str | Path | None = "config.toml") -> Config:
    cfg = Config()
    if path and Path(path).exists():
        with open(path, "rb") as fh:
            raw = tomllib.load(fh)
        for section in ("exchange", "capital", "strategy", "risk", "runtime"):
            if section in raw:
                setattr(cfg, section, _build(type(getattr(cfg, section)), raw[section]))
    validate(cfg)
    return cfg


def validate(cfg: Config) -> None:
    s, r, c = cfg.strategy, cfg.risk, cfg.capital
    if not (0 < c.position_fraction <= 1):
        raise ValueError("capital.position_fraction moet tussen 0 en 1 liggen")
    if c.start_eur <= 0:
        raise ValueError("capital.start_eur moet groter dan 0 zijn")
    if s.ema_fast >= s.ema_slow:
        raise ValueError("strategy.ema_fast moet kleiner zijn dan ema_slow")
    if s.stop_loss_pct <= 0 or s.take_profit_pct <= 0:
        raise ValueError("stop_loss_pct en take_profit_pct moeten groter dan 0 zijn")
    if r.max_daily_loss_eur <= 0 or r.max_total_loss_eur <= 0:
        raise ValueError("verlieslimieten moeten groter dan 0 zijn")


def load_env(path: str | Path = ".env") -> None:
    """Minimale .env-lezer (KEY=waarde per regel). Bestaande omgevingsvariabelen winnen."""
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def api_credentials(demo: bool = False) -> dict:
    prefix = "OKX_DEMO_" if demo else "OKX_"
    creds = {
        "apiKey": os.environ.get(prefix + "API_KEY", ""),
        "secret": os.environ.get(prefix + "API_SECRET", ""),
        "password": os.environ.get(prefix + "API_PASSPHRASE", ""),
    }
    missing = [k for k, v in creds.items() if not v]
    if missing:
        raise SystemExit(
            f"API-gegevens ontbreken ({prefix}API_KEY / {prefix}API_SECRET / {prefix}API_PASSPHRASE). "
            "Zet ze in .env (zie .env.example)."
        )
    return creds
