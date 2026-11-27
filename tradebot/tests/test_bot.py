import pytest

from bot.backtest import run_backtest
from bot.brokers import LiveBroker, PaperBroker
from bot.config import Config, load_config
from bot.data import synthetic_candles
from bot.engine import Engine, State
from bot.indicators import ema, rsi
from bot.strategy import EmaRsiStrategy

TF = 300_000
T0 = 1_767_225_600_000  # 2026-01-01 00:00 UTC


# ---------- indicatoren ----------
def test_ema_constant():
    assert ema([5.0] * 10, 3) == [5.0] * 10


def test_rsi_extremes():
    assert rsi([float(i) for i in range(30)], 14)[-1] == 100.0
    assert rsi([float(30 - i) for i in range(30)], 14)[-1] == 0.0
    assert rsi([1.0] * 10, 14) == [None] * 10


# ---------- paper broker ----------
def test_paper_roundtrip_costs_fees():
    b = PaperBroker(100.0, fee_rate=0.001, slippage=0.0)
    buy = b.buy(100.0, 50_000.0)
    sell = b.sell(buy.amount, 50_000.0)
    assert b.base == pytest.approx(0)
    assert sell.quote == pytest.approx(100 * 0.999 * 0.999)
    assert b.quote == pytest.approx(sell.quote)


# ---------- engine ----------
class AlwaysEnter:
    warmup = 0

    def should_enter(self, ind, i):
        return True

    def should_exit(self, ind, i):
        return False


def make_engine(**risk):
    cfg = Config()
    cfg.risk.flatten_at_utc = ""
    cfg.risk.no_entry_after_utc = ""
    for k, v in risk.items():
        setattr(cfg.risk, k, v)
    broker = PaperBroker(100.0, fee_rate=0.0, slippage=0.0, min_cost=5.0)
    return Engine(cfg, AlwaysEnter(), broker, State(), tf_ms=TF), broker


def candle(i, o, h, l, c):
    return [T0 + i * TF, o, h, l, c, 1.0]


def test_stop_loss_and_cooldown():
    eng, broker = make_engine(cooldown_bars_after_loss=3)
    eng.on_closed_candle({}, 0, candle(0, 100, 100, 100, 100))
    assert eng.position["stop"] == pytest.approx(99.0)
    eng.check_exits_bar(candle(1, 100, 100, 98, 98.5))  # raakt stop van 1%
    assert eng.position is None
    assert eng.state["realized_pnl"] == pytest.approx(-0.98, abs=1e-6)
    assert eng.journal.rows[-1]["reason"] == "stop_loss"
    # afkoelperiode: direct opnieuw instappen mag niet
    eng.on_closed_candle({}, 1, candle(1, 98.5, 98.5, 98.5, 98.5))
    assert eng.position is None
    eng.on_closed_candle({}, 5, candle(5, 98.5, 98.5, 98.5, 98.5))
    assert eng.position is not None


def test_take_profit():
    eng, _ = make_engine()
    eng.on_closed_candle({}, 0, candle(0, 100, 100, 100, 100))
    eng.check_exits_bar(candle(1, 100, 103, 100, 102.5))
    assert eng.position is None
    assert eng.state["realized_pnl"] == pytest.approx(98 * 0.02)


def test_daily_loss_limit_blocks_entries_until_next_day():
    eng, _ = make_engine(max_daily_loss_eur=1.0, cooldown_bars_after_loss=0)
    eng.on_closed_candle({}, 0, candle(0, 100, 100, 100, 100))
    eng.check_exits_bar(candle(1, 100, 100, 95, 95))  # -1% van ~98 EUR is net onder limiet
    eng.on_closed_candle({}, 1, candle(1, 95, 95, 95, 95))
    eng.check_exits_bar(candle(2, 95, 95, 90, 90))
    assert eng.state["day_pnl"] <= -1.0
    eng.on_closed_candle({}, 3, candle(3, 90, 90, 90, 90))
    assert eng.position is None
    assert eng.entry_block_reason(T0 + 4 * TF, 90) == "daglimiet verlies"
    next_day = 288
    eng.on_closed_candle({}, next_day, candle(next_day, 90, 90, 90, 90))
    assert eng.position is not None


def test_total_loss_halts_bot():
    eng, _ = make_engine(max_total_loss_eur=1.5, max_daily_loss_eur=100, cooldown_bars_after_loss=0)
    i = 0
    while not eng.state["halted"] and i < 20:
        eng.on_closed_candle({}, i, candle(i, 100, 100, 100, 100))
        eng.check_exits_bar(candle(i + 1, 100, 100, 90, 90))
        i += 2
    assert eng.state["halted"]
    eng.on_closed_candle({}, i, candle(i, 100, 100, 100, 100))
    assert eng.position is None


def test_flatten_at_end_of_day():
    eng, _ = make_engine()
    eng.flatten_at = 23 * 60 + 50
    eng.no_entry_after = 23 * 60
    i = 22 * 12  # 22:00
    eng.on_closed_candle({}, i, candle(i, 100, 100, 100, 100))
    assert eng.position is not None
    j = 23 * 12 + 9  # candle 23:45-23:50
    eng.on_closed_candle({}, j, candle(j, 100, 100, 100, 100))
    assert eng.position is None
    assert eng.journal.rows[-1]["reason"] == "einde_dag"


def test_budget_never_exceeds_start_capital():
    cfg = Config()
    broker = PaperBroker(10_000.0)
    eng = Engine(cfg, AlwaysEnter(), broker, State(), tf_ms=TF)
    assert eng.budget() == pytest.approx(100 * 0.98)


def test_state_persistence(tmp_path):
    p = tmp_path / "state.json"
    s = State(p)
    s["realized_pnl"] = -3.0
    s.save()
    assert State(p)["realized_pnl"] == -3.0


# ---------- backtest ----------
def test_backtest_synthetic_is_consistent():
    cfg = load_config("config.toml")
    candles = synthetic_candles(n=288 * 20)
    r = run_backtest(cfg, candles, TF)
    assert r["trades"] > 0
    assert r["resultaat_eur"] == pytest.approx(r["eind_eur"] - 100, abs=0.01)
    assert r["eind_eur"] > 100 - cfg.risk.max_total_loss_eur - 3  # verlieslimiet werkt


def test_strategy_signal_on_crossover():
    s = EmaRsiStrategy(Config().strategy)
    closes = [100 + i * 0.01 for i in range(150)] + [101.5 - i * 0.1 for i in range(10)] + \
             [100.5 + i * 0.15 for i in range(20)]
    candles = [[T0 + i * TF, c, c, c, c, 1] for i, c in enumerate(closes)]
    ind = s.compute(candles)
    hits = [i for i in range(len(candles)) if s.should_enter(ind, i)]
    assert hits, "verwacht minstens één instapsignaal"
    for i in hits:
        assert ind["fast"][i] > ind["slow"][i] and ind["close"][i] > ind["trend"][i]


# ---------- live broker met nep-exchange ----------
class FakeExchange:
    def __init__(self):
        self.balance = {"EUR": 100.0, "BTC": 0.0}
        self.orders = {}

    def load_markets(self):
        pass

    def market(self, symbol):
        return {"base": "BTC", "quote": "EUR",
                "limits": {"cost": {"min": 1}, "amount": {"min": 0.00001}}}

    def fetch_balance(self):
        return {"free": dict(self.balance)}

    def cost_to_precision(self, s, c):
        return f"{c:.2f}"

    def amount_to_precision(self, s, a):
        return f"{a:.8f}"

    def create_market_buy_order_with_cost(self, symbol, cost):
        price = 50_000.0
        filled = cost / price
        fee = filled * 0.001  # OKX rekent koopfee in BTC
        self.balance["EUR"] -= cost
        self.balance["BTC"] += filled - fee
        return {"id": "1", "status": "closed", "filled": filled, "average": price, "cost": cost,
                "fee": {"cost": fee, "currency": "BTC"}}

    def create_market_sell_order(self, symbol, amount):
        price = 51_000.0
        gross = amount * price
        fee = gross * 0.001
        self.balance["BTC"] -= amount
        self.balance["EUR"] += gross - fee
        return {"id": "2", "status": "closed", "filled": amount, "average": price, "cost": gross,
                "fee": {"cost": fee, "currency": "EUR"}}


def test_live_broker_with_fake_exchange():
    ex = FakeExchange()
    ex.balance["BTC"] = 0.5  # eigen BTC van de gebruiker, mag niet verkocht worden
    b = LiveBroker(ex, "BTC/EUR", 0.0015)
    buy = b.buy(98.0, 50_000.0)
    assert buy.amount == pytest.approx(98 / 50_000 * 0.999)
    assert buy.fee_quote == pytest.approx(98 * 0.001)
    sell = b.sell(buy.amount, 51_000.0)
    assert sell.amount == pytest.approx(buy.amount)
    assert ex.balance["BTC"] == pytest.approx(0.5)  # alleen eigen positie verkocht
    assert sell.quote == pytest.approx(buy.amount * 51_000 * 0.999)
