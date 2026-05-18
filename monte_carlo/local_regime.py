import numpy as np


class LocalRegimeDetector:

    def __init__(self):

        pass

    # =====================================================
    # MAIN REGIME DETECTION
    # =====================================================
    def detect(
        self,
        history_state,
        current_state
    ):

        # ---------------------------------------------
        # Historical Features
        # ---------------------------------------------
        drift_bias = history_state[
            "drift_bias"
        ]

        local_volatility = history_state[
            "local_volatility"
        ]

        trend_strength = history_state[
            "trend_strength"
        ]

        stability_score = history_state[
            "stability_score"
        ]

        flow_persistence = history_state[
            "flow_persistence"
        ]

        # ---------------------------------------------
        # Current Features
        # ---------------------------------------------
        imbalance = current_state.get(
            "imbalance",
            0.0
        )

        spread = current_state.get(
            "spread",
            0.0
        )

        iv = current_state.get(
            "IV",
            0.0
        )

        hv = current_state.get(
            "HV",
            0.0
        )

        net_gex = current_state.get(
            "netGEX",
            0.0
        )

        distance_to_flip = current_state.get(
            "distance_to_flip",
            0.0
        )

        flow = current_state.get(
            "flow",
            0.0
        )

        # =================================================
        # REGIME RULES
        # =================================================

        # -------------------------------------------------
        # 1. STABLE DEALER REGIME
        # -------------------------------------------------
        if (
            net_gex > 0
            and spread < 1.0
            and local_volatility < 0.005
            and stability_score > 0.8
        ):

            return {
                "regime": "stable",
                "score": 0.9
            }

        # -------------------------------------------------
        # 2. REFLEXIVE INSTABILITY
        # -------------------------------------------------
        if (
            net_gex < 0
            and abs(imbalance) > 0.5
            and flow_persistence > 0.7
            and local_volatility > 0.01
        ):

            return {
                "regime": "reflexive_instability",
                "score": 0.85
            }

        # -------------------------------------------------
        # 3. VOLATILITY EXPANSION
        # -------------------------------------------------
        if (
            iv > hv
            and local_volatility > 0.008
            and spread > 0.5
        ):

            return {
                "regime": "volatility_expansion",
                "score": 0.8
            }

        # -------------------------------------------------
        # 4. LIQUIDITY COLLAPSE
        # -------------------------------------------------
        if (
            spread > 1.5
            and abs(flow) < 0.1
            and local_volatility > 0.01
        ):

            return {
                "regime": "liquidity_collapse",
                "score": 0.95
            }

        # -------------------------------------------------
        # 5. GAMMA SQUEEZE
        # -------------------------------------------------
        if (
            net_gex < 0
            and distance_to_flip < 0.03
            and drift_bias > 0
            and trend_strength > 0.5
        ):

            return {
                "regime": "gamma_squeeze",
                "score": 0.9
            }

        # -------------------------------------------------
        # 6. MEAN REVERSION
        # -------------------------------------------------
        if (
            stability_score > 0.85
            and abs(drift_bias) < 0.001
            and local_volatility < 0.004
        ):

            return {
                "regime": "mean_reverting",
                "score": 0.75
            }

        # -------------------------------------------------
        # 7. TRENDING
        # -------------------------------------------------
        if (
            flow_persistence > 0.75
            and abs(drift_bias) > 0.001
            and spread < 1.0
        ):

            return {
                "regime": "trending",
                "score": 0.8
            }

        # -------------------------------------------------
        # 8. TRANSITION
        # -------------------------------------------------
        if (
            distance_to_flip < 0.05
            and iv > hv
        ):

            return {
                "regime": "transition",
                "score": 0.7
            }

        # -------------------------------------------------
        # DEFAULT
        # -------------------------------------------------
        return {
            "regime": "neutral",
            "score": 0.5
        }