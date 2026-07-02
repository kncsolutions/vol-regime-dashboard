from dataclasses import dataclass, field
from typing import List

from market_memory_engine.market_memory.market_state import MarketState


@dataclass
class MonthlyState(MarketState):

    month: int

    daily_dates: List[str] = field(default_factory=list)

    def add_day(self, date):

        self.daily_dates.append(date)