"""
historical_loader.py

Historical OHLCV ingestion layer for the
Entropy-Regulated Hierarchical Market-Semantic Architecture.

Responsibilities:
-----------------------------------
- Load Dhan credentials
- Initialize Dhan client
- Fetch daily OHLCV
- Fetch intraday OHLCV
- Normalize data
- Store parquet datasets
- Provide reusable historical interfaces
"""

from pathlib import Path
import json
import pandas as pd
from datetime import datetime
from loguru import logger
import pandas as pd



from market_memory_engine.ingestion.dhan_client import DhanClient
from market_memory_engine.market_memory.monthly_ledger_builder import MonthlyLedgerBuilder
from market_memory_engine.market_memory.quarterly_ledger_builder import QuarterlyLedgerBuilder
from market_memory_engine.ingestion.ledger_json_encoder import LedgerWriter
from market_memory_engine.indicators.indicators import EMACalculator, ATRCalculator, RSICalculator
class HistoricalLoader:

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

        self.raw_data_path = (
                self.project_root /
                "data" /
                "raw"
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

    # =========================================================
    # NORMALIZE OHLCV
    # =========================================================

    def _normalize_ohlcv(self, df: pd.DataFrame):

        if df is None or len(df) == 0:
            return pd.DataFrame()

        df.columns = [c.lower() for c in df.columns]

        required_columns = [
            "open",
            "high",
            "low",
            "close",
            "volume"
        ]

        for col in required_columns:
            if col not in df.columns:
                raise ValueError(
                    f"Missing required OHLCV column: {col}"
                )

        # Sort by datetime/date
        if "datetime" in df.columns:
            df = df.sort_values("datetime")

        elif "date" in df.columns:
            df = df.sort_values("date")

        # Remove duplicates
        df = df.drop_duplicates()

        # Reset index
        df = df.reset_index(drop=True)

        return df

    # =========================================================
    # SAVE DATAFRAME
    # =========================================================

    def _save_csv(
            self,
            df: pd.DataFrame,
            symbol: str,
            timeframe: str
    ):

        folder = self.raw_data_path / "equities"

        folder.mkdir(parents=True, exist_ok=True)

        filename = (
            f"{symbol.upper()}_{timeframe}.csv"
        )

        output_path = folder / filename


        df.to_parquet(output_path, index=False)

        logger.info(f"Saved: {output_path}")



    # =========================================================
    # LOAD DAILY DATA
    # =========================================================

    def load_daily_data(
            self,
            security_id: int,
            symbol: str,
            exchange_segment: str = "NSE_EQ",
            instrument_type: str = "EQUITY",
            save: bool = True
    ):

        logger.info(
            f"Fetching DAILY data for {symbol}"
        )

        response = self.client.get_daily_spot_data(
            security_id=security_id,
            under_security=symbol,
            exchange_segment=exchange_segment,
            instrument_type=instrument_type
        )


        # Convert response → dataframe
        df = self.client._to_dataframe(response)


        # Normalize
        df = self._normalize_ohlcv(df)

        # Add metadata
        df["symbol"] = symbol
        df["timeframe"] = "1D"
        df['ema20'] = EMACalculator(df, 20).calculate_ema()
        df['ema50'] = EMACalculator(df, 50).calculate_ema()
        df['ema200'] = EMACalculator(df, 200).calculate_ema()

        df_copy = df.copy(deep=True)
        df_copy = ATRCalculator(df_copy, period=14).calculate_atr()
        df['ATR'] = df_copy['ATR']


        monthly_ledgers = MonthlyLedgerBuilder.build(df)

        quarterly_ledgers = QuarterlyLedgerBuilder.build(df)

        for ledger in monthly_ledgers:
            filepath = (
                    Path("market_memory")
                    / ledger.symbol
                    / "MONTH"
                    / str(ledger.year)
                    / f"{ledger.year}_{ledger.month:02d}.json"
            )

            LedgerWriter.save(

                ledger=ledger,

                filepath=filepath,

                ledger_type="MONTHLY"
            )

        for ledger in quarterly_ledgers:
            filepath = (
                    Path("market_memory")
                    / ledger.symbol
                    / "QUARTER"
                    / str(ledger.year)
                    / f"Q{ledger.quarter}.json"
            )

            LedgerWriter.save(

                ledger=ledger,

                filepath=filepath,

                ledger_type="QUARTERLY"
            )

        if save:
            self._save_csv(
                df=df,
                symbol=symbol,
                timeframe="daily"
            )

        return df

    # =========================================================
    # LOAD 30 MIN DATA
    # =========================================================

    def load_15min_data(
            self,
            security_id: int,
            symbol: str,
            exchange_segment: str = "NSE_EQ",
            instrument_type: str = "EQUITY",
            save: bool = True
    ):

        logger.info(
            f"Fetching 15 MINUTE data for {symbol}"
        )

        response = self.client.get_intrday_spot_data(
            security_id=security_id,
            under_security=symbol,
            exchange_segment=exchange_segment,
            instrument_type=instrument_type,
            timeframe='15'
        )

        # Convert response → dataframe
        df = self.client._fut_to_dataframe(response)

        # Normalize
        df = self._normalize_ohlcv(df)

        # Add metadata
        df["symbol"] = symbol
        df["timeframe"] = "15m"

        if save:
            self._save_parquet(
                df=df,
                symbol=symbol,
                timeframe="15m"
            )

        return df

    def _run_structural_pipeline(
            self,
            df,
            symbol,
            timeframe
    ):

        from market_engine.structural.pipeline import (
            StructuralPipeline
        )

        pipeline = StructuralPipeline(df)

        return pipeline.run(

            symbol=symbol,

            timeframe=timeframe
        )

    # =========================================================
    # LOAD DAILY-TIMEFRAME PACKET
    # =========================================================

    def load_daily_timeframe_data(
            self,
            security_id: int,
            symbol: str
    ):
        logger.info(
            f"Loading multi-timeframe data for {symbol}"
        )

        daily_df = self.load_daily_data(
            security_id=security_id,
            symbol=symbol
        )
        print(daily_df.head())


    # =========================================================
    # LOAD MULTI-TIMEFRAME PACKET
    # =========================================================

    def load_multi_timeframe_data(
            self,
            security_id: int,
            symbol: str
    ):

        logger.info(
            f"Loading multi-timeframe data for {symbol}"
        )

        daily_df = self.load_daily_data(
            security_id=security_id,
            symbol=symbol
        )
        # print(daily_df.tail(50))
        # input('wait to debug @dailydf')
        daily_structures = (
            self._run_structural_pipeline(

                df=daily_df,

                symbol=symbol,

                timeframe="daily"
            )
        )

        intraday_df = self.load_15min_data(

            security_id=security_id,

            symbol=symbol
        )
        # print(intraday_df.tail(50))
        # input('wait to debug @intradaydf')

        intraday_structures = (

            self._run_structural_pipeline(

                df=intraday_df,

                symbol=symbol,

                timeframe="15m"
            )
        )


        return {
            "daily": daily_df,
            "15m": intraday_df
        }


# =============================================================
# TEST
# =============================================================

if __name__ == "__main__":

    loader = HistoricalLoader()

    data = loader.load_multi_timeframe_data(
        security_id=2885,
        symbol="RELIANCE"
    )

    print("\nDAILY DATA")
    print(data["daily"].tail())

    print("\n15M DATA")
    print(data["15m"].tail())