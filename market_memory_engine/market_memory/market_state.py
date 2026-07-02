from dataclasses import dataclass

from market_node import MarketNode


@dataclass
class MarketState(MarketNode):

    def update_high(self, price):

        if price > self.high:
            self.high = price

    def update_low(self, price):

        if price < self.low:
            self.low = price

    def update_close(self, price):

        self.close = price

    def add_volume(self, volume):

        self.volume += volume

    def increment_up_day(self):

        self.up_days += 1

    def increment_down_day(self):

        self.down_days += 1