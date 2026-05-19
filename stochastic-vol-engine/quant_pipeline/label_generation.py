import pandas as pd

from backend.config import (
    HORIZON_MINUTES
)

from quant_pipeline.horizon_engine import (
    find_future_indices
)

from quant_pipeline.straddle_engine import (
    straddle_edge
)


def generate_labels(df: pd.DataFrame):

    df = df.copy()

    future_indices = find_future_indices(
        df,
        HORIZON_MINUTES
    )

    edges = []

    for idx, future_idx in enumerate(
        future_indices
    ):

        if future_idx is None:

            edges.append(None)

            continue

        current_price = df.loc[
            idx,
            "ltp"
        ]

        future_price = df.loc[
            future_idx,
            "ltp"
        ]

        iv = df.loc[
            idx,
            "IV"
        ]

        edge = straddle_edge(
            current_price=current_price,
            future_price=future_price,
            iv=iv,
            horizon_minutes=HORIZON_MINUTES
        )

        edges.append(edge)
        print(
            current_price,
            future_price,
            iv,
            edge
        )

    df["straddle_edge"] = edges

    df["long_profitable"] = (
        df["straddle_edge"] > 0
    ).astype(int)

    return df
