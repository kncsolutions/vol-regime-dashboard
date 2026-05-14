import os

# Better tkinter scaling on Linux
os.environ["TK_NO_NATIVE_FILEDIALOG"] = "1"

import tkinter as tk
from tkinter import messagebox, ttk

import pandas as pd
import numpy as np

import matplotlib
matplotlib.use("TkAgg")

from matplotlib.backends.backend_tkagg import (
    FigureCanvasTkAgg,
    NavigationToolbar2Tk
)

from matplotlib.figure import Figure

from offline_viewer.LargeFontFileDialog import (
    ask_large_font_csv
)

# ==========================================================
# GLOBAL FONT SETTINGS
# ==========================================================
matplotlib.rcParams.update({
    'font.size': 16,
    'axes.titlesize': 24,
    'axes.labelsize': 18,
    'xtick.labelsize': 16,
    'ytick.labelsize': 16
})


class ScrollableCSVPlotter:

    def __init__(self, root):

        self.root = root

        self.root.title("Scrollable CSV Plotter")

        self.root.geometry("1800x1000")

        self.root.tk.call('tk', 'scaling', 2.0)

        self.root.option_add("*Font", "Arial 14")

        self.df = None

        self.file_path = None

        self.current_x = None
        self.current_y = None

        # =====================================================
        # VIEWPORT SETTINGS
        # =====================================================
        self.viewport_size = 400

        self.start_index = 0

        # Hover data
        self.visible_x_data = None
        self.visible_y_data = None
        self.visible_is_datetime = False

        # =====================================================
        # TOP CONTROLS
        # =====================================================
        top_frame = tk.Frame(root)

        top_frame.pack(
            side=tk.TOP,
            fill=tk.X,
            padx=10,
            pady=10
        )

        # =====================================================
        # LOAD BUTTON
        # =====================================================
        tk.Button(
            top_frame,
            text="Load CSV",
            command=self.load_csv,
            font=("Arial", 14)
        ).pack(side=tk.LEFT, padx=5)

        # =====================================================
        # REFRESH BUTTON
        # =====================================================
        tk.Button(
            top_frame,
            text="Refresh CSV",
            command=self.refresh_csv,
            font=("Arial", 14)
        ).pack(side=tk.LEFT, padx=5)

        # =====================================================
        # X AXIS
        # =====================================================
        tk.Label(
            top_frame,
            text="X Axis:"
        ).pack(side=tk.LEFT, padx=(20, 5))

        self.x_combo = ttk.Combobox(
            top_frame,
            width=25,
            state="readonly"
        )

        self.x_combo.pack(side=tk.LEFT)

        # =====================================================
        # Y AXIS
        # =====================================================
        tk.Label(
            top_frame,
            text="Y Axis:"
        ).pack(side=tk.LEFT, padx=(20, 5))

        self.y_combo = ttk.Combobox(
            top_frame,
            width=25,
            state="readonly"
        )

        self.y_combo.pack(side=tk.LEFT)

        # =====================================================
        # PLOT BUTTON
        # =====================================================
        tk.Button(
            top_frame,
            text="Plot",
            command=self.plot_selected,
            font=("Arial", 14)
        ).pack(side=tk.LEFT, padx=20)

        # =====================================================
        # VIEWPORT SLIDER
        # =====================================================
        tk.Label(
            top_frame,
            text="Viewport Size:"
        ).pack(side=tk.LEFT, padx=(20, 5))

        self.viewport_slider = tk.Scale(
            top_frame,
            from_=50,
            to=2000,
            orient=tk.HORIZONTAL,
            length=300,
            resolution=50,
            font=("Arial", 12),
            command=self.on_viewport_change
        )

        self.viewport_slider.set(
            self.viewport_size
        )

        self.viewport_slider.pack(
            side=tk.LEFT,
            padx=10
        )

        # =====================================================
        # FIGURE
        # =====================================================
        self.fig = Figure(
            figsize=(18, 10),
            dpi=80
        )

        self.ax = self.fig.add_subplot(111)

        plot_frame = tk.Frame(root)

        plot_frame.pack(
            fill=tk.BOTH,
            expand=True
        )

        self.canvas = FigureCanvasTkAgg(
            self.fig,
            master=plot_frame
        )

        self.canvas_widget = self.canvas.get_tk_widget()

        self.canvas_widget.pack(
            fill=tk.BOTH,
            expand=True
        )

        self.toolbar = NavigationToolbar2Tk(
            self.canvas,
            plot_frame
        )

        self.toolbar.update()

        # =====================================================
        # ENLARGE TOOLBAR FONTS
        # =====================================================
        for child in self.toolbar.winfo_children():

            try:
                child.config(font=("Arial", 16))
            except:
                pass

        # =====================================================
        # HORIZONTAL SCROLLBAR
        # =====================================================
        scrollbar_frame = tk.Frame(root)

        scrollbar_frame.pack(fill=tk.X)

        self.scrollbar = tk.Scale(
            scrollbar_frame,
            from_=0,
            to=100,
            orient=tk.HORIZONTAL,
            length=1500,
            label="Scroll Through Data",
            command=self.on_scroll,
            font=("Arial", 18)
        )

        self.scrollbar.pack(
            fill=tk.X,
            padx=20,
            pady=10
        )

    # =========================================================
    # LOAD CSV
    # =========================================================
    def load_csv(self):

        path = ask_large_font_csv(self.root)

        if not path:
            return

        self.file_path = path

        self.read_csv()

    # =========================================================
    # REFRESH CSV
    # =========================================================
    def refresh_csv(self):

        if not self.file_path:
            return

        self.read_csv()

        if self.current_x and self.current_y:

            self.move_to_latest()

            self.plot_graph()

    # =========================================================
    # READ CSV
    # =========================================================
    def read_csv(self):

        try:

            self.df = pd.read_csv(self.file_path)

            cols = list(self.df.columns)

            self.x_combo["values"] = cols
            self.y_combo["values"] = cols

            if len(cols) >= 2:

                self.x_combo.current(0)
                self.y_combo.current(1)

            messagebox.showinfo(
                "CSV Loaded",
                f"Rows: {len(self.df)}"
            )

        except Exception as e:

            messagebox.showerror(
                "Error",
                str(e)
            )

    # =========================================================
    # UNIX TIMESTAMP DETECTION
    # =========================================================
    def try_convert_time(self, series):

        try:

            numeric = pd.to_numeric(
                series,
                errors='coerce'
            )

            sample = numeric.dropna()

            if len(sample) == 0:
                return series, False

            mean_val = sample.mean()

            # Unix seconds
            if 1e9 < mean_val < 2e10:

                dt = pd.to_datetime(
                    numeric,
                    unit='s'
                )

                return dt, True

            # Unix milliseconds
            elif 1e12 < mean_val < 2e13:

                dt = pd.to_datetime(
                    numeric,
                    unit='ms'
                )

                return dt, True

            return series, False

        except:
            return series, False

    # =========================================================
    # VIEWPORT CHANGE CALLBACK
    # =========================================================
    def on_viewport_change(self, value):

        self.viewport_size = int(value)

        if self.df is None:
            return

        max_start = max(
            len(self.df) - self.viewport_size,
            0
        )

        self.start_index = min(
            self.start_index,
            max_start
        )

        self.scrollbar.config(
            to=max_start
        )

        self.plot_graph()

    # =========================================================
    # MOVE TO LATEST DATA
    # =========================================================
    def move_to_latest(self):

        total = len(self.df)

        self.start_index = max(
            total - self.viewport_size,
            0
        )

        self.scrollbar.set(
            self.start_index
        )

    # =========================================================
    # INITIAL PLOT
    # =========================================================
    def plot_selected(self):

        if self.df is None:
            return

        self.current_x = self.x_combo.get()
        self.current_y = self.y_combo.get()

        self.move_to_latest()

        self.plot_graph()

    # =========================================================
    # SCROLL CALLBACK
    # =========================================================
    def on_scroll(self, value):

        self.start_index = int(value)

        self.plot_graph()

    # =========================================================
    # CUSTOM HOVER FORMAT
    # =========================================================
    def custom_format_coord(self, x, y):

        try:

            idx = int(round(x))

            if idx < 0 or idx >= len(self.visible_x_data):
                return ""

            real_x = self.visible_x_data.iloc[idx]

            real_y = self.visible_y_data.iloc[idx]

            if self.visible_is_datetime:

                real_x = pd.to_datetime(real_x).strftime(
                    "%Y-%m-%d %H:%M:%S"
                )

            return f"X={real_x}    Y={real_y:.6f}"

        except:
            return ""

    # =========================================================
    # MAIN PLOT FUNCTION
    # =========================================================
    def plot_graph(self):

        try:

            self.ax.clear()

            x = self.df[self.current_x]

            y = pd.to_numeric(
                self.df[self.current_y],
                errors='coerce'
            )

            mask = y.notna()

            x = x[mask]
            y = y[mask]

            # =================================================
            # TIME CONVERSION
            # =================================================
            x, is_datetime = self.try_convert_time(x)

            # =================================================
            # GAP DETECTION
            # =================================================
            gap_positions = []

            if is_datetime:

                dt_series = pd.to_datetime(x)

                diffs = dt_series.diff()

                median_gap = diffs.median()

                threshold = median_gap * 5

                for i, d in enumerate(diffs):

                    if pd.notna(d) and d > threshold:

                        gap_positions.append(i)

            # =================================================
            # VIEWPORT
            # =================================================
            end_index = self.start_index + self.viewport_size

            x_view = x.iloc[self.start_index:end_index]
            y_view = y.iloc[self.start_index:end_index]

            # =================================================
            # STORE HOVER DATA
            # =================================================
            self.visible_x_data = x_view.reset_index(drop=True)
            self.visible_y_data = y_view.reset_index(drop=True)
            self.visible_is_datetime = is_datetime

            # =================================================
            # EQUAL SPACING
            # =================================================
            plot_x = range(len(x_view))

            self.ax.plot(
                plot_x,
                y_view,
                linewidth=2
            )

            # =================================================
            # CUSTOM HOVER
            # =================================================
            self.ax.format_coord = self.custom_format_coord

            # =================================================
            # DRAW GAP SEPARATORS
            # =================================================
            for gap_pos in gap_positions:

                if self.start_index <= gap_pos < end_index:

                    visible_x = gap_pos - self.start_index

                    self.ax.axvline(
                        x=visible_x,
                        color='red',
                        linestyle='--',
                        linewidth=1.5,
                        alpha=0.7
                    )

            # =================================================
            # TITLES
            # =================================================
            self.ax.set_title(
                f"{self.current_y} vs {self.current_x}",
                fontsize=24
            )

            self.ax.set_xlabel(
                self.current_x,
                fontsize=18
            )

            self.ax.set_ylabel(
                self.current_y,
                fontsize=18
            )

            self.ax.grid(True)

            # =================================================
            # CUSTOM DATETIME LABELS
            # =================================================
            if is_datetime and len(x_view) > 0:

                tick_count = 8

                positions = np.linspace(
                    0,
                    len(x_view) - 1,
                    tick_count,
                    dtype=int
                )

                labels = []

                for pos in positions:

                    ts = pd.to_datetime(
                        x_view.iloc[pos]
                    )

                    labels.append(
                        ts.strftime(
                            '%Y-%m-%d\n%H:%M:%S'
                        )
                    )

                self.ax.set_xticks(positions)

                self.ax.set_xticklabels(
                    labels,
                    fontsize=16
                )

            # =================================================
            # UPDATE SCROLLBAR RANGE
            # =================================================
            max_scroll = max(
                len(x) - self.viewport_size,
                0
            )

            self.scrollbar.config(
                to=max_scroll
            )

            self.canvas.draw()

        except Exception as e:

            messagebox.showerror(
                "Plot Error",
                str(e)
            )


# =============================================================
# MAIN
# =============================================================
if __name__ == "__main__":

    root = tk.Tk()

    app = ScrollableCSVPlotter(root)

    root.mainloop()