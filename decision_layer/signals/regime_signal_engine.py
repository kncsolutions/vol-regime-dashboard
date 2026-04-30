import numpy as np
import pandas as pd


# =========================================================
# SIGNAL ENGINE
# =========================================================
class RegimeSignalEngine:

    def __init__(self):
        pass

    # =====================================================
    # STATE-BASED POSTURE
    # =====================================================
    def state_posture(self, row, state):
        flow = float(row["flow_norm"])

        if state == 0:
            return "LONG_TREND" if flow > 0 else "SHORT_TREND"

        elif state == 1:
            return "REVERSAL_LONG" if flow > 0 else "REVERSAL_SHORT"

        elif state == 2:
            return "RANGE"

        return "WAIT"

    # =====================================================
    # TRANSITION-BASED ACTION
    # =====================================================
    def transition_signal(self, prev_state, curr_state):
        """
        Transition-driven events (higher priority than posture)
        """

        # ----------------------------
        # Breakout
        # ----------------------------
        if prev_state == 2 and curr_state == 0:
            return "BREAKOUT"

        # ----------------------------
        # Trend weakening
        # ----------------------------
        if prev_state == 0 and curr_state == 1:
            return "EXIT_TREND"

        # ----------------------------
        # Trend confirmation
        # ----------------------------
        if prev_state == 1 and curr_state == 0:
            return "TREND_RESUME"

        # ----------------------------
        # Reversal
        # ----------------------------
        if prev_state == 0 and curr_state == 2:
            return "REVERSAL"

        # ----------------------------
        # Exit range
        # ----------------------------
        if prev_state == 2 and curr_state == 1:
            return "EXIT_RANGE"

        return None

    # =====================================================
    # CORE LOGIC
    # =====================================================
    def generate_signal(self, row, prev_state, curr_state):
        """
        Priority:
        1. Transition event
        2. State posture
        """

        # ----------------------------
        # 1. TRANSITION SIGNAL (priority)
        # ----------------------------
        transition = self.transition_signal(prev_state, curr_state)
        if transition is not None:
            return transition

        # ----------------------------
        # 2. STATE POSTURE
        # ----------------------------
        return self.state_posture(row, curr_state)

    # =====================================================
    # APPLY OVER DATAFRAME
    # =====================================================
    def apply(self, df):
        df = df.copy()

        states = df["hmm_state"].values
        signals = []

        prev_state = states[0]

        for i, curr_state in enumerate(states):
            row = df.iloc[i]

            signal = self.generate_signal(row, prev_state, curr_state)
            signals.append(signal)

            prev_state = curr_state

        df["signal"] = signals

        return df