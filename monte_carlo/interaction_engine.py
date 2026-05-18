import numpy as np


class InteractionEngine:

    def __init__(self):

        pass

    # =====================================================
    # MAIN INTERACTION ANALYSIS
    # =====================================================
    def evaluate(
        self,
        history_state,
        regime_state,
        current_state
    ):

        # =================================================
        # Historical State
        # =================================================
        local_volatility = history_state.get(
            "local_volatility",
            0.0
        )

        trend_strength = history_state.get(
            "trend_strength",
            0.0
        )

        flow_persistence = history_state.get(
            "flow_persistence",
            0.0
        )

        stability_score = history_state.get(
            "stability_score",
            1.0
        )

        # =================================================
        # Current State
        # =================================================
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

        flow = current_state.get(
            "flow",
            0.0
        )

        net_gex = current_state.get(
            "netGEX",
            0.0
        )

        distance_to_flip = current_state.get(
            "distance_to_flip",
            1.0
        )

        # =================================================
        # INTERACTION OUTPUTS
        # =================================================

        drift_multiplier = 1.0

        volatility_multiplier = 1.0

        momentum_multiplier = 1.0

        shock_multiplier = 1.0

        stability_multiplier = 1.0

        interaction_labels = []

        # =================================================
        # 1. LIQUIDITY PRESSURE
        # =================================================
        if (
            abs(imbalance) > 0.5
            and spread < 1.0
        ):

            drift_multiplier *= 1.3

            momentum_multiplier *= 1.2

            interaction_labels.append(
                "liquidity_pressure"
            )

        # =================================================
        # 2. SHORT GAMMA INSTABILITY
        # =================================================
        if (
            net_gex < 0
            and abs(imbalance) > 0.5
        ):

            volatility_multiplier *= 1.8

            momentum_multiplier *= 1.5

            stability_multiplier *= 0.6

            interaction_labels.append(
                "short_gamma_instability"
            )

        # =================================================
        # 3. LIQUIDITY COLLAPSE
        # =================================================
        if (
            spread > 1.5
            and iv > hv
        ):

            volatility_multiplier *= 2.0

            shock_multiplier *= 2.5

            stability_multiplier *= 0.5

            interaction_labels.append(
                "liquidity_collapse"
            )

        # =================================================
        # 4. GAMMA FLIP TRANSITION
        # =================================================
        if distance_to_flip < 0.03:

            volatility_multiplier *= 1.5

            shock_multiplier *= 1.8

            interaction_labels.append(
                "gamma_transition"
            )

        # =================================================
        # 5. VOLATILITY EXPANSION
        # =================================================
        if (
            iv > hv
            and local_volatility > 0.005
        ):

            volatility_multiplier *= 1.5

            interaction_labels.append(
                "volatility_expansion"
            )

        # =================================================
        # 6. STABLE DEALER ABSORPTION
        # =================================================
        if (
            net_gex > 0
            and spread < 0.8
            and stability_score > 0.8
        ):

            volatility_multiplier *= 0.7

            stability_multiplier *= 1.3

            interaction_labels.append(
                "dealer_absorption"
            )

        # =================================================
        # 7. TREND REINFORCEMENT
        # =================================================
        if (
            flow_persistence > 0.7
            and trend_strength > 0.5
        ):

            drift_multiplier *= 1.5

            momentum_multiplier *= 1.5

            interaction_labels.append(
                "trend_reinforcement"
            )

        # =================================================
        # 8. FLOW SATURATION
        # =================================================
        if (
            abs(flow) > 5
            and abs(imbalance) < 0.1
        ):

            stability_multiplier *= 1.5

            momentum_multiplier *= 0.7

            interaction_labels.append(
                "flow_saturation"
            )

        # =================================================
        # 9. HIDDEN INSTABILITY
        # =================================================
        if (
            local_volatility > 0.01
            and spread < 0.5
        ):

            shock_multiplier *= 1.5

            interaction_labels.append(
                "hidden_instability"
            )

        # =================================================
        # 10. REFLEXIVE INSTABILITY
        # =================================================
        if (
            net_gex < 0
            and iv > hv
            and flow_persistence > 0.7
        ):

            drift_multiplier *= 1.8

            volatility_multiplier *= 2.0

            momentum_multiplier *= 1.7

            stability_multiplier *= 0.5

            interaction_labels.append(
                "reflexive_instability"
            )

        # =================================================
        # REGULARIZATION
        # =================================================

        drift_multiplier = np.clip(
            drift_multiplier,
            0.5,
            3.0
        )

        volatility_multiplier = np.clip(
            volatility_multiplier,
            0.5,
            4.0
        )

        momentum_multiplier = np.clip(
            momentum_multiplier,
            0.5,
            3.0
        )

        shock_multiplier = np.clip(
            shock_multiplier,
            0.5,
            5.0
        )

        stability_multiplier = np.clip(
            stability_multiplier,
            0.2,
            2.0
        )

        # =================================================
        # OUTPUT
        # =================================================
        return {

            "drift_multiplier":
                drift_multiplier,

            "volatility_multiplier":
                volatility_multiplier,

            "momentum_multiplier":
                momentum_multiplier,

            "shock_multiplier":
                shock_multiplier,

            "stability_multiplier":
                stability_multiplier,

            "interaction_labels":
                interaction_labels
        }