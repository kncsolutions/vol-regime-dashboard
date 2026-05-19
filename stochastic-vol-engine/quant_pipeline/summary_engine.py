import os
import json
from datetime import datetime
import numpy as np

from backend.config import (
    MODEL_PARAMETERS
)


def save_statistical_summary(

    result,

    csv_name,

    output_dir
):

    # ====================================================
    # CREATE DIRECTORY
    # ====================================================

    os.makedirs(
        output_dir,
        exist_ok=True
    )

    # ====================================================
    # FILE PATH
    # ====================================================

    save_path = os.path.join(

        output_dir,

        f"{csv_name}_summary.txt"
    )

    # ====================================================
    # POSITIVE GEX SHORTCUT
    # ====================================================

    positive = result[
        "positive_gex"
    ]

    # ====================================================
    # NEGATIVE GEX SHORTCUT
    # ====================================================

    negative = result[
        "negative_gex"
    ]

    # ====================================================
    # MONTE CARLO MOMENTS
    # ====================================================

    positive_moments = json.dumps(

        positive[
            "simulation_moments"
        ],

        indent=4
    )

    negative_moments = json.dumps(

        negative[
            "simulation_moments"
        ],

        indent=4
    )

    # ====================================================
    # COVARIANCE EIGENVALUES
    # ====================================================

    positive_eigenvalues = np.round(

        positive[
            "covariance_eigenvalues"
        ],

        6
    ).tolist()

    negative_eigenvalues = np.round(

        negative[
            "covariance_eigenvalues"
        ],

        6
    ).tolist()

    # ====================================================
    # REGIME DURATION STATS
    # ====================================================

    regime_duration_stats = result.get(

        "regime_duration_stats",

        {}
    )

    # ====================================================
    # BUILD SUMMARY
    # ====================================================

    summary_text = f"""

==================================================
STOCHASTIC VOLATILITY ENGINE SUMMARY
==================================================

CSV FILE:
{csv_name}

==================================================
EXPERIMENT TIMESTAMP
==================================================

{datetime.now()}


==================================================
MODEL PARAMETERS
==================================================

{json.dumps(
    MODEL_PARAMETERS,
    indent=4
)}


==================================================
CURRENT MARKET REGIME
==================================================

{result["current_market_regime"]}


==================================================
FEATURE DISPERSION
==================================================

POSITIVE GEX:

{json.dumps(
    positive["feature_dispersion"],
    indent=4
)}

NEGATIVE GEX:

{json.dumps(
    negative["feature_dispersion"],
    indent=4
)}


==================================================
RECENT ENTROPY HISTORY
==================================================

{result["entropy_history"]}


==================================================
POSITIVE GEX MANIFOLD
==================================================

Probability Long Vol:
{positive["probability"]:.4f}

Expected Edge:
{positive["expected_edge"]:.4f}

Edge Variance:
{positive["edge_variance"]:.4f}

Edge Volatility:
{positive["edge_volatility"]:.4f}

Positive Tail Probability:
{positive["positive_tail_probability"]:.4f}

Negative Tail Probability:
{positive["negative_tail_probability"]:.4f}


==================================================
NEGATIVE GEX MANIFOLD
==================================================

Probability Long Vol:
{negative["probability"]:.4f}

Expected Edge:
{negative["expected_edge"]:.4f}

Edge Variance:
{negative["edge_variance"]:.4f}

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

{json.dumps(
    result["transition_matrix"],
    indent=4
)}


==================================================
POSITIVE GEX LOCAL DRIFT
==================================================

{positive["local_drift"]}


==================================================
NEGATIVE GEX LOCAL DRIFT
==================================================

{negative["local_drift"]}


==================================================
POSITIVE GEX LOCAL COVARIANCE
==================================================

{positive["local_covariance"]}


==================================================
NEGATIVE GEX LOCAL COVARIANCE
==================================================

{negative["local_covariance"]}


==================================================
COVARIANCE EIGENVALUES
==================================================

POSITIVE GEX:

{positive_eigenvalues}

NEGATIVE GEX:

{negative_eigenvalues}


==================================================
MONTE CARLO MOMENTS
==================================================

POSITIVE GEX:

{positive_moments}

NEGATIVE GEX:

{negative_moments}


==================================================
REGIME DURATION STATISTICS
==================================================

{json.dumps(
    regime_duration_stats,
    indent=4
)}


==================================================
SIMULATION OUTPUT DIRECTORIES
==================================================

Positive GEX:
{positive["simulation_output_dir"]}

Negative GEX:
{negative["simulation_output_dir"]}


==================================================
SUMMARY COMPLETE
==================================================

"""

    # ====================================================
    # SAVE FILE
    # ====================================================

    with open(

        save_path,

        "w"

    ) as f:

        f.write(summary_text)

    # ====================================================
    # CONSOLE OUTPUT
    # ====================================================

    print(
        f"\nSummary saved to:\n{save_path}"
    )