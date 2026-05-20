from pathlib import Path

import numpy as np
import pandas as pd


# =====================================================
# LOAD
# =====================================================

path = (

    "data/clusters/"
    "test_clusters.parquet"
)

df = pd.read_parquet(path)

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
    # FILTER
    # -------------------------------------------------

    sdf = df[
        df["symbol"] == symbol
    ].copy()

    sdf = sdf.sort_values(
        "time"
    )

    clusters = sdf[
        "cluster"
    ].values

    n_clusters = len(
        np.unique(clusters)
    )

    # -------------------------------------------------
    # MATRIX
    # -------------------------------------------------

    transition_counts = np.zeros(

        (6, 6)
    )

    # -------------------------------------------------
    # BUILD
    # -------------------------------------------------

    for i in range(

        len(clusters) - 1
    ):

        current_state = int(
            clusters[i]
        )

        next_state = int(
            clusters[i + 1]
        )

        transition_counts[
            current_state,
            next_state
        ] += 1

    # -------------------------------------------------
    # NORMALIZE
    # -------------------------------------------------

    row_sums = transition_counts.sum(

        axis=1,

        keepdims=True
    )

    row_sums[
        row_sums == 0
    ] = 1

    transition_probs = (

        transition_counts
        /
        row_sums
    )

    # -------------------------------------------------
    # DF
    # -------------------------------------------------

    transition_df = pd.DataFrame(

        transition_probs
    )

    # -------------------------------------------------
    # OUTPUT DIR
    # -------------------------------------------------

    out_dir = Path(

        f"data/clusters/{symbol}"
    )

    out_dir.mkdir(

        parents=True,

        exist_ok=True
    )

    # -------------------------------------------------
    # SAVE
    # -------------------------------------------------

    out_path = (

        out_dir
        /
        "transition_matrix.csv"
    )

    transition_df.to_csv(
        out_path
    )

    # -------------------------------------------------
    # DISPLAY
    # -------------------------------------------------

    print("\n")

    print(
        transition_df.round(3)
    )

    print("\n")

    print(
        f"Saved → {out_path}"
    )