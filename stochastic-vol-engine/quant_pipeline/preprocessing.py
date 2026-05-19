import pandas as pd


def preprocess(df: pd.DataFrame):

    df = df.copy()

    df["datetime"] = pd.to_datetime(
        df["time"],
        unit="ms"
    )

    df = df.sort_values(
        "datetime"
    )

    df = df.drop_duplicates()

    df = df.reset_index(
        drop=True
    )

    return df
