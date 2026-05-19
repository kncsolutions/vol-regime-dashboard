import pandas as pd
import numpy as np


def create_features(df: pd.DataFrame):

    df = df.copy()

    # ========================================================
    # NORMALIZE IV
    # ========================================================

    df["IV"] = (
        df["IV"] / 100.0
    )

    # ========================================================
    # SKEW DIFFERENTIAL
    # ========================================================

    df["skew_diff"] = (
        df["callSkew"]
        - df["putSkew"]
    )

    df["gex_regime"] = np.where(
        df["netGEX"] >= 0,
        "positive_gex",
        "negative_gex"
    )

    df["next_gex_regime"] = (
        df["gex_regime"]
        .shift(-1)
    )
    # ========================================================
    # STATE DIFFERENTIALS
    # ========================================================

    state_columns = [

        "IV",

        "skew_diff",

        "netGEX",

        "flow",

        "spread",

        "imbalance",

        "dS"
    ]

    for col in state_columns:
        df[f"delta_{col}"] = (
                df[col]
                .shift(-1)
                -
                df[col]
        )

    return df
