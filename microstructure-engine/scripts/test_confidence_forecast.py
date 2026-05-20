from pathlib import Path
import pandas as pd
import numpy as np


# =====================================================
# CONFIG
# =====================================================

CLUSTER_FILE = (
    "data/clusters/test_clusters.parquet"
)

HORIZON = 1


# =====================================================
# LOAD
# =====================================================

def load_data():

    path = Path(CLUSTER_FILE)

    if not path.exists():

        raise Exception(
            "Cluster parquet missing"
        )

    return pd.read_parquet(path)


# =====================================================
# PREPARE
# =====================================================

def prepare(df):

    df = df.sort_values(
        by="time"
    ).reset_index(drop=True)

    df["next_cluster"] = (
        df["cluster"]
        .shift(-HORIZON)
    )

    df["future_dS"] = (
        df["dS_avg"]
        .shift(-HORIZON)
    )

    df = df.dropna()

    df["next_cluster"] = (
        df["next_cluster"]
        .astype(int)
    )

    return df


# =====================================================
# ENTROPY
# =====================================================

def compute_entropy(probabilities):

    probs = np.array(probabilities)

    probs = probs[probs > 0]

    if len(probs) == 0:

        return 0.0

    return -np.sum(

        probs
        *
        np.log2(probs)
    )


# =====================================================
# FORECAST
# =====================================================

def compute_forecasts(df):

    clusters = sorted(
        df["cluster"].unique()
    )

    results = []

    for cluster in clusters:

        subset = df[
            df["cluster"]
            ==
            cluster
        ]

        # -----------------------------------------
        # TRANSITION PROBS
        # -----------------------------------------

        next_counts = (

            subset["next_cluster"]

            .value_counts(normalize=True)
        )

        probabilities = next_counts.values

        entropy = compute_entropy(
            probabilities
        )

        # -----------------------------------------
        # CONDITIONAL RETURN
        # -----------------------------------------

        future_returns = subset[
            "future_dS"
        ]

        expected_return = np.mean(
            future_returns
        )

        variance = np.var(
            future_returns
        )

        std_dev = np.std(
            future_returns
        )

        # -----------------------------------------
        # CONFIDENCE
        # -----------------------------------------

        confidence = (
            1
            /
            (1 + entropy)
        )

        # -----------------------------------------
        # FORECAST SCORE
        # -----------------------------------------

        forecast_score = (
            expected_return
            *
            confidence
        )

        # -----------------------------------------
        # DIRECTIONAL PROBS
        # -----------------------------------------

        up_prob = np.mean(
            future_returns > 0
        )

        down_prob = np.mean(
            future_returns < 0
        )

        # -----------------------------------------
        # STORE
        # -----------------------------------------

        results.append({

            "cluster": cluster,

            "samples": len(subset),

            "expected_return": expected_return,

            "variance": variance,

            "std_dev": std_dev,

            "entropy": entropy,

            "confidence": confidence,

            "forecast_score": forecast_score,

            "P(up)": up_prob,

            "P(down)": down_prob,
        })

    return pd.DataFrame(results)


# =====================================================
# MAIN
# =====================================================

def main():

    # -------------------------------------------------
    # LOAD
    # -------------------------------------------------

    df = load_data()

    # -------------------------------------------------
    # PREPARE
    # -------------------------------------------------

    df = prepare(df)

    # -------------------------------------------------
    # FORECASTS
    # -------------------------------------------------

    forecasts = compute_forecasts(df)

    # -------------------------------------------------
    # DISPLAY
    # -------------------------------------------------

    print("\n")

    print("=" * 80)

    print("CONFIDENCE-WEIGHTED FORECASTS")

    print("=" * 80)

    print(

        forecasts.round(6)
    )

    # -------------------------------------------------
    # INTERPRETATION
    # -------------------------------------------------

    print("\n")

    print("=" * 80)

    print("REGIME INTERPRETATION")

    print("=" * 80)

    for _, row in forecasts.iterrows():

        cluster = int(
            row["cluster"]
        )

        forecast = row[
            "forecast_score"
        ]

        confidence = row[
            "confidence"
        ]

        entropy = row[
            "entropy"
        ]

        print("\n")

        print(
            f"Cluster {cluster}"
        )

        print("-" * 50)

        print(
            f"Forecast Score: "
            f"{forecast:.6f}"
        )

        print(
            f"Confidence: "
            f"{confidence:.6f}"
        )

        print(
            f"Entropy: "
            f"{entropy:.6f}"
        )

        # -----------------------------------------
        # LABEL
        # -----------------------------------------

        if forecast > 0:

            direction = "Bullish"

        elif forecast < 0:

            direction = "Bearish"

        else:

            direction = "Neutral"

        print(
            f"Directional Bias: "
            f"{direction}"
        )

    # -------------------------------------------------
    # SAVE
    # -------------------------------------------------

    output_dir = Path(
        "data/forecasts"
    )

    output_dir.mkdir(

        parents=True,

        exist_ok=True
    )

    output_file = (
        output_dir
        /
        "confidence_forecasts.csv"
    )

    forecasts.to_csv(

        output_file,

        index=False
    )

    print("\n")

    print("=" * 80)

    print(
        f"✅ Saved forecasts "
        f"→ {output_file}"
    )

    print("=" * 80)


# =====================================================
# ENTRY
# =====================================================

if __name__ == "__main__":

    main()