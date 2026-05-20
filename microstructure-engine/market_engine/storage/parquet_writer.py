from pathlib import Path
import pandas as pd
from datetime import datetime


class ParquetWriter:

    def __init__(

        self,

        base_dir="data/features"
    ):

        self.base_dir = Path(base_dir)

    # =================================================
    # WRITE
    # =================================================

    def write(

        self,

        symbol,

        snapshots,
    ):

        if len(snapshots) == 0:

            return

        # ---------------------------------------------
        # DATE
        # ---------------------------------------------

        today = datetime.now().strftime(
            "%Y-%m-%d"
        )

        # ---------------------------------------------
        # DIRECTORY
        # ---------------------------------------------

        path = (

            self.base_dir
            /
            today
            /
            symbol
        )

        path.mkdir(
            parents=True,
            exist_ok=True
        )

        # ---------------------------------------------
        # FILE
        # ---------------------------------------------

        file_path = (
            path
            /
            "aggregated_features.parquet"
        )

        # ---------------------------------------------
        # DATAFRAME
        # ---------------------------------------------

        df = pd.DataFrame(
            snapshots
        )

        # ---------------------------------------------
        # APPEND MODE
        # ---------------------------------------------

        if file_path.exists():

            existing = pd.read_parquet(
                file_path
            )

            df = pd.concat(
                [existing, df],
                ignore_index=True
            )

        # ---------------------------------------------
        # WRITE
        # ---------------------------------------------

        df.to_parquet(

            file_path,

            engine="pyarrow",

            compression="snappy",

            index=False,
        )

        print(
            f"💾 Saved {len(df)} rows "
            f"→ {symbol}"
        )