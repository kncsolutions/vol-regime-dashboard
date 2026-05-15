import os
import pandas as pd


class CSVWriter:

    def __init__(self, output_dir="training_data"):

        self.output_dir = output_dir

        os.makedirs(output_dir, exist_ok=True)

    def write_snapshot(self, symbol, snapshot):

        path = os.path.join(
            self.output_dir,
            f"{symbol}.csv"
        )

        df = pd.DataFrame([snapshot])

        if os.path.exists(path):

            df.to_csv(
                path,
                mode="a",
                header=False,
                index=False
            )

        else:

            df.to_csv(
                path,
                index=False
            )
