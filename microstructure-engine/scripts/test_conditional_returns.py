from pathlib import Path

import numpy as np
import pandas as pd


# =====================================================
# LOAD CLUSTERED DATA
# =====================================================

path = (
    "data/clusters/"
    "test_clusters.parquet"
)

df = pd.read_parquet(path)

# =====================================================
# DISPLAY DATASET
# =====================================================

print("\n")

print("=" * 70)

print("DATASET")

print("=" * 70)

print(df.tail())

# =====================================================
# SYMBOL LOOP
# =====================================================

symbols = df["symbol"].unique()

for symbol in symbols:

    print("\n")

    print("=" * 70)

    print(symbol)

    print("=" * 70)

    # -------------------------------------------------
    # FILTER SYMBOL
    # -------------------------------------------------

    sdf = df[
        df["symbol"] == symbol
    ].copy()

    sdf = sdf.sort_values(
        "time"
    )

    sdf = sdf.reset_index(
        drop=True
    )

    # -------------------------------------------------
    # FUTURE RETURN
    # -------------------------------------------------

    sdf["future_dS"] = sdf[
        "dS_avg"
    ].shift(-1)

    # -------------------------------------------------
    # DROP LAST
    # -------------------------------------------------

    sdf = sdf.dropna(
        subset=["future_dS"]
    )

    # =================================================
    # CONDITIONAL STATS
    # =====================================================

    rows = []

    clusters = sorted(

        sdf["cluster"]
        .unique()
        .tolist()
    )

    for cluster in clusters:

        # ---------------------------------------------
        # FILTER
        # ---------------------------------------------

        cdf = sdf[
            sdf["cluster"] == cluster
        ]

        future_returns = cdf[
            "future_dS"
        ].values

        hv = np.std(
            future_returns
        )

        entropy = 0.0

        # ---------------------------------------------
        # PROBABILITIES
        # ---------------------------------------------

        p_up = np.mean(
            future_returns > 0
        )

        p_down = np.mean(
            future_returns < 0
        )

        p_flat = np.mean(
            future_returns == 0
        )

        # ---------------------------------------------
        # ENTROPY
        # ---------------------------------------------

        probs = [

            p_up,

            p_down,

            p_flat,
        ]

        for p in probs:

            if p > 0:

                entropy -= (

                    p
                    *
                    np.log2(p)
                )

        # ---------------------------------------------
        # STORE
        # ---------------------------------------------

        rows.append({

            "cluster":
                int(cluster),

            "samples":
                int(len(cdf)),

            "E[dS_t+1|S_t]":
                float(
                    np.mean(
                        future_returns
                    )
                ),

            "Var[dS_t+1|S_t]":
                float(
                    np.var(
                        future_returns
                    )
                ),

            "Std[dS_t+1|S_t]":
                float(hv),

            "P(dS>0)":
                float(p_up),

            "P(dS<0)":
                float(p_down),

            "P(dS=0)":
                float(p_flat),

            "entropy":
                float(entropy),
        })

    # =================================================
    # DATAFRAME
    # =====================================================

    conditional_df = pd.DataFrame(
        rows
    )

    # =================================================
    # DISPLAY
    # =====================================================

    print("\n")

    print("=" * 70)

    print(
        "CONDITIONAL RETURN STATISTICS"
    )

    print("=" * 70)

    print(
        conditional_df.round(6)
    )

    # =================================================
    # INTERPRETATION
    # =====================================================

    print("\n")

    print("=" * 70)

    print(
        "REGIME INTERPRETATION"
    )

    print("=" * 70)

    for _, row in conditional_df.iterrows():

        print("\n")

        print(
            f"Cluster "
            f"{int(row['cluster'])}"
        )

        print("-" * 40)

        print(
            f"Expected Future dS: "
            f"{row['E[dS_t+1|S_t]']:.6f}"
        )

        print(
            f"P(Up Move): "
            f"{row['P(dS>0)']:.3f}"
        )

        print(
            f"P(Down Move): "
            f"{row['P(dS<0)']:.3f}"
        )

        print(
            f"Entropy: "
            f"{row['entropy']:.4f}"
        )

        # ---------------------------------------------
        # LABEL
        # ---------------------------------------------

        if row["E[dS_t+1|S_t]"] > 0:

            label = (
                "Bullish latent regime"
            )

        elif row["E[dS_t+1|S_t]"] < 0:

            label = (
                "Bearish latent regime"
            )

        else:

            label = (
                "Neutral latent regime"
            )

        print(
            f"Interpretation: "
            f"{label}"
        )

    # =================================================
    # OUTPUT DIRECTORY
    # =====================================================

    out_dir = Path(

        f"data/clusters/{symbol}"
    )

    out_dir.mkdir(

        parents=True,

        exist_ok=True
    )

    # =================================================
    # SAVE CONDITIONALS
    # =====================================================

    conditional_path = (

        out_dir
        /
        "conditional_returns.csv"
    )

    conditional_df.to_csv(

        conditional_path,

        index=False
    )

    # =================================================
    # SAVE ENTROPY
    # =====================================================

    entropy_df = conditional_df[[

        "cluster",

        "entropy"
    ]]

    entropy_path = (

        out_dir
        /
        "entropy.csv"
    )

    entropy_df.to_csv(

        entropy_path,

        index=False
    )

    # =================================================
    # DONE
    # =====================================================

    print("\n")

    print("=" * 70)

    print(
        f"Saved conditional statistics → "
        f"{conditional_path}"
    )

    print(
        f"Saved entropy table → "
        f"{entropy_path}"
    )

    print("=" * 70)