import typer
import pandas as pd
from pathlib import Path

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

@ingest_app.command()
def universe(
    csv_file: str = "config/instruments/master_watchlist.csv"
):
    """
    Fetch historical data for all symbols in CSV
    """

    loader = HistoricalLoader()

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
    print(df_symbols.head())

    typer.echo(
        f"[INFO] Loaded {len(df_symbols)} symbols"
    )


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


            loader.load_daily_timeframe_data(
                security_id=security_id,
                symbol=symbol
            )


            typer.echo(
                f"[SUCCESS] Completed {symbol}"
            )

        except Exception as e:

            typer.echo(
                f"[FAILED] {row.get('symbol', 'UNKNOWN')} :: {e}"
            )

    typer.echo("\n[INFO] Universe ingestion complete")


if __name__ == "__main__":
    universe()