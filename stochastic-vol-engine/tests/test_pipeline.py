import pandas as pd

from quant_pipeline.pipeline_runner import (
    run_pipeline
)


df = pd.read_csv(
    "training_data/NIFTY.csv"
)

result = run_pipeline(df)

print(result)
