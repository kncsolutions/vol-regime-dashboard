from PySide6.QtWidgets import (

    QWidget,

    QVBoxLayout,

    QTextEdit
)


class ResultWidget(QWidget):

    def __init__(self):

        super().__init__()

        # ====================================================
        # LAYOUT
        # ====================================================

        layout = QVBoxLayout()

        self.setLayout(layout)

        # ====================================================
        # TEXT AREA
        # ====================================================

        self.text_area = QTextEdit()

        self.text_area.setReadOnly(True)

        layout.addWidget(
            self.text_area
        )

    # ========================================================
    # UPDATE RESULT
    # ========================================================

    def update_result(self, result):

        positive = result[
            "positive_gex"
        ]

        negative = result[
            "negative_gex"
        ]

        text = f"""

==================================================
CURRENT MARKET REGIME
==================================================

{result["current_market_regime"]}


==================================================
POSITIVE GEX MANIFOLD
==================================================

Long Vol Probability:
{positive["probability"]:.4f}

Short Vol Probability:
{1 - positive["probability"]:.4f}

Expected Edge:
{positive["expected_edge"]:.4f}

Edge Volatility:
{positive["edge_volatility"]:.4f}

Positive Tail Probability:
{positive["positive_tail_probability"]:.4f}

Negative Tail Probability:
{positive["negative_tail_probability"]:.4f}


==================================================
NEGATIVE GEX MANIFOLD
==================================================

Long Vol Probability:
{negative["probability"]:.4f}

Short Vol Probability:
{1 - negative["probability"]:.4f}

Expected Edge:
{negative["expected_edge"]:.4f}

Edge Volatility:
{negative["edge_volatility"]:.4f}

Positive Tail Probability:
{negative["positive_tail_probability"]:.4f}

Negative Tail Probability:
{negative["negative_tail_probability"]:.4f}


==================================================
REGIME DIFFERENTIAL
==================================================

Delta Expected Edge:
{result["delta_expected_edge"]:.4f}

Delta Edge Volatility:
{result["delta_edge_volatility"]:.4f}


==================================================
TRANSITION DYNAMICS
==================================================

Probability Next Positive GEX:
{result["probability_next_positive_gex"]:.4f}

Probability Next Negative GEX:
{result["probability_next_negative_gex"]:.4f}

Persistence Probability:
{result["regime_persistence_probability"]:.4f}

Flip Probability:
{result["regime_flip_probability"]:.4f}

Transition Entropy:
{result["transition_entropy"]:.4f}


==================================================
TRANSITION MATRIX
==================================================

{result["transition_matrix"]}


==================================================
SIMULATION OUTPUT
==================================================

Positive GEX Simulation Folder:
{positive["simulation_output_dir"]}

Negative GEX Simulation Folder:
{negative["simulation_output_dir"]}


==================================================
END OF ANALYSIS
==================================================

"""

        # ====================================================
        # APPEND TO HISTORY
        # ====================================================

        self.text_area.append(
            text
        )

        # ====================================================
        # AUTO SCROLL TO BOTTOM
        # ====================================================

        scrollbar = (
            self.text_area.verticalScrollBar()
        )

        scrollbar.setValue(
            scrollbar.maximum()
        )