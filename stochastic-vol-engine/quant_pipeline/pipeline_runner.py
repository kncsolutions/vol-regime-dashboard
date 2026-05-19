from backend.config import (
    FEATURE_COLUMNS,
)

from quant_pipeline.preprocessing import (
    preprocess
)

from quant_pipeline.feature_engineering import (
    create_features
)

from quant_pipeline.label_generation import (
    generate_labels
)

from quant_pipeline.scaling_engine import (
    scale_features
)

from quant_pipeline.knn_engine import (
    KNNEngine
)

from quant_pipeline.probability_engine import (
    estimate_probability
)

from monte_carlo.monte_carlo_engine import (
    simulate_paths
)

from monte_carlo.plot_engine import (
    save_simulation_plots
)

from quant_pipeline.summary_engine import (
    save_statistical_summary
)

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import os


# ============================================================
# REGIME ANALYZER
# ============================================================

def analyze_regime(

    regime_name,

    full_df,

    latest_feature_state,

    state_delta_columns
):

    print("\n================================================")
    print(f"REGIME ANALYSIS: {regime_name}")
    print("================================================")

    # ========================================================
    # REGIME FILTER
    # ========================================================

    regime_df = full_df[
        full_df["gex_regime"]
        == regime_name
    ].copy()

    # ========================================================
    # FEATURE MATRIX
    # ========================================================

    X = regime_df[
        FEATURE_COLUMNS
    ]

    y = regime_df[
        "long_profitable"
    ]

    # ========================================================
    # SCALE FEATURES
    # ========================================================

    scaler, X_scaled = scale_features(X)

    X_scaled_df = X.copy()

    X_scaled_df[:] = X_scaled

    # ========================================================
    # SCALE CURRENT STATE
    # ========================================================

    latest_state_scaled = scaler.transform(
        latest_feature_state
    )

    latest_state_scaled_df = (
        latest_feature_state.copy()
    )

    latest_state_scaled_df[:] = (
        latest_state_scaled
    )

    # ========================================================
    # FIT KNN
    # ========================================================

    knn = KNNEngine()

    knn.fit(X_scaled_df)

    # ========================================================
    # QUERY
    # ========================================================

    distances, indices = knn.query(
        latest_state_scaled_df
    )

    # ========================================================
    # NEIGHBOR ANALYSIS
    # ========================================================

    neighbor_df = regime_df.iloc[
        indices
    ].copy()

    neighbor_df["distance"] = distances

    neighbor_df = neighbor_df.sort_values(
        "distance"
    )

    print("\nNEAREST VOLATILITY ANALOGS")

    print(
        neighbor_df[[
            "datetime",
            "gex_regime",
            "IV",
            "skew_diff",
            "netGEX",
            "spread",
            "straddle_edge",
            "distance"
        ]]
    )

    # ========================================================
    # LOCAL STOCHASTIC DELTAS
    # ========================================================

    neighbor_state_deltas = regime_df.iloc[
        indices
    ][
        state_delta_columns
    ].copy()

    # ========================================================
    # LOCAL DRIFT
    # ========================================================

    local_drift = (
        neighbor_state_deltas.mean()
    )

    print("\n================================================")
    print("LOCAL STATE DRIFT")
    print("================================================")

    print(local_drift)

    # ========================================================
    # LOCAL COVARIANCE
    # ========================================================

    local_covariance = (
        neighbor_state_deltas.cov()
    )

    print("\n================================================")
    print("LOCAL STATE COVARIANCE")
    print("================================================")

    print(local_covariance)

    # ========================================================
    # EIGENVALUES
    # ========================================================

    covariance_eigenvalues = np.linalg.eigvals(
        local_covariance
    )

    # ========================================================
    # PROBABILITY ENGINE
    # ========================================================

    (
        probability,

        expected_edge,

        edge_variance,

        edge_volatility,

        positive_tail_probability,

        negative_tail_probability,

        contribution_df

    ) = estimate_probability(

        y,

        indices,

        distances,

        regime_df.iloc[
            indices
        ]["straddle_edge"]
    )

    # ========================================================
    # FEATURE DISPERSION
    # ========================================================

    feature_dispersion = (

        X.std()

        /

        X.std().sum()
    )

    # ========================================================
    # RETURN
    # ========================================================

    return {

        "regime_df":
            regime_df,

        "neighbor_df":
            neighbor_df,

        "neighbor_state_deltas":
            neighbor_state_deltas,

        "probability":
            probability,

        "expected_edge":
            expected_edge,

        "edge_variance":
            edge_variance,

        "edge_volatility":
            edge_volatility,

        "positive_tail_probability":
            positive_tail_probability,

        "negative_tail_probability":
            negative_tail_probability,

        "contributions":
            contribution_df,

        "local_drift":
            local_drift,

        "local_covariance":
            local_covariance,

        "covariance_eigenvalues":
            covariance_eigenvalues.tolist(),

        "feature_dispersion":
            feature_dispersion.to_dict()
    }


# ============================================================
# TRANSITION DYNAMICS
# ============================================================

def compute_transition_dynamics(

    full_df,

    latest_feature_state,

    current_regime
):

    print("\n================================================")
    print("TRANSITION DYNAMICS")
    print("================================================")

    transition_X = full_df[
        FEATURE_COLUMNS
    ]

    transition_y = np.where(

        full_df[
            "next_gex_regime"
        ] == "negative_gex",

        1,

        0
    )

    # ========================================================
    # SCALE
    # ========================================================

    (
        transition_scaler,
        transition_X_scaled

    ) = scale_features(
        transition_X
    )

    transition_X_scaled_df = (
        transition_X.copy()
    )

    transition_X_scaled_df[:] = (
        transition_X_scaled
    )

    # ========================================================
    # SCALE CURRENT STATE
    # ========================================================

    latest_transition_scaled = (
        transition_scaler.transform(
            latest_feature_state
        )
    )

    latest_transition_scaled_df = (
        latest_feature_state.copy()
    )

    latest_transition_scaled_df[:] = (
        latest_transition_scaled
    )

    # ========================================================
    # FIT KNN
    # ========================================================

    transition_knn = KNNEngine()

    transition_knn.fit(
        transition_X_scaled_df
    )

    # ========================================================
    # QUERY
    # ========================================================

    (
        transition_distances,

        transition_indices

    ) = transition_knn.query(
        latest_transition_scaled_df
    )

    # ========================================================
    # WEIGHTS
    # ========================================================

    transition_weights = 1.0 / (
        transition_distances + 1e-6
    )

    # ========================================================
    # PROBABILITY
    # ========================================================

    probability_negative_gex = (

        np.sum(

            transition_weights
            * transition_y[
                transition_indices
            ]

        )

        /

        np.sum(
            transition_weights
        )
    )

    probability_positive_gex = (
        1
        -
        probability_negative_gex
    )

    # ========================================================
    # PERSISTENCE
    # ========================================================

    if current_regime == "positive_gex":

        persistence_probability = (
            probability_positive_gex
        )

        flip_probability = (
            probability_negative_gex
        )

    else:

        persistence_probability = (
            probability_negative_gex
        )

        flip_probability = (
            probability_positive_gex
        )

    # ========================================================
    # ENTROPY
    # ========================================================

    epsilon = 1e-12

    transition_entropy = - (

        probability_positive_gex
        * np.log(
            probability_positive_gex
            + epsilon
        )

        +

        probability_negative_gex
        * np.log(
            probability_negative_gex
            + epsilon
        )
    )

    # ========================================================
    # TRANSITION MATRIX
    # ========================================================

    transition_counts = (

        full_df[
            "regime_transition"
        ]

        .value_counts(
            normalize=True
        )
    )

    transition_matrix = {

        "P_to_P":

            transition_counts.get(
                "positive_gex_to_positive_gex",
                0.0
            ),

        "P_to_N":

            transition_counts.get(
                "positive_gex_to_negative_gex",
                0.0
            ),

        "N_to_P":

            transition_counts.get(
                "negative_gex_to_positive_gex",
                0.0
            ),

        "N_to_N":

            transition_counts.get(
                "negative_gex_to_negative_gex",
                0.0
            )
    }

    positive_total = (

        transition_matrix["P_to_P"]

        +

        transition_matrix["P_to_N"]
    )

    negative_total = (

        transition_matrix["N_to_P"]

        +

        transition_matrix["N_to_N"]
    )

    transition_matrix_normalized = {

        "positive_gex": {

            "positive_gex":

                transition_matrix["P_to_P"]
                / positive_total,

            "negative_gex":

                transition_matrix["P_to_N"]
                / positive_total
        },

        "negative_gex": {

            "positive_gex":

                transition_matrix["N_to_P"]
                / negative_total,

            "negative_gex":

                transition_matrix["N_to_N"]
                / negative_total
        }
    }

    return {

        "probability_next_negative_gex":
            probability_negative_gex,

        "probability_next_positive_gex":
            probability_positive_gex,

        "regime_persistence_probability":
            persistence_probability,

        "regime_flip_probability":
            flip_probability,

        "transition_entropy":
            transition_entropy,

        "transition_matrix":
            transition_matrix_normalized
    }


# ============================================================
# ENTROPY HISTORY
# ============================================================

def compute_entropy_history(

    full_df,

    window=100
):

    entropy_history = []

    for i in range(

        window,

        len(full_df)
    ):

        local_regimes = full_df[
            "next_gex_regime"
        ].iloc[
            i-window:i
        ]

        p_positive = np.mean(
            local_regimes
            == "positive_gex"
        )

        p_negative = np.mean(
            local_regimes
            == "negative_gex"
        )

        epsilon = 1e-12

        entropy = - (

            p_positive
            * np.log(
                p_positive
                + epsilon
            )

            +

            p_negative
            * np.log(
                p_negative
                + epsilon
            )
        )

        entropy_history.append(
            entropy
        )

    return entropy_history[-20:]


# ============================================================
# MAIN PIPELINE
# ============================================================

def run_pipeline(df):

    # ========================================================
    # PREPROCESS
    # ========================================================

    df = preprocess(df)

    # ========================================================
    # FEATURES
    # ========================================================

    df = create_features(df)

    # ========================================================
    # TRANSITIONS
    # ========================================================

    df["next_gex_regime"] = (
        df["gex_regime"]
        .shift(-1)
    )

    df["regime_transition"] = (

        df["gex_regime"]

        + "_to_"

        + df["next_gex_regime"]
    )

    # ========================================================
    # LABELS
    # ========================================================

    df = generate_labels(df)

    # ========================================================
    # CLEAN
    # ========================================================

    full_df = df.dropna().copy()

    # ========================================================
    # CURRENT STATE
    # ========================================================

    latest_row = full_df.iloc[-1]

    latest_feature_state = latest_row[
        FEATURE_COLUMNS
    ].to_frame().T

    current_regime = latest_row[
        "gex_regime"
    ]

    # ========================================================
    # STATE DELTAS
    # ========================================================

    state_delta_columns = [

        "delta_IV",

        "delta_skew_diff",

        "delta_netGEX",

        "delta_flow",

        "delta_spread",

        "delta_imbalance",

        "delta_dS"
    ]

    # ========================================================
    # REGIME ANALYSIS
    # ========================================================

    regime_results = {}

    for regime_name in [

        "positive_gex",

        "negative_gex"

    ]:

        regime_result = analyze_regime(

            regime_name,

            full_df,

            latest_feature_state,

            state_delta_columns
        )

        # ====================================================
        # MONTE CARLO
        # ====================================================

        (
            simulations,

            simulation_moments

        ) = simulate_paths(

            current_state=
                latest_feature_state.iloc[0],

            neighbor_state_deltas=
                regime_result[
                    "neighbor_state_deltas"
                ],

            n_paths=200,

            n_steps=50
        )

        # ====================================================
        # OUTPUT DIRECTORY
        # ====================================================

        csv_name = "simulation"

        if "source_file" in df.attrs:

            csv_name = os.path.splitext(

                os.path.basename(
                    df.attrs["source_file"]
                )

            )[0]

        output_dir = os.path.join(

            "monte_carlo_output_knn_based",

            csv_name,

            regime_name
        )

        # ====================================================
        # SAVE PLOTS
        # ====================================================

        save_simulation_plots(

            simulations,

            output_dir
        )

        regime_result[
            "simulation_output_dir"
        ] = output_dir

        regime_result[
            "simulation_moments"
        ] = simulation_moments

        regime_results[
            regime_name
        ] = regime_result

    # ========================================================
    # DELTA EDGE
    # ========================================================

    delta_expected_edge = (

        regime_results[
            "negative_gex"
        ]["expected_edge"]

        -

        regime_results[
            "positive_gex"
        ]["expected_edge"]
    )

    delta_edge_volatility = (

        regime_results[
            "negative_gex"
        ]["edge_volatility"]

        -

        regime_results[
            "positive_gex"
        ]["edge_volatility"]
    )

    # ========================================================
    # TRANSITION DYNAMICS
    # ========================================================

    transition_result = compute_transition_dynamics(

        full_df,

        latest_feature_state,

        current_regime
    )

    # ========================================================
    # ENTROPY HISTORY
    # ========================================================

    entropy_history = compute_entropy_history(
        full_df
    )
    # ========================================================
    # REGIME DURATION STATISTICS
    # ========================================================

    regime_changes = (

            full_df["gex_regime"]

            !=

            full_df["gex_regime"]
            .shift()
    )

    regime_groups = regime_changes.cumsum()

    regime_durations = (

        full_df
        .groupby(regime_groups)
        .size()
    )

    regime_duration_stats = {

        "mean":

            float(
                regime_durations.mean()
            ),

        "median":

            float(
                regime_durations.median()
            ),

        "std":

            float(
                regime_durations.std()
            ),

        "max":

            int(
                regime_durations.max()
            ),

        "min":

            int(
                regime_durations.min()
            ),

        "total_regimes":

            int(
                len(regime_durations)
            )
    }

    # ========================================================
    # FINAL RESULT
    # ========================================================

    result = {

        "current_market_regime":
            current_regime,

        "positive_gex":
            regime_results[
                "positive_gex"
            ],

        "negative_gex":
            regime_results[
                "negative_gex"
            ],

        "delta_expected_edge":
            round(
                float(
                    delta_expected_edge
                ),
                4
            ),

        "delta_edge_volatility":
            round(
                float(
                    delta_edge_volatility
                ),
                4
            ),

        "entropy_history":
            entropy_history,
        "regime_duration_stats":
            regime_duration_stats,
    }

    result.update(
        transition_result
    )

    # ========================================================
    # SUMMARY
    # ========================================================

    print("\n================================================")
    print("FINAL VOLATILITY STATE SUMMARY")
    print("================================================")

    print(result)

    # ========================================================
    # SAVE SUMMARY
    # ========================================================

    summary_output_dir = os.path.join(

        "monte_carlo_output_knn_based",

        csv_name
    )

    save_statistical_summary(

        result=result,

        csv_name=csv_name,

        output_dir=summary_output_dir
    )

    return result