from dataclasses import dataclass, field
from typing import List
from datetime import datetime

@dataclass(frozen=True)
class WeeklyBreakdown:

    week_number: int

    start_date: datetime

    end_date: datetime

    open: float
    high: float
    low: float
    close: float

    volume: float

    trading_days: int

    percent_change: float

    weekly_range: float




@dataclass(frozen=True)
class MonthlyBreakdown:

    month: int

    start_date: datetime
    end_date: datetime

    open: float
    high: float
    low: float
    close: float

    volume: float

    trading_days: int

    percent_change: float

    monthly_range: float


from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class LedgerStatistics:

    highest_day: datetime
    highest : float

    lowest_day: datetime
    lowest: float

    largest_up_day: datetime
    largest_up: float


    largest_down_day: datetime
    largest_down: float

    highest_volume_day: datetime
    highest_volume: float

    lowest_volume_day: datetime
    lowest_volume: float

    avg_true_range: float

    avg_daily_range: float

    volatility: float

    vpoc: float

    vah: float

    val: float



@dataclass(frozen=True)
class MonthlyLedger:

    symbol: str

    year: int
    month: int

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

    monthly_range: float

    weekly_breakdown: List[WeeklyBreakdown]

    daily_dates: List[str]

    statistics: LedgerStatistics


@dataclass(frozen=True)
class QuarterlyLedger:

    symbol: str

    year: int
    quarter: int

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

    quarterly_range: float

    monthly_breakdown: List[MonthlyBreakdown]

    months: List[str]

    statistics: LedgerStatistics


