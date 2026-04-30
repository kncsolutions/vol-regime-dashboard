import numpy as np
import pandas as pd


class PerformanceAnalyzer:

    def __init__(self, freq_per_day=375):
        """
        freq_per_day:
            ~375 for 1-min intraday (6.25 hours)
            adjust based on your data frequency
        """
        self.freq = freq_per_day

    # =====================================================
    # BASIC RETURNS
    # =====================================================
    def compute_returns(self, df):
        df = df.copy()

        df["returns"] = df["pnl"]
        df["cum_returns"] = df["capital"] / df["capital"].iloc[0] - 1

        return df

    # =====================================================
    # SHARPE RATIO
    # =====================================================
    def sharpe_ratio(self, returns):
        mean = returns.mean()
        std = returns.std()

        if std == 0:
            return 0.0

        sharpe = (mean / std) * np.sqrt(self.freq)
        return sharpe

    # =====================================================
    # MAX DRAWDOWN
    # =====================================================
    def max_drawdown(self, capital):
        peak = capital.expanding(min_periods=1).max()
        drawdown = (capital - peak) / peak

        return drawdown.min(), drawdown

    # =====================================================
    # WIN RATE
    # =====================================================
    def win_rate(self, returns):
        wins = (returns > 0).sum()
        total = len(returns)

        if total == 0:
            return 0.0

        return wins / total

    # =====================================================
    # PROFIT FACTOR
    # =====================================================
    def profit_factor(self, returns):
        gains = returns[returns > 0].sum()
        losses = abs(returns[returns < 0].sum())

        if losses == 0:
            return np.inf

        return gains / losses

    # =====================================================
    # REGIME-WISE PERFORMANCE
    # =====================================================
    def regime_performance(self, df):
        if "hmm_state" not in df.columns:
            return None

        grouped = df.groupby("hmm_state")["pnl"]

        summary = pd.DataFrame({
            "mean_return": grouped.mean(),
            "std_return": grouped.std(),
            "count": grouped.count(),
            "total_return": grouped.sum()
        })

        return summary

    # =====================================================
    # SIGNAL-WISE PERFORMANCE
    # =====================================================
    def signal_performance(self, df):
        if "signal" not in df.columns:
            return None

        grouped = df.groupby("signal")["pnl"]

        summary = pd.DataFrame({
            "mean_return": grouped.mean(),
            "count": grouped.count(),
            "total_return": grouped.sum()
        })

        return summary

    # =====================================================
    # FULL REPORT
    # =====================================================
    def analyze(self, df):

        df = self.compute_returns(df)

        # 🔥 ADD HERE (after returns are computed, before grouping)
        df["pnl_signal"] = df["signal"].shift(1)

        returns = df["returns"]
        capital = df["capital"]

        sharpe = self.sharpe_ratio(returns)
        max_dd, dd_series = self.max_drawdown(capital)
        win = self.win_rate(returns)
        pf = self.profit_factor(returns)

        regime_perf = self.regime_performance(df)

        # 🔥 USE shifted signal for correct attribution
        signal_perf = df.groupby("pnl_signal")["pnl"].agg(
            mean_return="mean",
            count="count",
            total_return="sum"
        )

        report = {
            "sharpe": sharpe,
            "max_drawdown": max_dd,
            "win_rate": win,
            "profit_factor": pf,
            "final_return": capital.iloc[-1] / capital.iloc[0] - 1,
            "regime_performance": regime_perf,
            "signal_performance": signal_perf
        }

        return report, df