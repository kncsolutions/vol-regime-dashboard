import numpy as np
import pandas as pd


class TradeAnalyzer:

    def __init__(self):
        pass

    # =====================================================
    # EXTRACT TRADES
    # =====================================================
    def extract_trades(self, df):
        """
        Build trade list from position time series
        A trade = contiguous non-zero position
        """

        trades = []

        in_trade = False
        entry_idx = None
        entry_price = None
        entry_signal = None

        for i in range(len(df)):
            row = df.iloc[i]
            pos = row["position"]

            # --- ENTRY ---
            if not in_trade and pos != 0:
                in_trade = True
                entry_idx = i
                entry_price = row["ltp"]
                entry_signal = row["signal"]

            # --- EXIT ---
            elif in_trade and pos == 0:
                exit_idx = i
                exit_price = row["ltp"]

                trade_df = df.iloc[entry_idx:exit_idx]

                pnl = trade_df["pnl"].sum()
                duration = exit_idx - entry_idx

                trades.append({
                    "entry_idx": entry_idx,
                    "exit_idx": exit_idx,
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "signal": entry_signal,
                    "pnl": pnl,
                    "duration": duration,
                    "return": pnl  # already normalized
                })

                in_trade = False

        return pd.DataFrame(trades)

    # =====================================================
    # BASIC TRADE STATS
    # =====================================================
    def trade_summary(self, trades):

        if len(trades) == 0:
            return {}

        returns = trades["return"]

        return {
            "num_trades": len(trades),
            "avg_return": returns.mean(),
            "median_return": returns.median(),
            "win_rate": (returns > 0).mean(),
            "avg_win": returns[returns > 0].mean() if (returns > 0).any() else 0,
            "avg_loss": returns[returns < 0].mean() if (returns < 0).any() else 0,
            "profit_factor": returns[returns > 0].sum() / abs(returns[returns < 0].sum())
            if (returns < 0).any() else np.inf,
        }

    # =====================================================
    # HOLDING TIME ANALYSIS
    # =====================================================
    def holding_time_analysis(self, trades):

        if len(trades) == 0:
            return {}

        durations = trades["duration"]

        return {
            "avg_duration": durations.mean(),
            "median_duration": durations.median(),
            "max_duration": durations.max(),
            "min_duration": durations.min(),
        }

    # =====================================================
    # PNL BY DURATION BUCKET
    # =====================================================
    def pnl_by_duration(self, trades):

        if len(trades) == 0:
            return pd.DataFrame()

        trades = trades.copy()

        trades["duration_bucket"] = pd.cut(
            trades["duration"],
            bins=[0, 5, 10, 20, 50, 100, np.inf],
            labels=["0-5", "5-10", "10-20", "20-50", "50-100", "100+"]
        )

        return trades.groupby("duration_bucket")["return"].agg(
            count="count",
            mean_return="mean",
            total_return="sum"
        )

    # =====================================================
    # SIGNAL-LEVEL TRADE PERFORMANCE
    # =====================================================
    def signal_trade_performance(self, trades):

        if len(trades) == 0:
            return pd.DataFrame()

        return trades.groupby("signal")["return"].agg(
            count="count",
            mean_return="mean",
            total_return="sum",
            win_rate=lambda x: (x > 0).mean()
        )

    # =====================================================
    # FULL ANALYSIS PIPELINE
    # =====================================================
    def analyze(self, df):

        trades = self.extract_trades(df)

        summary = self.trade_summary(trades)
        holding = self.holding_time_analysis(trades)
        duration_pnl = self.pnl_by_duration(trades)
        signal_perf = self.signal_trade_performance(trades)

        return {
            "summary": summary,
            "holding": holding,
            "duration_pnl": duration_pnl,
            "signal_trade_performance": signal_perf,
            "trades": trades
        }