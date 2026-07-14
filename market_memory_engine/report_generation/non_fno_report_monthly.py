from market_memory_engine.report_generation.sort_extract import *
from pathlib import Path
import json
import pandas as pd
from datetime import datetime
from loguru import logger
import pandas as pd

from market_memory_engine.configuration.configuration import (
MONTHLY_REPORT_YEAR,
MONTHLY_REPORT_MONTH
)
from market_memory_engine.ingestion.dhan_client import DhanClient
from market_memory_engine.runners.query.memory_logger import MemoryLogger
from market_memory_engine.recall.memory_recall import MarketMemoryRecall
from market_memory_engine.templates.monthly_template import generate_multi_asset_report
from market_memory_engine.report_generation.report_helper import get_output_file_name_path
import typer
from datetime import date
DEBUG = True
def universe(
    raw_dataset,
    csv_file: str = "config/instruments/non_fno.csv"
):
    csv_path = Path(csv_file)

    if not csv_path.exists():
        typer.echo(
            f"[ERROR] CSV file not found: {csv_path}"
        )

        raise typer.Exit()

    # ========================================================
    # LOAD SYMBOL MASTER
    # ========================================================

    df_symbols = pd.read_csv(csv_path)
    target_symbols = df_symbols['symbol'].to_list()
    custom_sublist = extract_symbol_sublist(raw_dataset, target_symbols)
    sorted_data = sort_market_list_by_symbol(custom_sublist)

    return sorted_data

if __name__ == "__main__":
    recall = MarketMemoryRecall(
        "market_memory"
    )

    june = recall.recall_month(MONTHLY_REPORT_YEAR, MONTHLY_REPORT_MONTH)
    op_file = get_output_file_name_path(

        timeframe="MONTHLY",

        year=MONTHLY_REPORT_YEAR,

        month=MONTHLY_REPORT_MONTH,

        filename="report_non_fno"

    )
    generate_multi_asset_report(universe(june), str(op_file))