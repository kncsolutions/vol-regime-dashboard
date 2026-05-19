import os

os.environ["QT_QPA_PLATFORM"] = "xcb"

os.environ["QT_QUICK_BACKEND"] = "software"

from offline_viewer.main_window import launch_ui


if __name__ == "__main__":

    launch_ui()
