import numpy as np
import pandas as pd

from monte_carlo.monte_carlo_service import MonteCarloService
from monte_carlo.distribution import (
    DistributionAnalyzer,
    probability_of_hit,
    probability_of_hit_down,
    probability_of_hit_up_within_time,
    probability_of_hit_down_within_time,
    probability_with_confidence
)

from monte_carlo.plotting import (
    plot_paths,
    plot_distribution,
    plot_with_bands,
    plot_paths_with_levels,
    plot_probability_curve_ci,
    plot_time_to_hit,
    plot_up_down_prob
)


# =========================================================
# Dynamic Range
# =========================================================
def compute_dynamic_range(paths, S0, method="std", k=2.0):

    final_prices = paths[:, -1]

    if method == "std":
        std = np.std(final_prices)
        move = k * std
        upper = S0 + move
        lower = S0 - move

    elif method == "percentile":
        upper = np.percentile(final_prices, 95)
        lower = np.percentile(final_prices, 5)
        move = (upper - lower) / 2

    else:
        raise ValueError("method must be 'std' or 'percentile'")

    return upper, lower, move


# =========================================================
# Dynamic Time Horizon
# =========================================================
def compute_time_horizon(dt_paths, fraction=0.5):

    total_time = np.mean(np.sum(dt_paths, axis=1))
    return fraction * total_time


# =========================================================
# MAIN FUNCTION
# =========================================================
def monte_carlo(path: str):

    df = pd.read_csv(path)

    # ==============================
    # Run simulation
    # ==============================
    paths, dt_paths = MonteCarloService().run(df)

    result = DistributionAnalyzer().summarize(paths)

    print("\n=== MONTE CARLO RESULT ===")
    print(result)

    # ==============================
    # Setup state
    # ==============================
    S0 = df['ltp'].iloc[-1]
    gamma_flip = df['gammaFlip'].iloc[-1]

    # ==============================
    # Dynamic Range
    # ==============================
    upper, lower, move = compute_dynamic_range(
        paths,
        S0,
        method="std",   # change to "percentile" if needed
        k=2.0
    )

    print("\n=== DYNAMIC RANGE ===")
    print(f"Expected Move (2σ): ±{move:.2f}")
    print(f"Upper: {upper:.2f}, Lower: {lower:.2f}")

    # ==============================
    # Dynamic Time Horizon
    # ==============================
    T_seconds = compute_time_horizon(dt_paths, fraction=0.5)

    print("\n=== TIME HORIZON ===")
    print(f"Dynamic Horizon: {T_seconds / 3600:.2f} hours")

    # ==============================
    # Basic probabilities
    # ==============================
    p_up = probability_of_hit(paths, upper)
    p_down = probability_of_hit_down(paths, lower)

    print("\n=== BASIC PROBABILITIES ===")
    print(f"P(hit upper): {p_up:.4f}")
    print(f"P(hit lower): {p_down:.4f}")

    # ==============================
    # Time-based probabilities
    # ==============================
    p_up_T = probability_of_hit_up_within_time(paths, dt_paths, upper, T_seconds)
    p_down_T = probability_of_hit_down_within_time(paths, dt_paths, lower, T_seconds)

    print("\n=== TIME-BASED PROBABILITIES ===")
    print(f"P(hit upper in horizon): {p_up_T:.4f}")
    print(f"P(hit lower in horizon): {p_down_T:.4f}")

    # ==============================
    # Confidence Interval
    # ==============================
    p, lo, hi = probability_with_confidence(
        paths,
        upper,
        T=paths.shape[1]
    )

    print("\n=== CONFIDENCE INTERVAL ===")
    print(f"P(hit upper) = {p:.4f} [{lo:.4f}, {hi:.4f}]")

    # ==============================
    # Visualization
    # ==============================
    print("\n=== PLOTTING ===")

    plot_paths(paths, n_plot=100)
    plot_distribution(paths)
    plot_with_bands(paths)

    plot_paths_with_levels(paths, S0, gamma_flip, [upper, lower])
    plot_probability_curve_ci(paths, upper)
    plot_time_to_hit(paths, upper)
    plot_up_down_prob(paths, upper, lower)


# =========================================================
# ENTRY POINT
# =========================================================
if __name__ == "__main__":
    monte_carlo("backend/training_data/NIFTY.csv")