import pandas as pd


def find_future_indices(
    df,
    horizon_minutes
):

    timestamps = df["datetime"]

    future_indices = []

    for current_time in timestamps:

        target_time = (
            current_time
            + pd.Timedelta(
                minutes=horizon_minutes
            )
        )

        idx = timestamps.searchsorted(
            target_time
        )

        if idx >= len(df):

            future_indices.append(None)

        else:

            future_indices.append(idx)

    return future_indices
