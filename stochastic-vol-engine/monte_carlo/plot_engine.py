import os
import matplotlib.pyplot as plt
import numpy as np


def save_simulation_plots(

    simulations,

    output_dir
):

    os.makedirs(
        output_dir,
        exist_ok=True
    )

    for feature, paths in simulations.items():

        plt.figure(figsize=(12, 6))

        # ================================================
        # PLOT PATHS
        # ================================================

        for i in range(min(50, len(paths))):

            plt.plot(
                paths[i],
                alpha=0.3
            )

        # ================================================
        # MEAN PATH
        # ================================================

        mean_path = np.mean(
            paths,
            axis=0
        )

        plt.plot(
            mean_path,
            linewidth=3
        )

        plt.title(
            f"{feature} Monte Carlo Paths"
        )

        plt.xlabel(
            "Step"
        )

        plt.ylabel(
            feature
        )

        plt.grid(True)

        # ================================================
        # SAVE
        # ================================================

        save_path = os.path.join(

            output_dir,

            f"{feature}_paths.png"
        )

        plt.savefig(
            save_path,
            dpi=300,
            bbox_inches="tight"
        )

        plt.close()