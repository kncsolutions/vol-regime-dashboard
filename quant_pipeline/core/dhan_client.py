from pathlib import Path
import json

from quant_pipeline.core.dhan_data_extractor import DhanClient


# =========================================================
# ROOT PATH
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# =========================================================
# EXISTING CONFIG LOCATION
# =========================================================

CONFIG_PATH = (
    BASE_DIR /
    "backend" /
    "dhanconfig.json"
)

# =========================================================
# LOAD CONFIG
# =========================================================

with open(CONFIG_PATH) as f:

    CONFIG = json.load(f)

DHAN_TOKEN = CONFIG["auth"]["token"]

DHAN_CLIENT_ID = CONFIG["auth"]["client_id"]

# =========================================================
# CLIENT
# =========================================================

dhan_client = DhanClient(
    DHAN_TOKEN,
    DHAN_CLIENT_ID
)