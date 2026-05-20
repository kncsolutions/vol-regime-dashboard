# quant_pipeline/config/paths.py

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

CONFIG_DIR = ROOT_DIR / "config"

STOCKS_CSV = CONFIG_DIR / "stocks.csv"