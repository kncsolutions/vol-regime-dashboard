import numpy as np
import pandas as pd


class RegimeSignalEngineV2:

    def __init__(self):
        pass

    # =====================================================
    # CONFIDENCE SCORE
    # =====================================================
    def compute_confidence(self, prev_state, curr_state, persistence):

        base = persistence[curr_state]

        if curr_state != prev_state:
            base *= 0.5

        return float(np.clip(base, 0.0, 1.0))

    # =====================================================
    # SIGNAL STRENGTH
    # =====================================================
    def compute_strength(self, row):

        flow = abs(row.get("flow_norm", 0))
        expansion = abs(row.get("expansion_strength", 0))
        intensity = abs(row.get("regime_intensity", 0))

        strength = 0.5 * flow + 0.3 * expansion + 0.2 * intensity

        return float(np.tanh(strength))

    # =====================================================
    # VOLATILITY FILTER
    # =====================================================
    def volatility_filter(self, row):

        iv = abs(row.get("IV_change_norm", 0))
        spread = abs(row.get("spread_norm", 0))

        vol_score = np.tanh(iv + spread)

        return float(np.clip(1 - vol_score, 0.0, 1.0))

    # =====================================================
    # POSITION SIZING
    # =====================================================
    def compute_position_size(self, signal, confidence, strength, vol_adj):

        base = confidence * strength * vol_adj

        # selective amplification (only high-quality signals)
        if signal == "LONG_TREND":
            base *= 1.2

        elif signal == "REVERSAL_LONG":
            base *= 1.05

        else:
            return 0.0

        return float(np.clip(base, 0.0, 1.0))

    # =====================================================
    # STATE POSTURE
    # =====================================================
    def state_posture(self, row, state):

        flow = float(row.get("flow_norm", 0))

        if state == 0:
            return "LONG_TREND" if flow > 0 else "SHORT_TREND"

        elif state == 1:
            return "REVERSAL_LONG" if flow > 0 else "REVERSAL_SHORT"

        elif state == 2:
            return "RANGE"

        return "WAIT"

    # =====================================================
    # TRANSITIONS (reduced set)
    # =====================================================
    def transition_signal(self, prev_state, curr_state):

        # Only keep meaningful transitions
        if prev_state == 0 and curr_state == 1:
            return "EXIT_TREND"

        if prev_state == 1 and curr_state == 0:
            return "TREND_RESUME"

        return None

    # =====================================================
    # CORE SIGNAL
    # =====================================================
    def generate(self, row, prev_state, curr_state, persistence):

        # ----------------------------
        # HARD FILTER: bad regime
        # ----------------------------
        if curr_state == 2:
            return "WAIT", 0.0, 0.0, 0.0, 0.0

        # ----------------------------
        # 1. transition
        # ----------------------------
        signal = self.transition_signal(prev_state, curr_state)

        # ----------------------------
        # 2. posture
        # ----------------------------
        if signal is None:
            signal = self.state_posture(row, curr_state)

        # ----------------------------
        # 3. kill weak signals
        # ----------------------------
        if signal in ["SHORT_TREND", "REVERSAL_SHORT"]:
            signal = "WAIT"

        if signal in ["RANGE", "EXIT_RANGE", "EXIT_TREND", "TREND_RESUME"]:
            signal = "WAIT"

        if signal in ["BREAKOUT"]:
            signal = "WAIT"

        # ----------------------------
        # 4. compute metrics
        # ----------------------------
        confidence = self.compute_confidence(prev_state, curr_state, persistence)
        strength = self.compute_strength(row)
        vol_adj = self.volatility_filter(row)

        # ----------------------------
        # 5. tighten REVERSAL_LONG
        # ----------------------------
        if signal == "REVERSAL_LONG":
            if persistence < 0.65 or strength < 0.55:
                signal = "WAIT"

        # ----------------------------
        # 6. sizing
        # ----------------------------
        size = self.compute_position_size(signal, confidence, strength, vol_adj)


        return signal, confidence, strength, vol_adj, size

    # =====================================================
    # APPLY
    # =====================================================
    def apply(self, df, hmm_model):

        if "hmm_state" not in df.columns:
            raise ValueError("Missing 'hmm_state' column")

        df = df.copy()

        states = df["hmm_state"].values
        persistence = np.diag(hmm_model.transmat_)

        signals, confidences, strengths, vol_adjs, sizes = [], [], [], [], []

        for i, curr_state in enumerate(states):

            row = df.iloc[i]
            prev_state = curr_state if i == 0 else states[i - 1]

            signal, conf, strg, vol, size = self.generate(
                row, prev_state, curr_state, persistence
            )

            signals.append(signal)
            confidences.append(conf)
            strengths.append(strg)
            vol_adjs.append(vol)
            sizes.append(size)


        df["signal"] = signals
        df["confidence"] = confidences
        df["strength"] = strengths
        df["vol_adj"] = vol_adjs
        df["position_size"] = sizes

        return df