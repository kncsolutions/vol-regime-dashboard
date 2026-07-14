from http.client import responses
from pathlib import Path
import json
import pandas as pd
from datetime import datetime
from loguru import logger
import pandas as pd


from market_memory_engine.ingestion.dhan_client import DhanClient
from market_memory_engine.runners.query.memory_logger import MemoryLogger
from market_memory_engine.recall.memory_recall import MarketMemoryRecall
from market_memory_engine.templates.eod_template import  generate_daily_dataframe_report
import sqlite3
from datetime import date
DEBUG = False

# Connect to database (creates a local file named analysis.db)
conn = sqlite3.connect("query_op/filtered/db/filtered.db")

class QuoteLoader:
    def __init__(self):
        # =========================================================
        # PROJECT ROOT
        # =========================================================

        self.project_root = Path.cwd()

        self.config_path = (
                self.project_root /
                "backend" /
                "dhanconfig.json"
        )

        self.filtered_data_path = (
                self.project_root /
                "filtered_data"
        )
        self.client = self._initialize_client()

    # =========================================================
    # LOAD DHAN CONFIG
    # =========================================================

    def _load_config(self):
        if not self.config_path.exists():
            raise FileNotFoundError(
                f"Dhan config not found: {self.config_path}"
            )

        with open(self.config_path, "r") as f:
            config = json.load(f)

        return config

    # =========================================================
    # INITIALIZE CLIENT
    # =========================================================

    def _initialize_client(self):
        config = self._load_config()

        auth_config = config["auth"]

        access_token = auth_config["token"]
        client_id = auth_config["client_id"]

        logger.info("Initializing Dhan client")

        return DhanClient(
            access_token=access_token,
            client_id=client_id
        )

    def get_quotes(self, securities):
        r = self.client.get_quote_data(securities)
        return r

# ============================================================
# MULTI SYMBOL INGESTION
# ============================================================
import typer
def universe(
    csv_file: str = "config/instruments/fno_non_nifty50.csv"
):
    """
    Fetch historical data for all symbols in CSV
    """

    loader = QuoteLoader()

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
    if DEBUG:
        print(df_symbols.head())

        typer.echo(
            f"[INFO] Loaded {len(df_symbols)} symbols"
        )


    # ========================================================
    # INGEST LOOP
    # ========================================================
    result_dict = df_symbols.groupby('underlying')['security_id'].agg(list).to_dict()
    if DEBUG:
        typer.echo(
            f"[SUCCESS] Completed {result_dict}"
        )
    quotes = loader.get_quotes(result_dict)
    if DEBUG:
        print(quotes)
    for index, row in df_symbols.iterrows():
        if row['underlying'] in quotes['data']:
            if str(row['security_id'])  in quotes['data'][row['underlying']]:
                df_symbols.at[index, 'daily_open'] = quotes['data'][row['underlying']][str(row['security_id'])]['ohlc']['open']
                df_symbols.at[index, 'daily_high'] = quotes['data'][row['underlying']][str(row['security_id'])]['ohlc']['high']
                df_symbols.at[index, 'daily_low'] = quotes['data'][row['underlying']][str(row['security_id'])]['ohlc']['low']
                df_symbols.at[index, 'ltp'] = quotes['data'][row['underlying']][str(row['security_id'])]['last_price']
                df_symbols.at[index, 'day_buy_quantity'] = quotes['data'][row['underlying']][str(row['security_id'])]['buy_quantity']
                df_symbols.at[index, 'day_sell_quantity'] = quotes['data'][row['underlying']][str(row['security_id'])]['sell_quantity']
                df_symbols.at[index, 'day_volume'] = quotes['data'][row['underlying']][str(row['security_id'])]['volume']
    # print(df_symbols)
    return df_symbols


def filter_universe(input_df, ltp_df):
    output_df = pd.DataFrame(columns = input_df.columns)
    i = 0
    for index, row in ltp_df.iterrows():
        if row['symbol'] in input_df['symbol'].to_list():
            location = input_df['symbol'].to_list().index(row['symbol'])
            output_df.loc[i] = input_df.loc[location]
            output_df.loc[i, 'high_to_ltp_pct'] = (row['ltp'] - input_df.loc[location, 'high'])/row['ltp'] * 100
            output_df.loc[i, 'low_to_ltp_pct'] = (row['ltp'] - input_df.loc[location, 'low']) / row['ltp'] * 100
            output_df.loc[i, 'daily_open'] = row['daily_open']
            output_df.loc[i, 'daily_high'] = row['daily_high']
            output_df.loc[i, 'daily_low'] = row['daily_low']
            output_df.loc[i, 'ltp'] = row['ltp']
            output_df.loc[i, 'day_buy_quantity'] = row['day_buy_quantity']
            output_df.loc[i, 'day_sell_quantity'] = row['day_sell_quantity']
            output_df.loc[i, 'day_volume'] = row['day_volume']
            i += 1



    return output_df

if __name__ == "__main__":
    ltp_df = universe()
    recall = MarketMemoryRecall(
        "market_memory"
    )
    today_str = date.today().strftime('%Y-%m-%d')

    june = recall.recall_month(2026, 6)

    if DEBUG:
        print(june)


    june_df = MemoryLogger.to_dataframe(june)




    june_df_filtered = filter_universe(june_df, ltp_df)
    generate_daily_dataframe_report(june_df_filtered, 'query_op/DAILY_REPORTS/fno_non_nifty50_daily_report.pdf')
    june_df_filtered.to_sql(f'fno_non_nifty50_monthly_{today_str}', conn, if_exists="replace", index=False)
    june_df_filtered.to_csv(f'query_op/filtered/fno_non_nifty50_monthly_{today_str}.csv', index=False)
    q2 = recall.recall_quarter(2026, 2)
    q2_df = MemoryLogger.to_dataframe(q2)
    q2_df_filtered = filter_universe(q2_df, ltp_df)
    q2_df_filtered.to_csv(f'query_op/filtered/fno_non_nifty50_quarterly_{today_str}.csv', index=False)
    q2_df_filtered.to_sql(f'fno_non_nifty50_quarterly_{today_str}', conn, if_exists="replace", index=False)