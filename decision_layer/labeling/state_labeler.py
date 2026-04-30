import numpy as np

# =========================================================
# STATE MAP
# =========================================================
STATE_MAP = {
    0: "TREND",
    1: "TRANSITION",
    2: "MEAN_REVERT"
}

# =========================================================
# THRESHOLDS
# =========================================================
THRESHOLDS = {
    "trend_flow": 0.25,
    "mean_revert_flow": 0.25,
    "transition_flow": 0.2,      # NEW (important)
    "expansion_min": 0.2
}

# =========================================================
# LABEL LOGIC
# =========================================================
def label_state(row):
    flow = float(row["flow_norm"])
    flow_align = int(row["flow_alignment"])
    exp_dir = int(row["expansion_direction"])
    exp_str = float(row["expansion_strength"])

    abs_flow = abs(flow)

    # =====================================================
    # 1. TREND
    # =====================================================
    if (
        exp_dir == 1
        and flow_align == 1
        and abs_flow > THRESHOLDS["trend_flow"]
        and exp_str > THRESHOLDS["expansion_min"]
    ):
        return 0  # TREND

    # =====================================================
    # 2. MEAN REVERT
    # =====================================================
    if (
        exp_dir == -1
        and abs_flow < THRESHOLDS["mean_revert_flow"]
    ):
        return 2  # MEAN_REVERT

    # =====================================================
    # 3. TRANSITION (explicit, not catch-all)
    # =====================================================
    if abs_flow < THRESHOLDS["transition_flow"]:
        return 1

    # =====================================================
    # 4. FALLBACK → treat as TRANSITION
    # =====================================================
    return 1


# =========================================================
# APPLY LABELS
# =========================================================
def apply_state_labels(df):
    df = df.copy()

    df["state"] = df.apply(label_state, axis=1)
    df["state_name"] = df["state"].map(STATE_MAP)

    return df