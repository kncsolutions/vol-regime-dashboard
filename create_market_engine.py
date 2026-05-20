#!/usr/bin/env python3

"""
Microstructure Engine Scaffold Generator
========================================

Creates:
--------
1. Full directory structure
2. Core script templates
3. Feature schema
4. Realtime state container
5. Snapshot dataframe pipeline
6. Monte Carlo placeholders
7. Config templates

Feature Set
------------
time_readable
time
ltp
imbalance
microprice
spread
flow
dS
HV
I1
I2
I3
symbol

Architecture Source
-------------------
Generated from uploaded project structure definition.
:contentReference[oaicite:0]{index=0}
"""

from pathlib import Path
import textwrap
import sys


ROOT_FILES = {
    "README.md": "# Microstructure Engine\n",
    "requirements.txt": textwrap.dedent("""
        numpy
        pandas
        polars
        pyarrow
        duckdb
        scikit-learn
        scipy
        fastapi
        uvicorn
        websockets
        pyyaml
    """),

    ".gitignore": textwrap.dedent("""
        __pycache__/
        *.pyc
        *.parquet
        *.db
        *.log
        .env
        data/
        logs/
    """),

    "pyproject.toml": textwrap.dedent("""
        [project]
        name = "microstructure-engine"
        version = "0.1.0"
        description = "Realtime Market Microstructure Engine"

        [tool.black]
        line-length = 88
    """),

    ".env": "",
    "LICENSE": "MIT License\n",
}


DIRECTORIES = [
    "configs",

    "data/raw",
    "data/features",
    "data/clusters",
    "data/montecarlo",
    "data/signals",
    "data/models",
    "data/replay",
    "data/cache",

    "logs/engine",
    "logs/websocket",
    "logs/feature",
    "logs/clustering",
    "logs/montecarlo",
    "logs/probability",
    "logs/signal",
    "logs/errors",

    "market_engine/core",
    "market_engine/ingestion",
    "market_engine/state",
    "market_engine/features",
    "market_engine/clustering",
    "market_engine/montecarlo",
    "market_engine/signals",
    "market_engine/storage",
    "market_engine/api",
    "market_engine/replay",
    "market_engine/research",
    "market_engine/visualization",
    "market_engine/utils",
    "market_engine/tests",

    "scripts",
    "notebooks",

    "docs/architecture",
    "docs/research",
    "docs/deployment",
]


SCRIPT_TEMPLATES = {

    "market_engine/state/symbol_state.py": textwrap.dedent("""
        from dataclasses import dataclass


        @dataclass
        class SymbolState:

            symbol: str

            time_readable: str = ""
            time: float = 0.0

            ltp: float = 0.0

            imbalance: float = 0.0
            microprice: float = 0.0
            spread: float = 0.0

            flow: float = 0.0
            dS: float = 0.0

            HV: float = 0.0

            I1: float = 0.0
            I2: float = 0.0
            I3: float = 0.0

            cluster: int = -1

            signal: str = "NEUTRAL"

            probability_up: float = 0.0
            probability_down: float = 0.0
    """),

    "market_engine/features/feature_vector.py": textwrap.dedent("""
        FEATURE_COLUMNS = [

            "time_readable",
            "time",

            "ltp",

            "imbalance",
            "microprice",
            "spread",

            "flow",
            "dS",

            "HV",

            "I1",
            "I2",
            "I3",

            "symbol",
        ]
    """),

    "market_engine/storage/parquet_writer.py": textwrap.dedent("""
        from pathlib import Path
        import pandas as pd


        class ParquetWriter:

            def __init__(self, base_dir="data/features"):

                self.base_dir = Path(base_dir)

            def write(self, df, symbol, date):

                path = self.base_dir / date / symbol
                path.mkdir(parents=True, exist_ok=True)

                file_path = path / "features.parquet"

                df.to_parquet(
                    file_path,
                    engine="pyarrow",
                    compression="snappy",
                    index=False,
                )

                return file_path
    """),

    "market_engine/storage/snapshot_buffer.py": textwrap.dedent("""
        import pandas as pd

        from market_engine.features.feature_vector import FEATURE_COLUMNS


        class SnapshotBuffer:

            def __init__(self, max_rows=5000):

                self.max_rows = max_rows

                self.df = pd.DataFrame(columns=FEATURE_COLUMNS)

            def append(self, snapshot: dict):

                self.df.loc[len(self.df)] = snapshot

                if len(self.df) > self.max_rows:
                    self.df = self.df.tail(self.max_rows)

            def get_dataframe(self):

                return self.df
    """),

    "market_engine/features/ofi.py": textwrap.dedent("""
        def compute_ofi(bid_qty_change, ask_qty_change):

            return bid_qty_change - ask_qty_change
    """),

    "market_engine/features/imbalance.py": textwrap.dedent("""
        def compute_imbalance(bid_volume, ask_volume):

            total = bid_volume + ask_volume

            if total == 0:
                return 0.0

            return (bid_volume - ask_volume) / total
    """),

    "market_engine/features/returns.py": textwrap.dedent("""
        def compute_ds(current_price, previous_price):

            return current_price - previous_price
    """),

    "market_engine/features/liquidity.py": textwrap.dedent("""
        def compute_spread(best_ask, best_bid):

            return best_ask - best_bid


        def compute_microprice(
            best_bid,
            best_ask,
            bid_qty,
            ask_qty
        ):

            denominator = bid_qty + ask_qty

            if denominator == 0:
                return 0.0

            return (
                best_bid * ask_qty
                +
                best_ask * bid_qty
            ) / denominator
    """),

    "market_engine/features/volatility.py": textwrap.dedent("""
        import numpy as np


        def compute_hv(returns):

            if len(returns) < 2:
                return 0.0

            return np.std(returns)
    """),

    "market_engine/clustering/kmeans_model.py": textwrap.dedent("""
        from sklearn.cluster import KMeans


        class RegimeClusterModel:

            def __init__(self, n_clusters=5):

                self.model = KMeans(
                    n_clusters=n_clusters,
                    random_state=42
                )

            def fit(self, X):

                self.model.fit(X)

            def predict(self, X):

                return self.model.predict(X)
    """),

    "market_engine/montecarlo/gbm_engine.py": textwrap.dedent("""
        import numpy as np


        class GBMSimulator:

            def __init__(
                self,
                mu=0.0,
                sigma=0.2,
                dt=1/252
            ):

                self.mu = mu
                self.sigma = sigma
                self.dt = dt

            def generate_paths(
                self,
                S0,
                steps=100,
                paths=1000
            ):

                result = np.zeros((paths, steps))

                result[:, 0] = S0

                for t in range(1, steps):

                    z = np.random.standard_normal(paths)

                    result[:, t] = (
                        result[:, t-1]
                        *
                        np.exp(
                            (
                                self.mu
                                -
                                0.5 * self.sigma**2
                            ) * self.dt
                            +
                            self.sigma
                            *
                            np.sqrt(self.dt)
                            *
                            z
                        )
                    )

                return result
    """),

    "market_engine/montecarlo/probability/directional_probability.py":
    textwrap.dedent("""
        import numpy as np


        def probability_up(paths):

            final_prices = paths[:, -1]
            initial_prices = paths[:, 0]

            return np.mean(final_prices > initial_prices)


        def probability_down(paths):

            final_prices = paths[:, -1]
            initial_prices = paths[:, 0]

            return np.mean(final_prices < initial_prices)
    """),

    "market_engine/signals/signal_engine.py": textwrap.dedent("""
        class SignalEngine:

            def generate_signal(
                self,
                probability_up,
                probability_down
            ):

                if probability_up > 0.65:
                    return "BUY"

                if probability_down > 0.65:
                    return "SELL"

                return "NEUTRAL"
    """),

    "scripts/run_engine.py": textwrap.dedent("""
        def main():

            print("Starting Microstructure Engine...")


        if __name__ == "__main__":

            main()
    """),

    "scripts/generate_paths.py": textwrap.dedent("""
        from market_engine.montecarlo.gbm_engine import GBMSimulator


        def main():

            mc = GBMSimulator()

            paths = mc.generate_paths(
                S0=100,
                steps=250,
                paths=1000
            )

            print(paths.shape)


        if __name__ == "__main__":

            main()
    """),

    "scripts/compute_probabilities.py": textwrap.dedent("""
        from market_engine.montecarlo.gbm_engine import GBMSimulator

        from market_engine.montecarlo.probability.directional_probability import (
            probability_up,
            probability_down,
        )


        def main():

            mc = GBMSimulator()

            paths = mc.generate_paths(
                S0=100,
                steps=250,
                paths=1000
            )

            print("P(up):", probability_up(paths))
            print("P(down):", probability_down(paths))


        if __name__ == "__main__":

            main()
    """),

    "configs/engine.yaml": textwrap.dedent("""
        engine:
          snapshot_interval_ms: 250
          max_symbols: 150
          max_buffer_rows: 5000
    """),

    "configs/clustering.yaml": textwrap.dedent("""
        clustering:
          n_clusters: 5
          retrain_interval_hours: 24
    """),

    "configs/montecarlo.yaml": textwrap.dedent("""
        montecarlo:
          default_paths: 1000
          default_steps: 250
          dt: 0.003968
    """),
}


INIT_FILES = [
    "market_engine/__init__.py",
    "market_engine/core/__init__.py",
    "market_engine/ingestion/__init__.py",
    "market_engine/state/__init__.py",
    "market_engine/features/__init__.py",
    "market_engine/clustering/__init__.py",
    "market_engine/montecarlo/__init__.py",
    "market_engine/signals/__init__.py",
    "market_engine/storage/__init__.py",
    "market_engine/api/__init__.py",
]


def create_directory(path: Path):

    path.mkdir(parents=True, exist_ok=True)
    print(f"[DIR ] {path}")


def create_file(path: Path, content=""):

    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[FILE] {path}")


def build_project(root: Path):

    create_directory(root)

    # Root files
    for file_name, content in ROOT_FILES.items():

        create_file(root / file_name, content)

    # Directories
    for directory in DIRECTORIES:

        create_directory(root / directory)

    # Init files
    for init_file in INIT_FILES:

        create_file(root / init_file)

    # Script templates
    for file_path, content in SCRIPT_TEMPLATES.items():

        create_file(root / file_path, content)


if __name__ == "__main__":

    if len(sys.argv) > 1:
        root = Path(sys.argv[1]).expanduser()
    else:
        root = Path.cwd() / "microstructure-engine"

    print("\\nBuilding Microstructure Engine...\\n")

    build_project(root)

    print("\\nProject successfully created.\\n")
    print(f"Location: {root.resolve()}\\n")