
from pathlib import Path
import json
import pandas as pd

from loguru import logger
import pandas as pd


from market_memory_engine.ingestion.dhan_client import DhanClient

from market_memory_engine.templates.eod_ohlcv import generate_eod_ohlcv_report
from market_memory_engine.indicators.indicators import EMACalculator, ATRCalculator, RSICalculator
import sqlite3
DEBUG = True

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
def quote_universe(
    csv_file: str = "config/instruments/non_fno.csv"
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
                from datetime import datetime, timezone, timedelta

                # 1. Fetch the raw time string once to optimize lookup speed
                raw_time_str = quotes['data'][row['underlying']][str(row['security_id'])]['last_trade_time']

                # 2. Parse the string and apply the +05:30 timezone offset
                # Ensure raw_time_str exists and is not empty before parsing
                # parsed_dt = datetime.strptime(raw_time_str.strip(), "%d/%m/%Y %H:%M:%S")
                if raw_time_str and raw_time_str.strip():
                    parsed_dt = datetime.strptime(raw_time_str.strip(), "%d/%m/%Y %H:%M:%S")
                else:
                    # Handle the missing time data gracefully (e.g., assign None or current time)
                    parsed_dt = None
                    continue

                tz_india = timezone(timedelta(hours=5, minutes=30))
                localized_dt = parsed_dt.replace(tzinfo=tz_india)

                # 3. Assign the formatted outputs directly into your DataFrame
                df_symbols.at[index, 'timestamp'] = localized_dt.timestamp()
                df_symbols.at[index, 'date'] = pd.to_datetime(
                    localized_dt.strftime("%Y-%m-%d %H:%M:%S") + "+05:30"
                )

                df_symbols.at[index, 'open'] = quotes['data'][row['underlying']][str(row['security_id'])]['ohlc']['open']
                df_symbols.at[index, 'high'] = quotes['data'][row['underlying']][str(row['security_id'])]['ohlc']['high']
                df_symbols.at[index, 'low'] = quotes['data'][row['underlying']][str(row['security_id'])]['ohlc']['low']
                df_symbols.at[index, 'close'] = quotes['data'][row['underlying']][str(row['security_id'])]['last_price']
                # df_symbols.at[index, 'day_buy_quantity'] = quotes['data'][row['underlying']][str(row['security_id'])]['buy_quantity']
                # df_symbols.at[index, 'day_sell_quantity'] = quotes['data'][row['underlying']][str(row['security_id'])]['sell_quantity']
                df_symbols.at[index, 'volume'] = quotes['data'][row['underlying']][str(row['security_id'])]['volume']
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
from market_memory_engine.ingestion.historical_loader import HistoricalLoader

ingest_app = typer.Typer()


# ============================================================
# SINGLE SYMBOL INGESTION
# ============================================================

@ingest_app.command()
def history(
    security_id: int,
    symbol: str,
):
    """
    Fetch historical data for a single symbol
    """

    loader = HistoricalLoader()

    loader.load_multi_timeframe_data(
        security_id=security_id,
        symbol=symbol
    )

    typer.echo(
        f"[SUCCESS] Loaded historical data for {symbol}"
    )


# ============================================================
# MULTI SYMBOL INGESTION
# ============================================================
def merge_df(symbol, df_hist, ltp_df):
    df_hist.loc[len(df_hist)] = ltp_df.loc[ltp_df['symbol'] == symbol].iloc[0]

    df_hist["timeframe"] = "1D"
    df_hist['ema20'] = EMACalculator(df_hist, 20).calculate_ema()
    df_hist['ema50'] = EMACalculator(df_hist, 50).calculate_ema()
    df_hist['ema200'] = EMACalculator(df_hist, 200).calculate_ema()

    df_copy = df_hist.copy(deep=True)
    df_copy = ATRCalculator(df_copy, period=14).calculate_atr()
    df_hist['ATR'] = df_copy['ATR']
    return df_hist

@ingest_app.command()
def universe_historical(
    ltp_df: pd.DataFrame,
    csv_file: str = "config/instruments/non_fno.csv"
):
    """
    Fetch historical data for all symbols in CSV
    """



    csv_path = Path(csv_file)
    print(csv_path)


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

    result_df = pd.DataFrame()

    # ========================================================
    # INGEST LOOP
    # ========================================================

    for _, row in df_symbols.iterrows():

        try:

            security_id = int(row["security_id"])

            symbol = row["symbol"]


            typer.echo("=" * 60)
            typer.echo(f"[INFO] Loading {symbol}")
            typer.echo("=" * 60)


            df_hist = pd.read_parquet(Path(f"data/raw/equities/{symbol}_daily.csv"))
            if not ltp_df.empty:
                df_hist = merge_df(symbol, df_hist, ltp_df)
                df_hist['date'] = pd.to_datetime(df_hist['date'], utc=True)
            print(df_hist['date'].tail())
            # 1. Get the current date and time matching your data's timezone
            current_time = pd.Timestamp.now(tz="Asia/Kolkata")
            # 2. Filter rows where both the year and month match the current month
            current_month_df = df_hist[
                (df_hist["date"].dt.year == current_time.year)
                & (df_hist["date"].dt.month == current_time.month)
                ]


            result_df = pd.concat([result_df, current_month_df], ignore_index=True)



            typer.echo(
                f"[SUCCESS] Completed {symbol}"
            )

        except Exception as e:

            typer.echo(
                f"[FAILED] {row.get('symbol', 'UNKNOWN')} :: {e}"
            )

    result_df['body'] = result_df['close'] - result_df['open']
    # 1. Identify the top and bottom of the candle body
    result_df['body_top'] = result_df[['open', 'close']].max(axis=1)
    result_df['body_bottom'] = result_df[['open', 'close']].min(axis=1)

    # 2. Calculate the wicks
    result_df['upper_wick'] = result_df['high'] - result_df['body_top']
    result_df['lower_wick'] = result_df['body_bottom'] - result_df['low']

    # 3. Clean up temporary columns (Optional)
    result_df.drop(columns=['body_top', 'body_bottom'], inplace=True)
    if DEBUG:
        print(result_df[['date', 'open', 'high', 'low', 'close', 'volume', 'body' ,'ema20', 'ema50', 'ema200', 'ATR']])
    typer.echo("\n[INFO] Universe ingestion complete")
    return result_df


from market_memory_engine.configuration.configuration import (
    CURRENT_MONTH_EOD_DATA_REPORT_INCLUDE_CURRENT_SESSION
)
if __name__ == "__main__":
    ltp_df = pd.DataFrame()
    if CURRENT_MONTH_EOD_DATA_REPORT_INCLUDE_CURRENT_SESSION:
        ltp_df = quote_universe().copy()
    result_eod = universe_historical(ltp_df)


    generate_eod_ohlcv_report(result_eod, 'query_op/DAILY_REPORTS/non_fno_daily_eod_ohlcv_report.pdf')
