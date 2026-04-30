import sys
import os

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
)



import pandas as pd
import numpy as np

from decision_layer.labeling.state_labeler import (
    label_state,
    apply_state_labels,
    STATE_MAP
)

# ----------------------------------------
# 1. Unit Tests for Each State
# ----------------------------------------

def test_individual_states():
    test_rows = [
        # EXPLOSIVE
        {
            "flow_norm": 0.8,
            "flow_alignment": 1,
            "dS_norm": 0.5,
            "expansion_direction": 1,
            "expansion_strength": 1.5,
            "skew_change_norm": 0.6,
            "flip_distance": 0.5,
            "expected": 5
        },

        # TREND_UP
        {
            "flow_norm": 0.6,
            "flow_alignment": 1,
            "dS_norm": 0.4,
            "expansion_direction": 1,
            "expansion_strength": 0.8,
            "skew_change_norm": 0.2,
            "flip_distance": 0.5,
            "expected": 0
        },

        # TREND_DOWN
        {
            "flow_norm": 0.6,
            "flow_alignment": 1,
            "dS_norm": -0.4,
            "expansion_direction": 1,
            "expansion_strength": 0.8,
            "skew_change_norm": -0.2,
            "flip_distance": 0.5,
            "expected": 1
        },

        # TRAP (strong flow but misaligned)
        {
            "flow_norm": 0.7,
            "flow_alignment": 0,
            "dS_norm": 0.5,
            "expansion_direction": 1,
            "expansion_strength": 1.0,
            "skew_change_norm": 0.5,
            "flip_distance": 0.5,
            "expected": 3
        },

        # MEAN_REVERT
        {
            "flow_norm": 0.1,
            "flow_alignment": 0,
            "dS_norm": 0.0,
            "expansion_direction": -1,
            "expansion_strength": 0.4,
            "skew_change_norm": 0.1,
            "flip_distance": 0.5,
            "expected": 2
        },

        # DRIFT
        {
            "flow_norm": 0.05,
            "flow_alignment": 0,
            "dS_norm": 0.0,
            "expansion_direction": 0,
            "expansion_strength": 0.1,
            "skew_change_norm": 0.05,
            "flip_distance": 0.5,
            "expected": 4
        },
    ]

    print("\n--- Individual State Tests ---")

    for i, row in enumerate(test_rows):
        result = label_state(row)
        expected = row["expected"]

        print(f"Test {i}: Expected {STATE_MAP[expected]}, Got {STATE_MAP[result]}")

        assert result == expected, f"❌ Test {i} failed"


# ----------------------------------------
# 2. Distribution Test
# ----------------------------------------

def test_distribution():
    np.random.seed(42)
    n = 1000

    df = pd.DataFrame({
        "flow_norm": np.random.normal(0, 0.5, n),
        "flow_alignment": np.random.choice([0, 1], n, p=[0.5, 0.5]),
        "dS_norm": np.random.normal(0, 0.5, n),
        "expansion_direction": np.random.choice([-1, 0, 1], n, p=[0.3, 0.3, 0.4]),
        "expansion_strength": np.abs(np.random.normal(0.8, 0.5, n)),
        "skew_change_norm": np.random.normal(0, 0.4, n),
        "flip_distance": np.random.uniform(0, 1, n),
    })

    df = apply_state_labels(df)

    counts = df["state_name"].value_counts(normalize=True)

    print("\n--- State Distribution ---")
    print(counts)

    # No dead states
    assert len(counts) >= 5, "❌ Too few states detected"

    # No extreme dominance
    assert counts.max() < 0.8, "❌ One state dominates too much"


# ----------------------------------------
# 3. Transition Matrix Test
# ----------------------------------------

def test_transitions():
    np.random.seed(42)
    n = 1000

    df = pd.DataFrame({
        "flow_norm": np.random.normal(0, 0.5, n),
        "flow_alignment": np.random.choice([0, 1], n),
        "dS_norm": np.random.normal(0, 0.5, n),
        "expansion_direction": np.random.choice([-1, 0, 1], n),
        "expansion_strength": np.abs(np.random.normal(0.8, 0.5, n)),
        "skew_change_norm": np.random.normal(0, 0.4, n),
        "flip_distance": np.random.uniform(0, 1, n),
    })

    df = apply_state_labels(df)

    transitions = pd.crosstab(
        df["state"].shift(1),
        df["state"],
        normalize=1
    )

    print("\n--- Transition Matrix ---")
    print(transitions)

    # No NaNs
    assert not transitions.isnull().values.any(), "❌ NaNs in transition matrix"

    # Some persistence (weak since random data)
    diag_mean = np.diag(transitions.fillna(0)).mean()
    assert diag_mean > 0.05, "❌ No state persistence at all"


# ----------------------------------------
# Run All Tests
# ----------------------------------------

if __name__ == "__main__":
    test_individual_states()
    test_distribution()
    test_transitions()

    print("\n✅ All tests passed.")