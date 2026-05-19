from pathlib import Path

# ============================================================
# STOCHASTIC VOL ENGINE
# REBOOTED INTRADAY KNN ARCHITECTURE
# ============================================================

PROJECT_NAME = "stochastic-vol-engine"

# ============================================================
# DIRECTORY STRUCTURE
# ============================================================

DIRECTORIES = [

    "training_data",

    "backend",

    "offline_viewer",

    "quant_pipeline",

    "monte_carlo",

    "decision_layer",

    "tests",
]

# ============================================================
# FILE CONTENTS
# ============================================================

FILES = {

# ============================================================
# ROOT
# ============================================================

"README.md": """
# stochastic-vol-engine

Intraday probabilistic volatility-state engine.

Initial Objectives:
- Intraday volatility inference
- KNN analog retrieval
- Long/Short straddle edge estimation
- Intraday volatility expansion prediction
- Stochastic IV/skew modeling
""",

"requirements.txt": """
numpy
pandas
scikit-learn
scipy
matplotlib
PySide6
pyqtgraph
""",

"main.py": '''
import os

os.environ["QT_QPA_PLATFORM"] = "xcb"

os.environ["QT_QUICK_BACKEND"] = "software"

from offline_viewer.main_window import launch_ui


if __name__ == "__main__":

    launch_ui()
''',

# ============================================================
# BACKEND
# ============================================================

"backend/__init__.py": "",

"backend/config.py": '''
# ============================================================
# KNN
# ============================================================

K_NEIGHBORS = 25

# ============================================================
# HORIZON
# ============================================================

HORIZON_MINUTES = 30

# ============================================================
# STRATEGY THRESHOLDS
# ============================================================

LONG_THRESHOLD = 0.60

SHORT_THRESHOLD = 0.60

# ============================================================
# FEATURES
# ============================================================

FEATURE_COLUMNS = [

    "IV",

    "skew_diff",

    "netGEX",

    "flow",

    "spread",

    "imbalance",

    "dS"
]

# ============================================================
# TARGET
# ============================================================

TARGET_COLUMN = "long_profitable"
''',

# ============================================================
# OFFLINE VIEWER
# ============================================================

"offline_viewer/__init__.py": "",

"offline_viewer/csv_loader.py": '''
import pandas as pd

from PySide6.QtWidgets import QFileDialog


def load_csv():

    dialog = QFileDialog()

    dialog.setOption(
        QFileDialog.DontUseNativeDialog,
        True
    )

    dialog.setFileMode(
        QFileDialog.ExistingFile
    )

    dialog.setNameFilter(
        "Data Files (*.csv *.tsv *.txt);;All Files (*)"
    )

    if dialog.exec():

        selected_files = dialog.selectedFiles()

        if not selected_files:
            return None

        file_path = selected_files[0]

        print(f"Selected file: {file_path}")

        try:

            df = pd.read_csv(
                file_path,
                sep=None,
                engine="python"
            )

            print(df.head())

            return df

        except Exception as e:

            print(f"CSV loading error: {e}")

            return None

    return None
''',

"offline_viewer/result_widget.py": '''
from PySide6.QtWidgets import QLabel


class ResultWidget(QLabel):

    def update_result(self, result):

        text = f"""

LONG STRADDLE PROBABILITY:
{result["long_probability"]}

SHORT STRADDLE PROBABILITY:
{result["short_probability"]}

NEIGHBORS:
{result["neighbor_count"]}

"""

        self.setText(text)
''',

"offline_viewer/main_window.py": '''
from PySide6.QtWidgets import (
    QApplication,
    QMainWindow,
    QPushButton,
    QWidget,
    QVBoxLayout,
)

from offline_viewer.csv_loader import load_csv

from offline_viewer.result_widget import (
    ResultWidget
)

from quant_pipeline.pipeline_runner import (
    run_pipeline
)


class MainWindow(QMainWindow):

    def __init__(self):

        super().__init__()

        self.setWindowTitle(
            "stochastic-vol-engine"
        )

        self.resize(700, 400)

        self.load_button = QPushButton(
            "Load Market Data"
        )

        self.result_widget = ResultWidget()

        self.load_button.clicked.connect(
            self.load_data
        )

        layout = QVBoxLayout()

        layout.addWidget(self.load_button)

        layout.addWidget(self.result_widget)

        container = QWidget()

        container.setLayout(layout)

        self.setCentralWidget(container)

    def load_data(self):

        df = load_csv()

        if df is None:
            return

        result = run_pipeline(df)

        print(result)

        self.result_widget.update_result(
            result
        )


def launch_ui():

    app = QApplication([])

    window = MainWindow()

    window.show()

    app.exec()
''',

# ============================================================
# QUANT PIPELINE
# ============================================================

"quant_pipeline/__init__.py": "",

"quant_pipeline/preprocessing.py": '''
import pandas as pd


def preprocess(df: pd.DataFrame):

    df = df.copy()

    df["datetime"] = pd.to_datetime(
        df["time"],
        unit="ms"
    )

    df = df.sort_values(
        "datetime"
    )

    df = df.drop_duplicates()

    df = df.reset_index(
        drop=True
    )

    return df
''',

"quant_pipeline/feature_engineering.py": '''
import pandas as pd


def create_features(df: pd.DataFrame):

    df = df.copy()

    # ========================================================
    # NORMALIZE IV
    # ========================================================

    df["IV"] = (
        df["IV"] / 100.0
    )

    # ========================================================
    # SKEW DIFFERENTIAL
    # ========================================================

    df["skew_diff"] = (
        df["callSkew"]
        - df["putSkew"]
    )

    return df
''',

"quant_pipeline/horizon_engine.py": '''
import pandas as pd


def find_future_indices(
    df,
    horizon_minutes
):

    timestamps = df["datetime"]

    future_indices = []

    for current_time in timestamps:

        target_time = (
            current_time
            + pd.Timedelta(
                minutes=horizon_minutes
            )
        )

        idx = timestamps.searchsorted(
            target_time
        )

        if idx >= len(df):

            future_indices.append(None)

        else:

            future_indices.append(idx)

    return future_indices
''',

"quant_pipeline/straddle_engine.py": '''
import numpy as np


def implied_move(
    price,
    iv,
    horizon_minutes
):

    annual_fraction = (
        horizon_minutes
        / (252 * 390)
    )

    return (
        price
        * iv
        * np.sqrt(
            annual_fraction
        )
    )


def realized_move(
    current_price,
    future_price
):

    return abs(
        future_price
        - current_price
    )


def straddle_edge(
    current_price,
    future_price,
    iv,
    horizon_minutes
):

    implied = implied_move(
        current_price,
        iv,
        horizon_minutes
    )

    realized = realized_move(
        current_price,
        future_price
    )

    return realized - implied
''',

"quant_pipeline/label_generation.py": '''
import pandas as pd

from backend.config import (
    HORIZON_MINUTES
)

from quant_pipeline.horizon_engine import (
    find_future_indices
)

from quant_pipeline.straddle_engine import (
    straddle_edge
)


def generate_labels(df: pd.DataFrame):

    df = df.copy()

    future_indices = find_future_indices(
        df,
        HORIZON_MINUTES
    )

    edges = []

    for idx, future_idx in enumerate(
        future_indices
    ):

        if future_idx is None:

            edges.append(None)

            continue

        current_price = df.loc[
            idx,
            "ltp"
        ]

        future_price = df.loc[
            future_idx,
            "ltp"
        ]

        iv = df.loc[
            idx,
            "IV"
        ]

        edge = straddle_edge(
            current_price=current_price,
            future_price=future_price,
            iv=iv,
            horizon_minutes=HORIZON_MINUTES
        )

        edges.append(edge)

    df["straddle_edge"] = edges

    df["long_profitable"] = (
        df["straddle_edge"] > 0
    ).astype(int)

    return df
''',

"quant_pipeline/scaling_engine.py": '''
from sklearn.preprocessing import (
    StandardScaler
)


def scale_features(X):

    scaler = StandardScaler()

    X_scaled = scaler.fit_transform(X)

    return scaler, X_scaled
''',

"quant_pipeline/knn_engine.py": '''
import numpy as np

from sklearn.neighbors import (
    NearestNeighbors
)

from backend.config import (
    K_NEIGHBORS
)


class KNNEngine:

    def __init__(self):

        self.model = NearestNeighbors(
            n_neighbors=K_NEIGHBORS,
            metric="mahalanobis"
        )

    def fit(self, X):

        covariance = np.cov(X.T)

        inverse_covariance = np.linalg.pinv(
            covariance
        )

        self.model.set_params(
            metric_params={
                "VI": inverse_covariance
            }
        )

        self.model.fit(X)

    def query(self, state):

        distances, indices = (
            self.model.kneighbors(
                state
            )
        )

        return (
            distances[0],
            indices[0]
        )
''',

"quant_pipeline/probability_engine.py": '''
import numpy as np


def estimate_probability(
    labels,
    neighbor_indices
):

    neighbor_labels = labels.iloc[
        neighbor_indices
    ]

    probability = np.mean(
        neighbor_labels
    )

    return probability
''',

"quant_pipeline/pipeline_runner.py": '''
from backend.config import (
    FEATURE_COLUMNS,
)

from quant_pipeline.preprocessing import (
    preprocess
)

from quant_pipeline.feature_engineering import (
    create_features
)

from quant_pipeline.label_generation import (
    generate_labels
)

from quant_pipeline.scaling_engine import (
    scale_features
)

from quant_pipeline.knn_engine import (
    KNNEngine
)

from quant_pipeline.probability_engine import (
    estimate_probability
)


def run_pipeline(df):

    # ========================================================
    # PREPROCESS
    # ========================================================

    df = preprocess(df)

    # ========================================================
    # FEATURES
    # ========================================================

    df = create_features(df)

    # ========================================================
    # LABELS
    # ========================================================

    df = generate_labels(df)

    # ========================================================
    # CLEAN
    # ========================================================

    clean_df = df.dropna()

    # ========================================================
    # FEATURE MATRIX
    # ========================================================

    X = clean_df[
        FEATURE_COLUMNS
    ]

    y = clean_df[
        "long_profitable"
    ]

    # ========================================================
    # SCALE
    # ========================================================

    scaler, X_scaled = scale_features(X)

    # ========================================================
    # KNN
    # ========================================================

    knn = KNNEngine()

    knn.fit(X_scaled)

    latest_state = X.iloc[[-1]]

    latest_state_scaled = scaler.transform(
        latest_state
    )

    distances, indices = knn.query(
        latest_state_scaled
    )

    # ========================================================
    # PROBABILITY
    # ========================================================

    probability = estimate_probability(
        y,
        indices
    )

    # ========================================================
    # RESULT
    # ========================================================

    result = {

        "long_probability":
            round(float(probability), 4),

        "short_probability":
            round(float(
                1 - probability
            ), 4),

        "neighbor_count":
            len(indices)
    }

    return result
''',

# ============================================================
# DECISION LAYER
# ============================================================

"decision_layer/__init__.py": "",

"decision_layer/decision_engine.py": '''
from backend.config import (
    LONG_THRESHOLD,
    SHORT_THRESHOLD
)


def decide(probability_long):

    probability_short = (
        1 - probability_long
    )

    if probability_long >= LONG_THRESHOLD:

        return "LONG_STRADDLE"

    if probability_short >= SHORT_THRESHOLD:

        return "SHORT_STRADDLE"

    return "NO_TRADE"
''',

# ============================================================
# MONTE CARLO
# ============================================================

"monte_carlo/__init__.py": "",

"monte_carlo/ou_process.py": '''
import numpy as np


class OrnsteinUhlenbeckProcess:

    def __init__(
        self,
        theta=0.15,
        mu=0.0,
        sigma=0.2
    ):

        self.theta = theta

        self.mu = mu

        self.sigma = sigma

    def simulate(
        self,
        x0,
        steps,
        dt=1/252
    ):

        path = [x0]

        for _ in range(steps):

            previous = path[-1]

            dx = (
                self.theta
                * (self.mu - previous)
                * dt
            )

            dx += (
                self.sigma
                * np.sqrt(dt)
                * np.random.normal()
            )

            path.append(
                previous + dx
            )

        return np.array(path)
''',

# ============================================================
# TESTS
# ============================================================

"tests/test_pipeline.py": '''
import pandas as pd

from quant_pipeline.pipeline_runner import (
    run_pipeline
)


df = pd.read_csv(
    "training_data/NIFTY.csv"
)

result = run_pipeline(df)

print(result)
'''
}

# ============================================================
# CREATE ROOT
# ============================================================

root = Path(PROJECT_NAME)

root.mkdir(exist_ok=True)

# ============================================================
# CREATE DIRECTORIES
# ============================================================

for directory in DIRECTORIES:

    path = root / directory

    path.mkdir(
        parents=True,
        exist_ok=True
    )

# ============================================================
# CREATE FILES
# ============================================================

for relative_path, content in FILES.items():

    file_path = root / relative_path

    file_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        file_path,
        "w",
        encoding="utf-8"
    ) as f:

        f.write(
            content.strip() + "\n"
        )

# ============================================================
# DONE
# ============================================================

print("=" * 60)
print("stochastic-vol-engine created")
print("=" * 60)