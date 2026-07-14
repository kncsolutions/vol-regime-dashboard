from market_memory_engine.recall.memory_recall import MarketMemoryRecall

import pandas as pd
class MemoryLogger:

    @staticmethod
    def print_month(memories):

        print("="*130)

        print(
            f"{'SYMBOL':<15}"
            f"{'OPEN':>10}"
            f"{'HIGH':>10}"
            f"{'LOW':>10}"
            f"{'CLOSE':>10}"
            f"{'%':>8}"
            f"{'VOL(M)':>12}"
            f"{'UP':>6}"
            f"{'DOWN':>6}"
        )

        print("="*130)

        for m in memories:

            d = m["ledger"]

            print(

                f"{d['symbol']:<15}"

                f"{d['open']:>10.2f}"

                f"{d['high']:>10.2f}"

                f"{d['low']:>10.2f}"

                f"{d['close']:>10.2f}"

                f"{d['percent_change']:>8.2f}"

                f"{d['volume']/1e6:>12.2f}"

                f"{d['up_days']:>6}"

                f"{d['down_days']:>6}"

            )

    @staticmethod
    def to_dataframe(memories):

        rows = []

        for memory in memories:
            d = memory["ledger"]

            stats = d.get("statistics", {})

            rows.append({

                "symbol": d["symbol"],
                "year": d["year"],
                "month": d.get("month"),
                "quarter": d.get("quarter"),

                "open": d["open"],
                "high": d["high"],
                "low": d["low"],
                "close": d["close"],

                "percent_change": d["percent_change"],

                "volume": d["volume"],

                "trading_days": d["trading_days"],

                "avg_daily_volume": d["avg_daily_volume"],

                "up_days": d["up_days"],
                "down_days": d["down_days"],
                "unchanged_days": d["unchanged_days"],

                "range": d.get(
                    "monthly_range",
                    d.get("quarterly_range")
                ),

                "volatility": stats.get("volatility"),

                "avg_true_range": stats.get("avg_true_range"),

                "avg_daily_range": stats.get("avg_daily_range"),

                "highest_day": stats.get("highest_day"),

                "lowest_day": stats.get("lowest_day"),

                "vpoc": stats.get("vpoc"),
                "vah": stats.get("vah"),
                "val": stats.get("val"),


            })

        return pd.DataFrame(rows)

from pathlib import Path


class QueryOutput:


    @staticmethod
    def save(
            df,
            timeframe,
            year,
            month=None,
            quarter=None,
            filename="summary"
    ):

        timeframe = timeframe.upper()

        if timeframe == "MONTHLY":

            folder = f"{year}_{month:02d}"

        elif timeframe == "QUARTERLY":

            folder = f"{year}_Q{quarter}"

        else:

            raise ValueError(
                f"Unknown timeframe : {timeframe}"
            )

        output_dir = (

                Path("query_op")

                / timeframe

                / folder

        )

        output_dir.mkdir(

            parents=True,

            exist_ok=True

        )

        csv_file = output_dir / f"{filename}.csv"

        xlsx_file = output_dir / f"{filename}.xlsx"

        parquet_file = output_dir / f"{filename}.parquet"

        df.to_csv(

            csv_file,

            index=False

        )

        df.to_excel(

            xlsx_file,

            index=False

        )

        df.to_parquet(

            parquet_file,

            index=False

        )

        print(f"Saved : {csv_file}")

        print(f"Saved : {xlsx_file}")

        print(f"Saved : {parquet_file}")

if __name__ == "__main__":
    recall = MarketMemoryRecall(
        "market_memory"
    )

    june = recall.recall_month(2026, 6)

    MemoryLogger.print_month(june)

    june_df = MemoryLogger.to_dataframe(june)


    QueryOutput.save(

        df=june_df,

        timeframe="MONTHLY",

        year=2026,

        month=6

    )



    q2 = recall.recall_quarter(2026, 2)
    q2_df = MemoryLogger.to_dataframe(q2)
    QueryOutput.save(

        df=q2_df,

        timeframe="QUARTERLY",

        year=2026,

        quarter=2

    )
    MemoryLogger.print_month(q2)
    # print(q2)