import numpy as np
import pandas as pd


def simulate_paths(

    current_state,

    neighbor_state_deltas,

    n_paths=100,

    n_steps=30
):

    # ====================================================
    # STORAGE
    # ====================================================

    simulations = {}

    simulation_moments = {}

    columns = current_state.index.tolist()

    # ====================================================
    # INITIALIZE SIMULATION ARRAYS
    # ====================================================

    for col in columns:

        simulations[col] = np.zeros(
            (n_paths, n_steps)
        )

    # ====================================================
    # MONTE CARLO SIMULATION
    # ====================================================

    for path in range(n_paths):

        # ================================================
        # COPY INITIAL STATE
        # ================================================

        state = current_state.copy()

        # ================================================
        # TIME EVOLUTION
        # ================================================

        for step in range(n_steps):

            # ============================================
            # SAMPLE EMPIRICAL DELTA
            # ============================================

            sampled_delta = (

                neighbor_state_deltas
                .sample(1)
                .iloc[0]
            )

            # ============================================
            # UPDATE STATE
            # ============================================

            for col in columns:

                delta_col = f"delta_{col}"

                if delta_col in sampled_delta.index:

                    state[col] += sampled_delta[
                        delta_col
                    ]

                    simulations[col][
                        path,
                        step
                    ] = state[col]

    # ====================================================
    # MONTE CARLO MOMENTS
    # ====================================================

    for feature, paths in simulations.items():

        simulation_moments[
            feature
        ] = {

            "mean":

                float(
                    np.mean(paths)
                ),

            "std":

                float(
                    np.std(paths)
                ),

            "min":

                float(
                    np.min(paths)
                ),

            "max":

                float(
                    np.max(paths)
                ),

            "final_mean":

                float(
                    np.mean(
                        paths[:, -1]
                    )
                ),

            "final_std":

                float(
                    np.std(
                        paths[:, -1]
                    )
                )
        }

    # ====================================================
    # RETURN
    # ====================================================

    return (

        simulations,

        simulation_moments
    )