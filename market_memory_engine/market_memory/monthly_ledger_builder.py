import pandas as pd

from market_memory_engine.market_memory.ledger_models import(
    WeeklyBreakdown,
    LedgerStatistics,
    MonthlyLedger
)


class MonthlyLedgerBuilder:

    @staticmethod
    def build(df: pd.DataFrame):

        df = df.copy()

        df["date"] = pd.to_datetime(df["date"])

        df["year"] = df["date"].dt.year
        df["month"] = df["date"].dt.month

        ledgers = []

        grouped = df.groupby(["year", "month"])



        for (year, month), data in grouped:

            data = data.sort_values("date")
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

                volatility=volatility
            )
            data["week"] = data["date"].dt.isocalendar().week
            weekly_breakdown = []

            weekly_groups = data.groupby("week")

            for week_number, week_data in weekly_groups:
                week_data = week_data.sort_values("date").reset_index(drop=True)

                percent_change = (
                                         (
                                                 week_data.iloc[-1]["close"]
                                                 - week_data.iloc[0]["open"]
                                         )
                                         / week_data.iloc[0]["open"]
                                 ) * 100.0

                weekly_range = float(
                    week_data["high"].max()
                    - week_data["low"].min()
                )

                weekly_breakdown.append(

                    WeeklyBreakdown(

                        week_number=int(week_number),

                        start_date=week_data.iloc[0]["date"],

                        end_date=week_data.iloc[-1]["date"],

                        open=float(week_data.iloc[0]["open"]),

                        high=float(week_data["high"].max()),

                        low=float(week_data["low"].min()),

                        close=float(week_data.iloc[-1]["close"]),

                        volume=float(week_data["volume"].sum()),

                        trading_days=len(week_data),

                        percent_change=float(percent_change),

                        weekly_range=weekly_range,
                    )
                )
            previous_close = data["close"].shift(1)

            ledger = MonthlyLedger(

                symbol=data.iloc[0]["symbol"],

                year=year,
                month=month,

                start_date=data.iloc[0]["date"],
                end_date=data.iloc[-1]["date"],

                open=float(data.iloc[0]["open"]),
                high=float(data["high"].max()),
                low=float(data["low"].min()),
                close=float(data.iloc[-1]["close"]),

                volume=float(data["volume"].sum()),

                trading_days=len(data),

                up_days = (data["close"] > previous_close).sum(),

                down_days = (data["close"] < previous_close).sum(),

                unchanged_days = (data["close"] == previous_close).sum(),

                avg_daily_volume = float(data["volume"].mean()),

                percent_change = (
                                     (data.iloc[-1]["close"] - data.iloc[0]["open"])
                                     / data.iloc[0]["open"]
                             ) * 100.0,

                monthly_range = float(
                    data["high"].max() - data["low"].min()
                    ),

                weekly_breakdown=weekly_breakdown,

                daily_dates=data["date"].dt.strftime("%Y-%m-%d").tolist(),
                statistics = statistics

            )

            ledgers.append(ledger)

        return ledgers