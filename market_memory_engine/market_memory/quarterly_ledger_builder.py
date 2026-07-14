import pandas as pd

from market_memory_engine.market_memory.ledger_models import (
MonthlyBreakdown, QuarterlyLedger, LedgerStatistics)

from market_memory_engine.analytics.volume_profile import VolumeProfileCalculator
class QuarterlyLedgerBuilder:

    @staticmethod
    def build(df: pd.DataFrame):

        df = df.copy()

        df["date"] = pd.to_datetime(df["date"])

        df["year"] = df["date"].dt.year

        df["quarter"] = ((df["date"].dt.month - 1) // 3) + 1

        ledgers = []

        grouped = df.groupby(["year", "quarter"])

        for (year, quarter), data in grouped:
            data = data.sort_values("date").reset_index(drop=True)
            highest_day = data.loc[
                data["high"].idxmax(),
                "date"
            ]
            highest = data.loc[
                data["high"].idxmax(),
                "high"
            ]

            lowest_day = data.loc[
                data["low"].idxmin(),
                "date"
            ]
            lowest = data.loc[
                data["low"].idxmin(),
                "low"
            ]
            daily_return = (
                    (data["close"] - data["open"])
                    / data["open"]
            )
            largest_up_day = data.loc[
                daily_return.idxmax(),
                "date"
            ]
            largest_up = daily_return[daily_return.idxmax()]
            largest_down_day = data.loc[
                daily_return.idxmin(),
                "date"
            ]
            largest_down = daily_return[daily_return.idxmin()]
            highest_volume_day = data.loc[
                data["volume"].idxmax(),
                "date"
            ]
            highest_volume = data.loc[
                data["volume"].idxmax(),
                "volume"
            ]
            lowest_volume_day = data.loc[
                data["volume"].idxmin(),
                "date"
            ]
            lowest_volume = data.loc[
                data["volume"].idxmin(),
                "volume"
            ]

            daily_range = (
                    data["high"] - data["low"]
            )
            avg_daily_range = float(
                daily_range.mean()
            )
            previous_close = data["close"].shift(1)

            true_range = pd.concat(

                [

                    data["high"] - data["low"],

                    (data["high"] - previous_close).abs(),

                    (data["low"] - previous_close).abs()

                ],

                axis=1

            ).max(axis=1)

            avg_true_range = float(
                true_range.mean()
            )
            volatility = float(

                (data["high"].max() - data["low"].min())

                /

                data["close"].mean()

            )
            vpoc, vah, val = VolumeProfileCalculator.calculate(
                data
            )
            statistics = LedgerStatistics(

                highest_day=highest_day,
                highest=highest,

                lowest_day=lowest_day,
                lowest=lowest,

                largest_up_day=largest_up_day,
                largest_up=largest_up,

                largest_down_day=largest_down_day,
                largest_down=largest_down,

                highest_volume_day=highest_volume_day,
                highest_volume=highest_volume,

                lowest_volume_day=lowest_volume_day,
                lowest_volume=lowest_volume,

                avg_true_range=avg_true_range,

                avg_daily_range=avg_daily_range,

                volatility=volatility,

                vpoc = vpoc,

                vah = vah,

                val = val
            )
            data["month"] = data["date"].dt.month
            monthly_breakdown = []

            monthly_groups = data.groupby("month")

            for month_number, month_data in monthly_groups:
                month_data = month_data.sort_values("date").reset_index(drop=True)

                percent_change = (
                                         (
                                                 month_data.iloc[-1]["close"]
                                                 - month_data.iloc[0]["open"]
                                         )
                                         / month_data.iloc[0]["open"]
                                 ) * 100.0

                monthly_range = float(
                    month_data["high"].max()
                    - month_data["low"].min()
                )

                monthly_breakdown.append(

                    MonthlyBreakdown(

                        month=int(month_number),

                        start_date=month_data.iloc[0]["date"],

                        end_date=month_data.iloc[-1]["date"],

                        open=float(month_data.iloc[0]["open"]),

                        high=float(month_data["high"].max()),

                        low=float(month_data["low"].min()),

                        close=float(month_data.iloc[-1]["close"]),

                        volume=float(month_data["volume"].sum()),

                        trading_days=len(month_data),

                        percent_change=float(percent_change),

                        monthly_range=monthly_range,
                    )
                )

            months = (
                data["date"]
                .dt.strftime("%Y-%m")
                .unique()
                .tolist()
            )

            previous_close = data["close"].shift(1)

            up_days = (data["close"] > previous_close).sum()

            down_days = (data["close"] < previous_close).sum()

            unchanged_days = (data["close"] == previous_close).sum()

            avg_daily_volume = float(data["volume"].mean())

            percent_change = (
                                     (data.iloc[-1]["close"] - data.iloc[0]["open"])
                                     / data.iloc[0]["open"]
                             ) * 100.0

            price_range = float(
                data["high"].max() - data["low"].min()
            )
            ledger = QuarterlyLedger(

                symbol=data.iloc[0]["symbol"],

                year=year,

                quarter=quarter,

                start_date=data.iloc[0]["date"],

                end_date=data.iloc[-1]["date"],

                open=float(data.iloc[0]["open"]),

                high=float(data["high"].max()),

                low=float(data["low"].min()),

                close=float(data.iloc[-1]["close"]),

                volume=float(data["volume"].sum()),

                trading_days=len(data),

                avg_daily_volume=avg_daily_volume,

                up_days=int(up_days),

                down_days=int(down_days),

                unchanged_days=int(unchanged_days),

                percent_change=float(percent_change),

                quarterly_range=price_range,
                monthly_breakdown=monthly_breakdown,

                months=months,
                statistics=statistics
            )

            ledgers.append(ledger)

        return ledgers