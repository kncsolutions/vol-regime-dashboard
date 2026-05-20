from pathlib import Path
import pandas as pd
import numpy as np
import yaml
import joblib

from sklearn.cluster import MiniBatchKMeans

from market_engine.normalization.scaler_factory import (
    build_scaler
)

# =====================================================
# CONFIG
# =====================================================

with open(

    "configs/engine.yaml",

    "r"

) as f:

    config = yaml.safe_load(f)

MODE = config.get(

    "normalization_mode",

    "global"
)

# =====================================================
# FEATURES
# =====================================================

FEATURE_COLUMNS = [

    "flow_avg",

    "imbalance_l1_avg",

    "imbalance_l2_avg",

    "HV_avg",

    "I1_avg",

    "I2_avg",

    "I3_avg",

    "spread_avg",
]

# =====================================================
# LOAD DATA
# =====================================================

base_path = Path(
    "data/features"
)

frames = []

for parquet in base_path.rglob(
    "*.parquet"
):

    df = pd.read_parquet(
        parquet
    )

    frames.append(df)

df = pd.concat(
    frames,
    ignore_index=True
)

print("\n")
print("=" * 60)
print(f"MODE: {MODE}")
print("=" * 60)

# =====================================================
# BUILD SCALER
# =====================================================

scaler = build_scaler(
    MODE
)

# =====================================================
# BUILD FEATURE MATRIX
# =====================================================

vectors = []

for _, row in df.iterrows():

    vector = np.array([

        row["flow_avg"],

        row["imbalance_l1_avg"],

        row["imbalance_l2_avg"],

        row["HV_avg"],

        row["I1_avg"],

        row["I2_avg"],

        row["I3_avg"],

        row["spread_avg"],

    ]).reshape(1, -1)

    symbol = row["symbol"]

    # ---------------------------------------------
    # NORMALIZE
    # ---------------------------------------------

    scaled = scaler.transform(

        vector,

        symbol
    )

    vectors.append(
        scaled.flatten()
    )

X = np.array(vectors)

print(
    f"Training Shape: {X.shape}"
)

# =====================================================
# TRAIN KMEANS
# =====================================================

model = MiniBatchKMeans(

    n_clusters=6,

    random_state=42,

    batch_size=256,
)

model.fit(X)

# =====================================================
# SAVE
# =====================================================

save_dir = Path(
    f"data/models/{MODE}"
)

save_dir.mkdir(

    parents=True,

    exist_ok=True
)

joblib.dump(

    model,

    save_dir / "kmeans_model.pkl"
)

# ---------------------------------------------
# SAVE GLOBAL SCALER ONLY
# ---------------------------------------------

if MODE == "global":

    joblib.dump(

        scaler.scaler,

        save_dir / "scaler.pkl"
    )

print("\n")
print("=" * 60)
print(
    f"✅ Saved {MODE} model"
)
print("=" * 60)