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
