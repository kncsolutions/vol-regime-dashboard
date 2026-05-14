import os
import tkinter as tk
from tkinter import ttk


class LargeFontFileDialog:

    def __init__(self, parent):

        self.parent = parent

        self.selected_file = None

        self.window = tk.Toplevel(parent)

        self.window.title("Select CSV File")

        self.window.geometry("1200x700")

        self.window.grab_set()

        self.current_path = os.getcwd()

        # =====================================================
        # PATH LABEL
        # =====================================================
        self.path_label = tk.Label(
            self.window,
            text=self.current_path,
            font=("Arial", 16),
            anchor="w"
        )

        self.path_label.pack(
            fill=tk.X,
            padx=10,
            pady=10
        )

        # =====================================================
        # FILE LIST
        # =====================================================
        frame = tk.Frame(self.window)

        frame.pack(
            fill=tk.BOTH,
            expand=True,
            padx=10,
            pady=10
        )

        scrollbar = tk.Scrollbar(frame)

        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.listbox = tk.Listbox(
            frame,
            font=("Arial", 18),
            yscrollcommand=scrollbar.set,
            selectmode=tk.SINGLE
        )

        self.listbox.pack(
            side=tk.LEFT,
            fill=tk.BOTH,
            expand=True
        )

        scrollbar.config(
            command=self.listbox.yview
        )

        # =====================================================
        # BUTTONS
        # =====================================================
        btn_frame = tk.Frame(self.window)

        btn_frame.pack(fill=tk.X, pady=10)

        tk.Button(
            btn_frame,
            text="Open",
            font=("Arial", 16),
            command=self.open_selected
        ).pack(side=tk.RIGHT, padx=10)

        tk.Button(
            btn_frame,
            text="Up",
            font=("Arial", 16),
            command=self.go_up
        ).pack(side=tk.LEFT, padx=10)

        # Double click support
        self.listbox.bind(
            "<Double-Button-1>",
            self.double_click
        )

        self.populate()

    # =========================================================
    # POPULATE DIRECTORY
    # =========================================================
    def populate(self):

        self.listbox.delete(0, tk.END)

        self.path_label.config(
            text=self.current_path
        )

        items = os.listdir(self.current_path)

        items.sort()

        for item in items:

            full_path = os.path.join(
                self.current_path,
                item
            )

            if os.path.isdir(full_path):
                self.listbox.insert(
                    tk.END,
                    "[DIR] " + item
                )

            else:
                self.listbox.insert(
                    tk.END,
                    item
                )

    # =========================================================
    # DOUBLE CLICK
    # =========================================================
    def double_click(self, event):

        selection = self.listbox.curselection()

        if not selection:
            return

        item = self.listbox.get(selection[0])

        if item.startswith("[DIR] "):

            folder = item.replace("[DIR] ", "")

            self.current_path = os.path.join(
                self.current_path,
                folder
            )

            self.populate()

        else:

            self.open_selected()

    # =========================================================
    # GO UP
    # =========================================================
    def go_up(self):

        self.current_path = os.path.dirname(
            self.current_path
        )

        self.populate()

    # =========================================================
    # OPEN FILE
    # =========================================================
    def open_selected(self):

        selection = self.listbox.curselection()

        if not selection:
            return

        item = self.listbox.get(selection[0])

        if item.startswith("[DIR] "):
            return

        self.selected_file = os.path.join(
            self.current_path,
            item
        )

        self.window.destroy()


# =============================================================
# FUNCTION TO USE
# =============================================================
def ask_large_font_csv(root):

    dialog = LargeFontFileDialog(root)

    root.wait_window(dialog.window)

    return dialog.selected_file