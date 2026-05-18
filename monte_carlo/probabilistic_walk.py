import numpy as np


class ProbabilisticWalk:

    def __init__(self):

        pass

    # =====================================================
    # MAIN RETURN GENERATION
    # =====================================================
    def generate_return(
        self,
        base_return,
        dynamics_state,
        interaction_state,
        regime_state,
        distance_factor
    ):

        # =================================================
        # BASE RETURN
        # =================================================
        ret = float(base_return)

        # =================================================
        # DYNAMICS STATE
        # =================================================
        adaptive_drift = dynamics_state[
            "drift"
        ]

        adaptive_volatility = dynamics_state[
            "volatility"
        ]

        adaptive_momentum = dynamics_state[
            "momentum"
        ]

        adaptive_shock_prob = dynamics_state[
            "shock_probability"
        ]

        stability_strength = dynamics_state[
            "stability_strength"
        ]

        # =================================================
        # INTERACTION STATE
        # =================================================
        drift_multiplier = interaction_state[
            "drift_multiplier"
        ]

        volatility_multiplier = interaction_state[
            "volatility_multiplier"
        ]

        momentum_multiplier = interaction_state[
            "momentum_multiplier"
        ]

        shock_multiplier = interaction_state[
            "shock_multiplier"
        ]

        stability_multiplier = interaction_state[
            "stability_multiplier"
        ]

        # =================================================
        # REGIME STATE
        # =================================================
        regime = regime_state["regime"]

        # =================================================
        # 1. ADAPTIVE DRIFT
        # =================================================
        drift_component = (
            adaptive_drift *
            drift_multiplier
        )

        # =================================================
        # 2. STOCHASTIC UNCERTAINTY
        # =================================================
        stochastic_component = np.random.normal(
            0,
            adaptive_volatility *
            np.sqrt(volatility_multiplier)
        )

        # =================================================
        # 3. MOMENTUM COMPONENT
        # =================================================
        momentum_decay = np.exp(
            -5 * distance_factor
        )

        momentum_component = (
            adaptive_momentum *
            momentum_multiplier *
            ret *
            momentum_decay
        )

        # =================================================
        # 4. STABILITY FORCE
        # =================================================
        stability_component = (
            -stability_strength *
            stability_multiplier *
            np.tanh(
                3 * distance_factor
            )
        )

        # =================================================
        # 5. SHOCK COMPONENT
        # =================================================
        shock_component = 0.0

        shock_probability = (
            adaptive_shock_prob *
            shock_multiplier
        )

        shock_probability = np.clip(
            shock_probability,
            0.0001,
            0.1
        )

        if np.random.rand() < shock_probability:
            shock_scale = (
                    adaptive_volatility *
                    np.sqrt(volatility_multiplier) *
                    2
            )

            shock_component = np.random.normal(
                0,
                shock_scale
            )

        # =================================================
        # 6. REGIME ADJUSTMENTS
        # =================================================

        # ---------------------------------------------
        # STABLE REGIME
        # ---------------------------------------------
        if regime == "stable":

            stochastic_component *= 0.7

            momentum_component *= 0.5

        # ---------------------------------------------
        # MEAN REVERTING
        # ---------------------------------------------
        elif regime == "mean_reverting":

            momentum_component *= 0.3

            stability_component *= 1.5

        # ---------------------------------------------
        # TRENDING
        # ---------------------------------------------
        elif regime == "trending":

            momentum_component *= 1.5

        # ---------------------------------------------
        # REFLEXIVE INSTABILITY
        # ---------------------------------------------
        elif regime == "reflexive_instability":

            stochastic_component *= 1.5

            shock_component *= 1.5

        # ---------------------------------------------
        # GAMMA SQUEEZE
        # ---------------------------------------------
        elif regime == "gamma_squeeze":

            drift_component *= 1.5

            momentum_component *= 2.0

        # ---------------------------------------------
        # LIQUIDITY COLLAPSE
        # ---------------------------------------------
        elif regime == "liquidity_collapse":

            stochastic_component *= 2.0

            shock_component *= 2.0

        # =================================================
        # 7. FINAL RETURN
        # =================================================
        final_return = (
            ret
            +
            drift_component
            +
            stochastic_component
            +
            momentum_component
            +
            stability_component
            +
            shock_component
        )

        # =================================================
        # 8. FINAL REGULARIZATION
        # =================================================
        final_return = np.clip(
            final_return,
            -0.03,
            0.03
        )

        if not np.isfinite(final_return):

            final_return = 0.0

        # =================================================
        # OUTPUT
        # =================================================
        return {

            "return": final_return,

            "components": {

                "drift":
                    drift_component,

                "stochastic":
                    stochastic_component,

                "momentum":
                    momentum_component,

                "stability":
                    stability_component,

                "shock":
                    shock_component
            }
        }