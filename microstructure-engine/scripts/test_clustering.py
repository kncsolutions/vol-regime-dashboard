from pathlib import Path
import pandas as pd
import numpy as np

from sklearn.cluster import MiniBatchKMeans
from sklearn.preprocessing import StandardScaler


# =====================================================
# CONFIG
# =====================================================

DATA_DIR = Path("data/features")

N_CLUSTERS = 6

FEATURES = [

    "flow_avg",

    "imbalance_l1_avg",

    "imbalance_l2_avg",

    "dS_avg",

    "HV_avg",

    "I1_avg",

    "I2_avg",

    "I3_avg",

    "spread_avg",
]


# =====================================================
# LOAD PARQUET
# =====================================================

def load_all_data():

    parquet_files = list(

        DATA_DIR.rglob("*.parquet")
    )

    if len(parquet_files) == 0:

        raise Exception(
            "No parquet files found"
        )

    dfs = []

    for file in parquet_files:

        try:

            df = pd.read_parquet(file)

            dfs.append(df)

            print(
                f"✅ Loaded {file} | "
                f"ROWS={len(df)}"
            )

        except Exception as e:

            print(
                f"❌ Failed loading {file}"
            )

            print(e)

    return pd.concat(
        dfs,
        ignore_index=True
    )


# =====================================================
# MAIN
# =====================================================

def main():

    # -------------------------------------------------
    # LOAD
    # -------------------------------------------------

    df = load_all_data()

    print("\n")

    print("=" * 60)

    print("DATASET SUMMARY")

    print("=" * 60)

    print(df[FEATURES].describe())

    # -------------------------------------------------
    # MATRIX
    # -------------------------------------------------

    X = df[FEATURES].values

    X = np.nan_to_num(X)

    # -------------------------------------------------
    # NORMALIZE
    # -------------------------------------------------

    scaler = StandardScaler()

    X_scaled = scaler.fit_transform(X)

    # -------------------------------------------------
    # KMEANS
    # -------------------------------------------------

    model = MiniBatchKMeans(

        n_clusters=N_CLUSTERS,

        batch_size=64,

        random_state=42,
    )

    model.fit(X_scaled)

    # -------------------------------------------------
    # ASSIGN CLUSTERS
    # -------------------------------------------------

    clusters = model.predict(X_scaled)

    df["cluster"] = clusters

    # -------------------------------------------------
    # COUNTS
    # -------------------------------------------------

    print("\n")

    print("=" * 60)

    print("CLUSTER COUNTS")

    print("=" * 60)

    print(

        df["cluster"]

        .value_counts()

        .sort_index()
    )

    # -------------------------------------------------
    # CENTROIDS
    # -------------------------------------------------

    print("\n")

    print("=" * 60)

    print("CLUSTER CENTROIDS")

    print("=" * 60)

    centroids = pd.DataFrame(

        scaler.inverse_transform(
            model.cluster_centers_
        ),

        columns=FEATURES
    )

    print(centroids)

    # -------------------------------------------------
    # SAMPLE OUTPUT
    # -------------------------------------------------

    print("\n")

    print("=" * 60)

    print("SAMPLE CLUSTERED ROWS")

    print("=" * 60)

    print(

        df[
            FEATURES + ["cluster"]
        ].tail(10)
    )

    # -------------------------------------------------
    # SAVE
    # -------------------------------------------------

    output_path = (
        "data/clusters/test_clusters.parquet"
    )

    Path(
        "data/clusters"
    ).mkdir(

        parents=True,

        exist_ok=True
    )

    df.to_parquet(

        output_path,

        index=False
    )

    print("\n")

    print(
        f"✅ Saved clustered dataset "
        f"→ {output_path}"
    )


# =====================================================
# ENTRY
# =====================================================

if __name__ == "__main__":

    main()