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
