import sys
import ast
from pathlib import Path
import pandas as pd

from PySide6.QtCore import (

    Qt,
    QProcess,
)

from PySide6.QtWidgets import (

    QApplication,
    QWidget,

    QVBoxLayout,
    QHBoxLayout,
    QGridLayout,

    QPushButton,
    QLabel,
    QTextEdit,
    QComboBox,

    QFrame,

    QTableWidget,
    QTableWidgetItem,

    QHeaderView,
)
from PySide6.QtWidgets import (

    QSpinBox,
)

from market_engine.montecarlo.local_geometry_builder import (
    LocalGeometryBuilder
)

from market_engine.montecarlo.montecarlo_engine import (
    MonteCarloEngine
)

from market_engine.montecarlo.montecarlo_plotter import (
    MonteCarloPlotter
)

from market_engine.montecarlo.montecarlo_report import (
    MonteCarloReport
)


# =====================================================
# MAIN WINDOW
# =====================================================

class RunApp(QWidget):

    # =================================================
    # INIT
    # =====================================================

    def __init__(self):

        super().__init__()

        self.process = None

        self.market_rows = {}

        self.setup_window()

        self.setup_ui()
        self.load_symbols()
        self.latest_states = {}

    # =================================================
    # LOAD SYMBOLS
    # =================================================

    # =================================================
    # LOAD SYMBOLS
    # =================================================

    def load_symbols(self):

        try:

            stocks_path = (
                "configs/stocks.csv"
            )

            df = pd.read_csv(
                stocks_path
            )

            # -----------------------------------------
            # COLUMN
            # -----------------------------------------

            if "symbol" in df.columns:

                symbols = (

                    df["symbol"]
                    .dropna()
                    .unique()
                    .tolist()
                )

            else:

                symbols = (

                    df.iloc[:, 0]
                    .dropna()
                    .unique()
                    .tolist()
                )

            symbols = sorted(symbols)

            self.mc_symbol_selector.addItems(
                symbols
            )

            self.log(

                f"Loaded "
                f"{len(symbols)} symbols"
            )

        except Exception as e:

            self.log(
                str(e)
            )

    # =================================================
    # WINDOW
    # =====================================================

    def setup_window(self):

        self.setWindowTitle(
            "Microstructure Engine"
        )

        self.resize(1600, 950)

    # =================================================
    # UI
    # =====================================================

    def setup_ui(self):

        main_layout = QVBoxLayout()

        # =================================================
        # TITLE
        # =====================================================

        title = QLabel(
            "Market Microstructure Engine"
        )

        title.setStyleSheet("""

            font-size: 28px;
            font-weight: bold;
            padding: 10px;

        """)

        main_layout.addWidget(title)

        # =================================================
        # CONTROL PANEL
        # =====================================================

        control_layout = QHBoxLayout()

        # -------------------------------------------------
        # MODE SELECTOR
        # -------------------------------------------------

        self.mode_selector = QComboBox()

        self.mode_selector.addItems([

            "global",

            "local",

            "hybrid"
        ])

        self.mode_selector.setMinimumHeight(
            35
        )

        control_layout.addWidget(
            QLabel("Normalization Mode")
        )

        control_layout.addWidget(
            self.mode_selector
        )

        # -------------------------------------------------
        # TRAIN BUTTON
        # -------------------------------------------------

        self.train_button = QPushButton(
            "Train Model"
        )

        self.train_button.clicked.connect(
            self.train_model
        )

        self.train_button.setMinimumHeight(
            40
        )

        control_layout.addWidget(
            self.train_button
        )

        # -------------------------------------------------
        # RUN ENGINE
        # -------------------------------------------------

        self.run_button = QPushButton(
            "Run Online Engine"
        )

        self.run_button.clicked.connect(
            self.run_online_engine
        )

        self.run_button.setMinimumHeight(
            40
        )

        control_layout.addWidget(
            self.run_button
        )

        # -------------------------------------------------
        # STOP ENGINE
        # -------------------------------------------------

        self.stop_button = QPushButton(
            "Stop Engine"
        )

        self.stop_button.clicked.connect(
            self.stop_engine
        )

        self.stop_button.setMinimumHeight(
            40
        )

        control_layout.addWidget(
            self.stop_button
        )

        main_layout.addLayout(
            control_layout
        )

        # =================================================
        # STATUS PANEL
        # =====================================================

        status_frame = QFrame()

        status_frame.setFrameShape(
            QFrame.StyledPanel
        )

        status_layout = QGridLayout()

        # -------------------------------------------------
        # STATUS LABELS
        # -------------------------------------------------

        self.engine_status = QLabel(
            "STOPPED"
        )

        self.mode_label = QLabel("-")

        self.symbol_label = QLabel("-")

        self.cluster_label = QLabel("-")

        self.entropy_label = QLabel("-")

        self.confidence_label = QLabel("-")

        self.signal_label = QLabel("-")

        self.dwell_label = QLabel("-")

        self.transition_label = QLabel("-")

        # -------------------------------------------------
        # GRID
        # -------------------------------------------------

        status_layout.addWidget(
            QLabel("Engine Status"), 0, 0
        )

        status_layout.addWidget(
            self.engine_status, 0, 1
        )

        status_layout.addWidget(
            QLabel("Mode"), 1, 0
        )

        status_layout.addWidget(
            self.mode_label, 1, 1
        )

        status_layout.addWidget(
            QLabel("Active Symbol"), 2, 0
        )

        status_layout.addWidget(
            self.symbol_label, 2, 1
        )

        status_layout.addWidget(
            QLabel("Cluster"), 3, 0
        )

        status_layout.addWidget(
            self.cluster_label, 3, 1
        )

        status_layout.addWidget(
            QLabel("Entropy"), 4, 0
        )

        status_layout.addWidget(
            self.entropy_label, 4, 1
        )

        status_layout.addWidget(
            QLabel("Confidence"), 5, 0
        )

        status_layout.addWidget(
            self.confidence_label, 5, 1
        )

        status_layout.addWidget(
            QLabel("Signal"), 6, 0
        )

        status_layout.addWidget(
            self.signal_label, 6, 1
        )

        status_layout.addWidget(
            QLabel("Dwell"), 7, 0
        )

        status_layout.addWidget(
            self.dwell_label, 7, 1
        )

        status_layout.addWidget(
            QLabel("Transitions"), 8, 0
        )

        status_layout.addWidget(
            self.transition_label, 8, 1
        )

        status_frame.setLayout(
            status_layout
        )

        main_layout.addWidget(
            status_frame
        )

        # =================================================
        # MARKET TABLE
        # =====================================================

        self.market_table = QTableWidget()

        self.market_table.setColumnCount(12)

        self.market_table.setHorizontalHeaderLabels([

            "Symbol",

            "Action",

            "TradeQuality",

            "Score",

            "Confidence",

            "Entropy",

            "Risk",

            "Size",

            "Cluster",

            "Regime",

            "Dwell",

            "HV",
        ])

        self.market_table.setSortingEnabled(
            True
        )

        header = self.market_table.horizontalHeader()

        header.setSectionResizeMode(
            QHeaderView.Stretch
        )

        main_layout.addWidget(

            QLabel(
                "Live Market Opportunities"
            )
        )

        main_layout.addWidget(
            self.market_table
        )
        # =================================================
        # MONTE CARLO PANEL
        # =================================================

        mc_frame = QFrame()

        mc_frame.setFrameShape(
            QFrame.StyledPanel
        )

        mc_layout = QHBoxLayout()

        # -------------------------------------------------
        # SYMBOL SELECTOR
        # -------------------------------------------------

        self.mc_symbol_selector = QComboBox()

        self.mc_symbol_selector.setMinimumWidth(
            200
        )

        mc_layout.addWidget(
            QLabel("Monte Carlo Symbol")
        )

        mc_layout.addWidget(
            self.mc_symbol_selector
        )

        # -------------------------------------------------
        # PATHS
        # -------------------------------------------------

        self.mc_paths = QSpinBox()

        self.mc_paths.setMinimum(10)

        self.mc_paths.setMaximum(5000)

        self.mc_paths.setValue(100)

        mc_layout.addWidget(
            QLabel("Paths")
        )

        mc_layout.addWidget(
            self.mc_paths
        )

        # -------------------------------------------------
        # STEPS
        # -------------------------------------------------

        self.mc_steps = QSpinBox()

        self.mc_steps.setMinimum(5)

        self.mc_steps.setMaximum(500)

        self.mc_steps.setValue(25)

        mc_layout.addWidget(
            QLabel("Steps")
        )

        mc_layout.addWidget(
            self.mc_steps
        )

        # -------------------------------------------------
        # BUTTON
        # -------------------------------------------------

        self.mc_button = QPushButton(
            "Run Monte Carlo"
        )

        self.mc_button.clicked.connect(
            self.run_montecarlo
        )

        mc_layout.addWidget(
            self.mc_button
        )

        mc_frame.setLayout(
            mc_layout
        )

        main_layout.addWidget(
            mc_frame
        )
        # =================================================
        # MONTE CARLO STATUS
        # =================================================

        self.mc_status = QLabel(
            "Monte Carlo Idle"
        )

        main_layout.addWidget(
            self.mc_status
        )

        # =================================================
        # EVENT LOG
        # =====================================================

        self.event_log = QTextEdit()

        self.event_log.setReadOnly(
            True
        )

        self.event_log.setMaximumHeight(
            200
        )

        main_layout.addWidget(
            QLabel("Event Log")
        )

        main_layout.addWidget(
            self.event_log
        )

        # =================================================
        # FINAL
        # =====================================================

        self.setLayout(main_layout)

    # =================================================
    # LOG
    # =====================================================

    def log(

        self,

        text
    ):

        self.event_log.append(
            text
        )



    # =================================================
    # UPDATE CONFIG
    # =================================================

    def update_config(self):

        mode = self.mode_selector.currentText()

        config_path = Path(
            "configs/engine.yaml"
        )

        # ---------------------------------------------
        # LOAD EXISTING CONFIG
        # ---------------------------------------------

        if config_path.exists():

            import yaml

            with open(

                    config_path,

                    "r"

            ) as f:

                config = yaml.safe_load(f)

        else:

            config = {}

        # ---------------------------------------------
        # UPDATE ONLY MODE
        # ---------------------------------------------

        config[
            "normalization_mode"
        ] = mode

        # ---------------------------------------------
        # SAVE FULL CONFIG
        # ---------------------------------------------

        with open(

                config_path,

                "w"

        ) as f:

            import yaml

            yaml.safe_dump(

                config,

                f,

                sort_keys=False
            )

        # ---------------------------------------------
        # UI
        # ---------------------------------------------

        self.mode_label.setText(
            mode
        )

        self.log(
            f"Updated config → {mode}"
        )

    # =================================================
    # RUN MONTE CARLO
    # =================================================

    def run_montecarlo(self):

        try:

            # -----------------------------------------
            # INPUTS
            # -----------------------------------------

            symbol = (
                self.mc_symbol_selector.currentText()
            )

            paths = self.mc_paths.value()

            steps = self.mc_steps.value()

            self.mc_status.setText(
                f"Running Monte Carlo: {symbol}"
            )

            self.log("\n")

            self.log("=" * 60)

            self.log(
                f"MONTE CARLO STARTED | "
                f"{symbol}"
            )

            self.log("=" * 60)

            # -----------------------------------------
            # LOCAL GEOMETRY
            # -----------------------------------------

            builder = LocalGeometryBuilder()

            geometry = builder.build(
                symbol
            )

            # -----------------------------------------
            # START CLUSTER
            # -----------------------------------------

            # -----------------------------------------
            # LIVE STATE CACHE
            # -----------------------------------------

            # -----------------------------------------
            # LOAD LATEST SAVED CLUSTER
            # -----------------------------------------

            clustered_path = (

                "data/clusters/"
                "test_clusters.parquet"
            )

            cluster_df = pd.read_parquet(
                clustered_path
            )

            cluster_df = cluster_df[

                cluster_df["symbol"]
                == symbol

                ].sort_values("time")

            if len(cluster_df) == 0:
                raise ValueError(

                    f"No clustered history "
                    f"found for {symbol}"
                )

            start_cluster = int(

                cluster_df.iloc[-1][
                    "cluster"
                ]
            )

            self.log(

                f"Starting Cluster: "
                f"{start_cluster}"
            )
            # -----------------------------------------
            # ENGINE
            # -----------------------------------------

            mc_engine = MonteCarloEngine()

            mc_engine.transition_matrix = (
                geometry[
                    "transition_matrix"
                ]
            )

            mc_engine.entropy_table = (
                geometry[
                    "entropy_table"
                ]
            )

            mc_engine.return_table = (
                geometry[
                    "return_table"
                ]
            )

            mc_engine.hv_table = (
                geometry[
                    "hv_table"
                ]
            )

            # -----------------------------------------
            # SIMULATION
            # -----------------------------------------

            df = mc_engine.simulate(

                start_cluster=start_cluster,

                n_paths=paths,

                steps=steps,
            )

            # -----------------------------------------
            # OUTPUT DIR
            # -----------------------------------------

            out_dir = Path(

                f"data/montecarlo/{symbol}"
            )

            out_dir.mkdir(

                parents=True,

                exist_ok=True
            )

            # -----------------------------------------
            # SAVE PARQUET
            # -----------------------------------------

            parquet_path = (

                    out_dir
                    /
                    "latest_paths.parquet"
            )

            df.to_parquet(
                parquet_path
            )

            # -----------------------------------------
            # PLOTS
            # -----------------------------------------

            plotter = MonteCarloPlotter()

            path_png = (

                    out_dir
                    /
                    "latest_paths.png"
            )

            dist_png = (

                    out_dir
                    /
                    "latest_distribution.png"
            )

            plotter.plot_paths(

                df,

                path_png
            )

            plotter.plot_distribution(

                df,

                dist_png
            )

            # -----------------------------------------
            # REPORT
            # -----------------------------------------

            report = MonteCarloReport()

            report_path = (

                    out_dir
                    /
                    "latest_stats.txt"
            )

            report_text = report.generate(

                df=df,

                output_path=report_path,

                symbol=symbol,
            )

            # -----------------------------------------
            # DONE
            # -----------------------------------------

            self.mc_status.setText(

                f"Monte Carlo Complete: "
                f"{symbol}"
            )

            self.log(
                f"Saved Paths → "
                f"{path_png}"
            )

            self.log(
                f"Saved Distribution → "
                f"{dist_png}"
            )

            self.log(
                f"Saved Report → "
                f"{report_path}"
            )

            self.log("\n")

            self.log(report_text)

        except Exception as e:

            self.log(str(e))

            self.mc_status.setText(
                "Monte Carlo Failed"
            )

    # =================================================
    # TRAIN MODEL
    # =====================================================

    def train_model(self):

        self.update_config()

        self.log(
            "\nTraining Started...\n"
        )

        self.start_process([

            "-m",

            "scripts.train_online_kmeans"
        ])

    # =================================================
    # RUN ONLINE ENGINE
    # =====================================================

    def run_online_engine(self):

        self.update_config()

        self.engine_status.setText(
            "RUNNING"
        )

        self.log(
            "\nOnline Engine Started...\n"
        )

        self.start_process([

            "-m",

            "scripts.run_engine"
        ])

    # =================================================
    # START PROCESS
    # =====================================================

    def start_process(

        self,

        args
    ):

        self.process = QProcess()

        self.process.readyReadStandardOutput.connect(
            self.handle_stdout
        )

        self.process.readyReadStandardError.connect(
            self.handle_stderr
        )

        self.process.start(
            "python",
            args
        )

    # =================================================
    # STOP ENGINE
    # =====================================================

    def stop_engine(self):

        if self.process:

            self.process.kill()

            self.engine_status.setText(
                "STOPPED"
            )

            self.log(
                "\nEngine Stopped.\n"
            )

    # =================================================
    # REGIME LABEL
    # =====================================================

    def regime_label(

        self,

        cluster
    ):

        mapping = {

            0:
            "Stable Accum",

            1:
            "Bull Expansion",

            2:
            "Bear Liquidation",

            3:
            "Unstable Auction",

            4:
            "Metastable Drift",

            5:
            "High Entropy",
        }

        return mapping.get(

            cluster,

            "Unknown"
        )

    # =================================================
    # TRADE QUALITY
    # =====================================================

    def trade_quality(

        self,

        score,

        confidence,

        entropy,

        hv,
    ):

        denominator = (

            entropy
            *
            (1 + hv * 100)
        )

        if denominator <= 1e-8:

            denominator = 1e-8

        quality = (

            abs(score)
            *
            confidence
        ) / denominator

        return float(quality)

    # =================================================
    # UPDATE TABLE
    # =====================================================

    def update_market_table(

        self,

        data
    ):

        symbol = data["symbol"]
        # -------------------------------------------------
        # CACHE LATEST STATE
        # -------------------------------------------------

        self.latest_states[symbol] = data
        # -------------------------------------------------
        # ADD SYMBOL TO MONTE CARLO SELECTOR
        # -------------------------------------------------

        existing_symbols = [

            self.mc_symbol_selector.itemText(i)

            for i in range(
                self.mc_symbol_selector.count()
            )
        ]

        if symbol not in existing_symbols:
            self.mc_symbol_selector.addItem(
                symbol
            )

        # -------------------------------------------------
        # ROW
        # -------------------------------------------------

        if symbol in self.market_rows:

            row = self.market_rows[symbol]

        else:

            row = self.market_table.rowCount()

            self.market_table.insertRow(row)

            self.market_rows[symbol] = row

        # -------------------------------------------------
        # QUALITY
        # -------------------------------------------------

        quality = self.trade_quality(

            data["score"],

            data["confidence"],

            data["entropy"],

            data["hv"],
        )

        # -------------------------------------------------
        # VALUES
        # -------------------------------------------------

        values = [

            symbol,

            data["action"],

            f"{quality:.4f}",

            f"{data['score']:.6f}",

            f"{data['confidence']:.3f}",

            f"{data['entropy']:.3f}",

            f"{data['risk']:.3f}",

            f"{data['size']:.2f}",

            str(data["cluster"]),

            self.regime_label(
                data["cluster"]
            ),

            str(
                data["dwell"]
            ),

            f"{data['hv']:.5f}",
        ]

        # -------------------------------------------------
        # WRITE TABLE
        # -------------------------------------------------

        for col, value in enumerate(values):

            item = QTableWidgetItem(
                value
            )

            item.setTextAlignment(
                Qt.AlignCenter
            )

            self.market_table.setItem(

                row,

                col,

                item
            )

        # -------------------------------------------------
        # ACTION COLOR
        # -------------------------------------------------

        action_item = self.market_table.item(
            row,
            1
        )

        if data["action"] == "LONG":

            action_item.setBackground(
                Qt.green
            )

        elif data["action"] == "SHORT":

            action_item.setBackground(
                Qt.red
            )

        else:

            action_item.setBackground(
                Qt.lightGray
            )

        # -------------------------------------------------
        # SORT
        # -------------------------------------------------

        self.market_table.sortItems(

            2,

            Qt.DescendingOrder
        )

    # =================================================
    # HANDLE STDOUT
    # =====================================================

    def handle_stdout(self):

        data = self.process.readAllStandardOutput()

        stdout = bytes(data).decode()
        print(stdout)

        lines = stdout.splitlines()


        for line in lines:

            # -------------------------------------------------
            # TRADE UPDATE
            # -------------------------------------------------

            if "TRADE_UPDATE:" in line:

                try:
                    print("RAW STDOUT:", line)

                    payload = ast.literal_eval(

                        line.replace(
                            "TRADE_UPDATE:",
                            ""
                        )
                    )

                    self.update_market_table(
                        payload
                    )

                    # -----------------------------------------
                    # UPDATE STATUS PANEL
                    # -----------------------------------------

                    self.symbol_label.setText(

                        payload["symbol"]
                    )

                    self.cluster_label.setText(

                        str(
                            payload["cluster"]
                        )
                    )

                    self.entropy_label.setText(

                        f"{payload['entropy']:.4f}"
                    )

                    self.confidence_label.setText(

                        f"{payload['confidence']:.4f}"
                    )

                    self.signal_label.setText(

                        payload["action"]
                    )

                    self.dwell_label.setText(

                        str(
                            payload["dwell"]
                        )
                    )

                except Exception as e:

                    self.log(
                        str(e)
                    )

            # -------------------------------------------------
            # IMPORTANT LOGS
            # -------------------------------------------------

            elif "INITIALIZED" in line:

                self.log(line)

            elif "Saved" in line:

                self.log(line)

            elif "ERROR" in line:

                self.log(line)

    # =================================================
    # STDERR
    # =====================================================

    def handle_stderr(self):

        data = self.process.readAllStandardError()

        stderr = bytes(data).decode()

        self.log(stderr)


# =====================================================
# MAIN
# =====================================================

if __name__ == "__main__":

    app = QApplication(sys.argv)

    window = RunApp()

    window.show()

    sys.exit(app.exec())