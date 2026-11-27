"""Backtest: de engine draait over historische candles met een PaperBroker."""
from __future__ import annotations

from .brokers import PaperBroker
from .config import Config
from .engine import Engine, Journal, State
from .strategy import EmaRsiStrategy


def run_backtest(cfg: Config, candles: list[list[float]], tf_ms: int,
                 journal_path=None, min_cost: float = 5.0) -> dict:
    strategy = EmaRsiStrategy(cfg.strategy)
    broker = PaperBroker(cfg.capital.start_eur, fee_rate=cfg.exchange.fee_rate,
                         slippage=cfg.exchange.slippage, min_cost=min_cost)
    journal = Journal(journal_path)
    engine = Engine(cfg, strategy, broker, State(), journal, tf_ms)
    ind = strategy.compute(candles)

    equity = []
    for i, c in enumerate(candles):
        if i > 0:
            engine.check_exits_bar(c)
        engine.on_closed_candle(ind, i, c)
        equity.append(broker.quote + broker.base * c[4])
        if engine.state["halted"] and not engine.position:
            break
    if engine.position:
        last = candles[-1]
        engine.exit(last[4], last[0] + tf_ms, "einde_backtest")
        equity[-1] = broker.quote

    return report(cfg, candles, equity, journal, engine, strategy.warmup)


def report(cfg, candles, equity, journal, engine, warmup) -> dict:
    start = cfg.capital.start_eur
    peak, max_dd = start, 0.0
    for e in equity:
        peak = max(peak, e)
        max_dd = max(max_dd, (peak - e) / peak * 100)
    trades = journal.rows
    wins = [t for t in trades if t["pnl_eur"] > 0]
    losses = [t for t in trades if t["pnl_eur"] <= 0]
    ref = candles[min(warmup, len(candles) - 1)][4]
    reasons: dict[str, int] = {}
    for t in trades:
        reasons[t["reason"]] = reasons.get(t["reason"], 0) + 1
    final = equity[-1] if equity else start
    return {
        "candles": len(candles),
        "start_eur": start,
        "eind_eur": round(final, 2),
        "resultaat_eur": round(final - start, 2),
        "resultaat_pct": round((final / start - 1) * 100, 2),
        "kopen_en_vasthouden_pct": round((candles[-1][4] / ref - 1) * 100, 2),
        "trades": len(trades),
        "winst_trades": len(wins),
        "winpercentage": round(len(wins) / len(trades) * 100, 1) if trades else 0.0,
        "gem_winst_eur": round(sum(t["pnl_eur"] for t in wins) / len(wins), 3) if wins else 0.0,
        "gem_verlies_eur": round(sum(t["pnl_eur"] for t in losses) / len(losses), 3) if losses else 0.0,
        "fees_eur": round(engine.state["fees_paid"], 2),
        "max_drawdown_pct": round(max_dd, 2),
        "uitstap_redenen": reasons,
        "gestopt": engine.state["halt_reason"],
    }


def print_report(r: dict) -> None:
    print("\n===== BACKTEST =====")
    labels = {
        "candles": "Candles", "start_eur": "Start (EUR)", "eind_eur": "Eind (EUR)",
        "resultaat_eur": "Resultaat (EUR)", "resultaat_pct": "Resultaat (%)",
        "kopen_en_vasthouden_pct": "Ter vergelijking: kopen en vasthouden (%)",
        "trades": "Aantal trades", "winst_trades": "Winnende trades", "winpercentage": "Winpercentage (%)",
        "gem_winst_eur": "Gem. winst per winnende trade (EUR)",
        "gem_verlies_eur": "Gem. verlies per verliezende trade (EUR)",
        "fees_eur": "Betaalde fees (EUR)", "max_drawdown_pct": "Max. daling vanaf top (%)",
        "uitstap_redenen": "Uitstapredenen", "gestopt": "Bot gestopt door",
    }
    for k, label in labels.items():
        if k == "gestopt" and not r[k]:
            continue
        print(f"{label:<45} {r[k]}")
    print("====================\n")
