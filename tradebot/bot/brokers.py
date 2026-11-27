"""Brokers: PaperBroker (gesimuleerd) en LiveBroker (echte orders via ccxt)."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

log = logging.getLogger("tradebot")


@dataclass
class Fill:
    price: float      # gemiddelde uitvoeringsprijs
    amount: float     # netto hoeveelheid base (bijv. BTC) gekocht/verkocht
    quote: float      # buy: uitgegeven EUR; sell: netto ontvangen EUR
    fee_quote: float  # betaalde fee omgerekend naar EUR


class PaperBroker:
    """Simuleert orders met fee en slippage. Gebruikt in backtest en paper-modus."""

    def __init__(self, quote: float, base: float = 0.0, fee_rate: float = 0.0015,
                 slippage: float = 0.0005, min_cost: float = 5.0):
        self.quote = quote
        self.base = base
        self.fee_rate = fee_rate
        self.slippage = slippage
        self._min_cost = min_cost

    def quote_free(self) -> float:
        return self.quote

    def base_free(self) -> float:
        return self.base

    def min_cost(self, price: float) -> float:
        return self._min_cost

    def buy(self, cost: float, price: float) -> Fill:
        cost = min(cost, self.quote)
        fill_price = price * (1 + self.slippage)
        fee = cost * self.fee_rate
        amount = (cost - fee) / fill_price
        self.quote -= cost
        self.base += amount
        return Fill(fill_price, amount, cost, fee)

    def sell(self, amount: float, price: float) -> Fill:
        amount = min(amount, self.base)
        fill_price = price * (1 - self.slippage)
        gross = amount * fill_price
        fee = gross * self.fee_rate
        self.base -= amount
        self.quote += gross - fee
        return Fill(fill_price, amount, gross - fee, fee)


class LiveBroker:
    """Plaatst echte market-orders via ccxt. Verkoopt nooit meer dan de bot zelf kocht."""

    def __init__(self, exchange, symbol: str, fee_rate: float):
        self.ex = exchange
        self.symbol = symbol
        self.fee_rate = fee_rate
        self.ex.load_markets()
        self.market = self.ex.market(symbol)
        self.base_ccy = self.market["base"]
        self.quote_ccy = self.market["quote"]

    def _balance(self, ccy: str) -> float:
        bal = self.ex.fetch_balance()
        return float((bal.get("free") or {}).get(ccy) or 0.0)

    def quote_free(self) -> float:
        return self._balance(self.quote_ccy)

    def base_free(self) -> float:
        return self._balance(self.base_ccy)

    def min_cost(self, price: float) -> float:
        limits = self.market.get("limits") or {}
        min_cost = (limits.get("cost") or {}).get("min") or 0.0
        min_amount = (limits.get("amount") or {}).get("min") or 0.0
        return max(float(min_cost), float(min_amount) * price, 1.0)

    def _wait_closed(self, order: dict) -> dict:
        for _ in range(15):
            if order.get("status") == "closed" and order.get("filled"):
                return order
            time.sleep(1)
            order = self.ex.fetch_order(order["id"], self.symbol)
        if not order.get("filled"):
            raise RuntimeError(f"Order {order.get('id')} niet (volledig) uitgevoerd: {order.get('status')}")
        return order

    def _fee(self, order: dict) -> tuple[float, str | None]:
        fees = order.get("fees") or ([order["fee"]] if order.get("fee") else [])
        total, ccy = 0.0, None
        for f in fees:
            if f and f.get("cost") is not None:
                total += abs(float(f["cost"]))
                ccy = f.get("currency")
        return total, ccy

    def buy(self, cost: float, price: float) -> Fill:
        cost = float(self.ex.cost_to_precision(self.symbol, cost))
        log.info("LIVE BUY %s voor %.2f %s", self.symbol, cost, self.quote_ccy)
        order = self.ex.create_market_buy_order_with_cost(self.symbol, cost)
        order = self._wait_closed(order)
        filled = float(order["filled"])
        avg = float(order.get("average") or (order.get("cost") or cost) / filled)
        spent = float(order.get("cost") or filled * avg)
        fee, ccy = self._fee(order)
        if ccy == self.base_ccy:
            net_amount, fee_quote = filled - fee, fee * avg
        elif ccy == self.quote_ccy:
            net_amount, fee_quote = filled, fee
        else:  # fee onbekend: schatten
            fee_quote = spent * self.fee_rate
            net_amount = filled - fee_quote / avg
        return Fill(avg, net_amount, spent, fee_quote)

    def sell(self, amount: float, price: float) -> Fill:
        amount = min(amount, self.base_free())
        amount = float(self.ex.amount_to_precision(self.symbol, amount))
        if amount <= 0:
            raise RuntimeError("Niets te verkopen (base-saldo is 0)")
        log.info("LIVE SELL %s %.8f %s", self.symbol, amount, self.base_ccy)
        order = self.ex.create_market_sell_order(self.symbol, amount)
        order = self._wait_closed(order)
        filled = float(order["filled"])
        avg = float(order.get("average") or price)
        gross = float(order.get("cost") or filled * avg)
        fee, ccy = self._fee(order)
        if ccy == self.quote_ccy:
            fee_quote, net = fee, gross - fee
        elif ccy == self.base_ccy:  # fee uit de base gehaald, EUR-opbrengst blijft bruto
            fee_quote, net = fee * avg, gross
        else:
            fee_quote = gross * self.fee_rate
            net = gross - fee_quote
        return Fill(avg, filled, net, fee_quote)
