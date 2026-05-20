from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


# =====================================================
# PLOTTER
# =====================================================

class MonteCarloPlotter:

    # =================================================
    # PATH CHART
    # =================================================

    def plot_paths(

        self,

        df,

        output_path
    ):

        plt.figure(figsize=(12, 7))

        for path_id in df["path"].unique():

            path_df = df[
                df["path"] == path_id
            ]

            plt.plot(

                path_df["step"],

                path_df["cum_dS"],

                alpha=0.3
            )

        plt.xlabel("Step")

        plt.ylabel("Cumulative Return")

        plt.title(
            "Monte Carlo Paths"
        )

        plt.grid(True)

        plt.tight_layout()

        plt.savefig(
            output_path
        )

        plt.close()

    # =================================================
    # DISTRIBUTION
    # =================================================

    def plot_distribution(

        self,

        df,

        output_path
    ):

        terminal = (

            df.groupby("path")[
                "cum_dS"
            ]
            .last()
        )

        plt.figure(figsize=(10, 6))

        plt.hist(

            terminal,

            bins=30
        )

        plt.xlabel(
            "Terminal Return"
        )

        plt.ylabel(
            "Frequency"
        )

        plt.title(
            "Terminal Return Distribution"
        )

        plt.grid(True)

        plt.tight_layout()

        plt.savefig(
            output_path
        )

        plt.close()