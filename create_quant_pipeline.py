# create_quant_pipeline.py

from pathlib import Path
import textwrap


PROJECT_NAME = "quant_pipeline"

STRUCTURE = {
    "config": [
        "stocks.csv"
    ],

    "core": [
        "websocket_client.py",
        "option_chain_fetcher.py",
        "tick_cache.py",
        "scheduler.py",
        "dhan_client.py",
    ],

    "features": [
        "microstructure.py",
        "gamma_metrics.py",
        "skew_metrics.py",
        "flow_metrics.py",
        "instability.py",
    ],

    "storage": [
        "csv_writer.py",
        "schema.py",
    ],

    "models": [
        "tick.py",
        "option_chain.py",
    ]
}


FILE_TEMPLATES = {

    "main.py": """
import asyncio

from core.websocket_client import TickStream
from core.scheduler import Scheduler


async def main():

    tick_stream = TickStream()

    await tick_stream.connect()

    scheduler = Scheduler(tick_stream)

    await scheduler.start()


if __name__ == "__main__":
    asyncio.run(main())
""",

    "config/stocks.csv": """
symbol,security_id,underlying
RELIANCE,2885,NSE_EQ
HDFCBANK,1333,NSE_EQ
NIFTY,13,NSE_FNO
""",

    "core/websocket_client.py": """
import asyncio


class TickStream:

    def __init__(self):

        self.latest_ticks = {}

    async def connect(self):

        print("Connecting to websocket...")

    async def subscribe(self, security_id):

        print(f"Subscribed: {security_id}")

    async def on_tick(self, data):

        security_id = data["securityId"]

        self.latest_ticks[security_id] = data
""",

    "core/option_chain_fetcher.py": """
class OptionChainFetcher:

    async def fetch(self, security_id, underlying):

        print(f"Fetching option chain for {security_id}")

        return []
""",

    "core/tick_cache.py": """
class TickCache:

    def __init__(self):

        self.cache = {}

    def update(self, security_id, tick):

        self.cache[security_id] = tick

    def get(self, security_id):

        return self.cache.get(security_id)
""",

    "core/scheduler.py": """
import asyncio

from core.option_chain_fetcher import OptionChainFetcher


class Scheduler:

    def __init__(self, tick_stream):

        self.tick_stream = tick_stream

        self.fetcher = OptionChainFetcher()

    async def periodic_job(self):

        while True:

            print("Running periodic analytics job")

            await asyncio.sleep(5)

    async def start(self):

        asyncio.create_task(self.periodic_job())

        while True:

            await asyncio.sleep(1)
""",

    "core/dhan_client.py": """
class DhanClient:

    def __init__(self, token, client_id):

        self.token = token
        self.client_id = client_id

    def authenticate(self):

        print("Authenticated")
""",

    "features/microstructure.py": """
def calculate_spread(bid, ask):

    return ask - bid


def calculate_imbalance(bid_qty, ask_qty):

    total = bid_qty + ask_qty

    if total == 0:
        return 0

    return (bid_qty - ask_qty) / total


def calculate_microprice(bid_price, ask_price, bid_qty, ask_qty):

    total = bid_qty + ask_qty

    if total == 0:
        return 0

    return (
        ask_price * bid_qty
        + bid_price * ask_qty
    ) / total
""",

    "features/gamma_metrics.py": """
def compute_net_gex(chain):

    call_gex = 0
    put_gex = 0

    for row in chain:

        call_gex += row.get("call_gex", 0)
        put_gex += row.get("put_gex", 0)

    return {
        "callGEX": call_gex,
        "putGEX": put_gex,
        "netGEX": call_gex - put_gex
    }
""",

    "features/skew_metrics.py": """
def compute_call_skew(atm_iv, otm_call_iv):

    return otm_call_iv - atm_iv


def compute_put_skew(atm_iv, otm_put_iv):

    return otm_put_iv - atm_iv
""",

    "features/flow_metrics.py": """
def compute_flow(current_volume, previous_volume):

    return current_volume - previous_volume


def compute_dS(current_ltp, previous_ltp):

    return current_ltp - previous_ltp
""",

    "features/instability.py": """
def compute_I1(values):

    return sum(values)


def compute_I2(values):

    return sum(v * v for v in values)


def compute_I3(values):

    return max(values) if values else 0
""",

    "storage/csv_writer.py": """
import os
import pandas as pd


class CSVWriter:

    def __init__(self, output_dir="data"):

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
""",

    "storage/schema.py": """
SNAPSHOT_SCHEMA = [
    "time",
    "ltp",
    "gammaFlip",
    "imbalance",
    "microprice",
    "spread",
    "flow",
    "dS",
    "IV",
    "callSkew",
    "putSkew",
    "netGEX",
    "callGEX",
    "putGEX",
    "I1",
    "I2",
    "I3"
]
""",

    "models/tick.py": """
from dataclasses import dataclass


@dataclass
class Tick:

    security_id: str
    ltp: float
    volume: int
    timestamp: int
""",

    "models/option_chain.py": """
from dataclasses import dataclass


@dataclass
class OptionChainRow:

    strike: float
    call_oi: int
    put_oi: int
    call_iv: float
    put_iv: float
"""
}


def create_file(path, content=""):

    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as f:

        f.write(textwrap.dedent(content).strip() + "\n")

    print(f"Created: {path}")


def main():

    root = Path(PROJECT_NAME)

    root.mkdir(exist_ok=True)

    # create package dirs + __init__.py
    for folder, files in STRUCTURE.items():

        folder_path = root / folder

        folder_path.mkdir(parents=True, exist_ok=True)

        create_file(folder_path / "__init__.py", "")

        for file in files:

            file_path = folder_path / file

            template_key = f"{folder}/{file}"

            content = FILE_TEMPLATES.get(template_key, "")

            create_file(file_path, content)

    # main.py
    create_file(
        root / "main.py",
        FILE_TEMPLATES["main.py"]
    )

    print("\\nQuant pipeline scaffold created successfully.")


if __name__ == "__main__":
    main()