import sys
import os
import numpy as np
import pandas as pd

from PySide6.QtWidgets import (
    QApplication,
    QFileDialog
)

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

from monte_carlo.data_exporter import create_output_directory, export_reports

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
# FILE PICKER (Qt Native)
# =========================================================
def choose_csv_file():

    app = QApplication.instance()

    if app is None:
        app = QApplication(sys.argv)

    file_path, _ = QFileDialog.getOpenFileName(
        None,
        "Select Monte Carlo CSV File",
        os.path.expanduser("~"),
        "CSV Files (*.csv);;All Files (*)"
    )

    return file_path

# =========================================================
# FILE NAME HELPER
# =========================================================
def get_csv_stem(path):

    return os.path.splitext(
        os.path.basename(path)
    )[0]


# =========================================================
# MAIN FUNCTION
# =========================================================
def monte_carlo(path: str):

    print(f"\nLoading CSV: {path}")

    df = pd.read_csv(path)

    # ======================================
    # Datetime Handling
    # ======================================

    for col in df.columns:

        if "time" in col.lower() or "date" in col.lower():

            try:
                df[col] = pd.to_datetime(
                    df[col],
                    errors='coerce'
                )

                df[col] = df[col].astype('int64') // 10**9

                print(f"Converted datetime column: {col}")

            except Exception as e:
                print(f"Failed converting {col}: {e}")

    # Keep numeric columns only
    df = df.select_dtypes(include=[np.number])

    print("\n=== FINAL NUMERIC COLUMNS ===")
    print(df.columns.tolist())

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
        method="std",
        k=2.0
    )

    print("\n=== DYNAMIC RANGE ===")
    print(f"Expected Move (2σ): ±{move:.2f}")
    print(f"Upper: {upper:.2f}, Lower: {lower:.2f}")

    # ==============================
    # Dynamic Time Horizon
    # ==============================
    T_seconds = compute_time_horizon(
        dt_paths,
        fraction=0.5
    )

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
    p_up_T = probability_of_hit_up_within_time(
        paths,
        dt_paths,
        upper,
        T_seconds
    )

    p_down_T = probability_of_hit_down_within_time(
        paths,
        dt_paths,
        lower,
        T_seconds
    )

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


    csv_name = get_csv_stem(path)
    output_dir = create_output_directory(csv_name)

    print(f"\nOutput Directory: {output_dir}")
    report = {
        "S0": float(S0),
        "gamma_flip": float(gamma_flip),

        "expected_move": float(move),
        "upper_level": float(upper),
        "lower_level": float(lower),

        "time_horizon_seconds": float(T_seconds),

        "prob_hit_upper": float(p_up),
        "prob_hit_lower": float(p_down),

        "prob_hit_upper_horizon": float(p_up_T),
        "prob_hit_lower_horizon": float(p_down_T),

        "confidence_probability": float(p),
        "confidence_lower": float(lo),
        "confidence_upper": float(hi)
    }

    # ==============================
    # Visualization
    # ==============================
    print("\n=== PLOTTING ===")

    # =========================================================
    # Visualization
    # =========================================================
    print("\n=== SAVING CHARTS ===")

    plot_paths(
        paths,
        n_plot=100,
        save_path=os.path.join(
            output_dir,
            f"{csv_name}_paths.png"
        )
    )

    plot_distribution(
        paths,
        save_path=os.path.join(
            output_dir,
            f"{csv_name}_distribution.png"
        )
    )

    plot_with_bands(
        paths,
        save_path=os.path.join(
            output_dir,
            f"{csv_name}_bands.png"
        )
    )

    plot_paths_with_levels(
        paths,
        S0,
        gamma_flip,
        [upper, lower],
        save_path=os.path.join(
            output_dir,
            f"{csv_name}_levels.png"
        )
    )

    plot_probability_curve_ci(
        paths,
        upper,
        save_path=os.path.join(
            output_dir,
            f"{csv_name}_probability_ci.png"
        )
    )

    plot_time_to_hit(
        paths,
        upper,
        save_path=os.path.join(
            output_dir,
            f"{csv_name}_time_to_hit.png"
        )
    )

    plot_up_down_prob(
        paths,
        upper,
        lower,
        save_path=os.path.join(
            output_dir,
            f"{csv_name}_up_down_probability.png"
        )
    )

    export_reports(output_dir, report, csv_name)

    print("\n=== COMPLETE ===")





# =========================================================
# ENTRY POINT
# =========================================================
if __name__ == "__main__":

    csv_file = choose_csv_file()

    if csv_file:
        monte_carlo(csv_file)