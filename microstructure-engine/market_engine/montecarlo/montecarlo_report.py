from pathlib import Path

import numpy as np


# =====================================================
# REPORT
# =====================================================

class MonteCarloReport:

    # =================================================
    # GENERATE
    # =================================================

    def generate(

        self,

        df,

        output_path,

        symbol
    ):

        # ---------------------------------------------
        # TERMINAL
        # ---------------------------------------------

        terminal = (

            df.groupby("path")[
                "cum_dS"
            ]
            .last()
            .values
        )

        # ---------------------------------------------
        # METRICS
        # ---------------------------------------------

        expected_return = np.mean(
            terminal
        )

        volatility = np.std(
            terminal
        )

        var95 = np.percentile(

            terminal,

            5
        )

        cvar95 = np.mean(

            terminal[
                terminal <= var95
            ]
        )

        bullish = np.mean(
            terminal > 0
        )

        bearish = np.mean(
            terminal < 0
        )

        entropy = df[
            "entropy"
        ].mean()

        hv = df[
            "hv"
        ].mean()

        # ---------------------------------------------
        # TEXT
        # ---------------------------------------------

        text = f"""
==================================================
MONTE CARLO REPORT
==================================================

Symbol: {symbol}

Expected Return:
{expected_return:.6f}

Volatility:
{volatility:.6f}

VaR95:
{var95:.6f}

CVaR95:
{cvar95:.6f}

Bullish Probability:
{bullish:.4f}

Bearish Probability:
{bearish:.4f}

Average Entropy:
{entropy:.4f}

Average HV:
{hv:.6f}

==================================================
"""

        # ---------------------------------------------
        # SAVE
        # ---------------------------------------------

        with open(

            output_path,

            "w"

        ) as f:

            f.write(text)

        return text