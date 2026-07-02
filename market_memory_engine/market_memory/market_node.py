from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class MarketNode:

    symbol: str

    year: int

    timeframe: str

    start_date: datetime
    end_date: datetime

    open: float
    high: float
    low: float
    close: float

    volume: float

    trading_days: int

    avg_daily_volume: float

    up_days: int
    down_days: int
    unchanged_days: int

    percent_change: float

    price_range: float