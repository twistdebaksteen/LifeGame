"""Commandoregel:  python -m bot <backtest|paper|live|status> [opties]"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from .config import api_credentials, load_config, load_env

log = logging.getLogger("tradebot")


def setup_logging(log_file: Path | None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=handlers)


def make_exchange(cfg, creds: dict | None = None, demo: bool = False):
    import ccxt
    cls = getattr(ccxt, cfg.exchange.id)
    ex = cls({"enableRateLimit": True, **(creds or {})})
    if demo:
        ex.set_sandbox_mode(True)  # OKX demo trading (nepgeld, echte API)
    return ex


def cmd_backtest(cfg, args) -> None:
    from .backtest import print_report, run_backtest
    from .data import fetch_history, read_csv, synthetic_candles

    if args.synthetic:
        import ccxt
        tf_ms = ccxt.Exchange.parse_timeframe(cfg.exchange.timeframe) * 1000
        candles = synthetic_candles(n=args.days * 86_400_000 // tf_ms, tf_ms=tf_ms)
        print("LET OP: nepdata. Dit test alleen of de code werkt, niet of de strategie werkt.")
    else:
        ex = make_exchange(cfg)
        tf_ms = ex.parse_timeframe(cfg.exchange.timeframe) * 1000
        candles = read_csv(args.csv) if args.csv else fetch_history(
            ex, cfg.exchange.symbol, cfg.exchange.timeframe, args.days)
    if len(candles) < 200:
        raise SystemExit(f"Te weinig candles ({len(candles)}) voor een backtest.")
    out = Path(cfg.runtime.dir) / "backtest_trades.csv"
    out.unlink(missing_ok=True)
    r = run_backtest(cfg, candles, tf_ms, journal_path=out)
    print_report(r)
    print(f"Alle trades: {out}")


def cmd_run(cfg, args, mode: str) -> None:
    from .brokers import LiveBroker, PaperBroker
    from .engine import Engine, Journal, State
    from .runner import run_loop
    from .strategy import EmaRsiStrategy

    rt = Path(cfg.runtime.dir)
    tag = "demo" if (mode == "live" and args.demo) else mode
    setup_logging(rt / f"bot_{tag}.log")
    state = State(rt / f"state_{tag}.json")
    journal = Journal(rt / f"trades_{tag}.csv")

    if mode == "paper":
        ex = make_exchange(cfg)
        ex.load_markets()
        pos = state["position"]
        quote = cfg.capital.start_eur + state["realized_pnl"] - (pos["cost"] if pos else 0.0)
        broker = PaperBroker(quote, pos["amount"] if pos else 0.0,
                             cfg.exchange.fee_rate, cfg.exchange.slippage)
    else:
        creds = api_credentials(demo=args.demo)
        ex = make_exchange(cfg, creds, demo=args.demo)
        broker = LiveBroker(ex, cfg.exchange.symbol, cfg.exchange.fee_rate)
        if not args.demo and not args.yes:
            print(f"\nLIVE handelen met ECHT geld op {cfg.exchange.id} ({cfg.exchange.symbol}).")
            print(f"Maximaal budget: {cfg.capital.start_eur} EUR. Totale verlieslimiet: "
                  f"{cfg.risk.max_total_loss_eur} EUR.")
            if input("Typ JA om te starten: ").strip() != "JA":
                raise SystemExit("Afgebroken.")
        reconcile(state, broker)

    tf_ms = ex.parse_timeframe(cfg.exchange.timeframe) * 1000
    engine = Engine(cfg, EmaRsiStrategy(cfg.strategy), broker, state, journal, tf_ms)
    try:
        run_loop(engine, ex, cfg.exchange.symbol, cfg.exchange.timeframe,
                 cfg.runtime.poll_seconds, Path("STOP"))
    except KeyboardInterrupt:
        pos = engine.position
        log.info("Gestopt met Ctrl+C. %s", "Open positie blijft staan en wordt bij de volgende start "
                 "weer beheerd." if pos else "Geen open positie.")


def reconcile(state, broker) -> None:
    """Controleer bij de start of de opgeslagen positie nog echt op het account staat."""
    pos = state["position"]
    base = broker.base_free()
    if pos and base < pos["amount"] * 0.9:
        log.warning("Opgeslagen positie (%.8f) staat niet meer op het account (%.8f). "
                    "Waarschijnlijk handmatig verkocht; positie wordt vergeten.", pos["amount"], base)
        state["position"] = None
        state.save()
    elif not pos and base > 0:
        log.info("Er staat al %.8f %s op je account. De bot laat dit met rust.", base, broker.base_ccy)


def cmd_status(cfg, args) -> None:
    rt = Path(cfg.runtime.dir)
    for f in sorted(rt.glob("state_*.json")):
        print(f"--- {f.name} ---")
        print(json.dumps(json.loads(f.read_text()), indent=2))
    if not list(rt.glob("state_*.json")):
        print("Nog geen status. Start eerst paper of live.")


def main(argv=None) -> None:
    p = argparse.ArgumentParser(prog="python -m bot", description="OKX day trade bot (ccxt)")
    p.add_argument("--config", default="config.toml")
    sub = p.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("backtest", help="test de strategie op historische data")
    b.add_argument("--days", type=int, default=30)
    b.add_argument("--csv", help="gebruik candles uit dit CSV-bestand")
    b.add_argument("--synthetic", action="store_true", help="nepdata (geen internet nodig)")

    sub.add_parser("paper", help="live koersen, nepgeld")
    lv = sub.add_parser("live", help="ECHT handelen (of --demo voor OKX demo trading)")
    lv.add_argument("--demo", action="store_true", help="OKX demo trading-account gebruiken")
    lv.add_argument("--yes", action="store_true", help="geen bevestigingsvraag")
    sub.add_parser("status", help="toon opgeslagen status")

    args = p.parse_args(argv)
    load_env()
    cfg = load_config(args.config)
    if args.cmd == "backtest":
        setup_logging(None)
        logging.getLogger("tradebot").setLevel(logging.WARNING)
        cmd_backtest(cfg, args)
    elif args.cmd in ("paper", "live"):
        cmd_run(cfg, args, args.cmd)
    else:
        cmd_status(cfg, args)


if __name__ == "__main__":
    main()
