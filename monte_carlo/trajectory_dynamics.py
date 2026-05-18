import numpy as np


class TrajectoryDynamics:

    def __init__(self):

        pass

    # =====================================================
    # MAIN DYNAMICS ESTIMATION
    # =====================================================
    def compute(
        self,
        history_state,
        regime_state,
        current_state
    ):

        regime = regime_state["regime"]

        # =================================================
        # Historical State
        # =================================================
        drift_bias = history_state.get(
            "drift_bias",
            0.0
        )

        local_volatility = history_state.get(
            "local_volatility",
            0.001
        )

        trend_strength = history_state.get(
            "trend_strength",
            0.0
        )

        stability_score = history_state.get(
            "stability_score",
            1.0
        )

        flow_persistence = history_state.get(
            "flow_persistence",
            0.0
        )

        # =================================================
        # Current State
        # =================================================
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

        imbalance = current_state.get(
            "imbalance",
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
        # NORMALIZED STATE VARIABLES
        # =================================================

        spread_factor = np.tanh(
            spread / 5
        )

        imbalance_factor = np.tanh(
            abs(imbalance)
        )

        iv_hv_ratio = iv / max(hv, 1e-6)

        iv_factor = np.tanh(
            iv_hv_ratio / 10
        )

        flip_factor = np.exp(
            -4 * distance_to_flip
        )

        # =================================================
        # BASE DRIFT
        # =================================================

        drift = (

            0.5 * drift_bias

            +

            0.25 * trend_strength

            +

            0.08 * imbalance

        )

        # =================================================
        # BASE VOLATILITY
        # =================================================

        base_volatility = (

            0.003

            +

            0.004 * local_volatility

            +

            0.002 * spread_factor

            +

            0.003 * iv_factor

            +

            0.002 * imbalance_factor

        )

        volatility = base_volatility

        # =================================================
        # REGIME CONDITIONING
        # =================================================

        # -------------------------------------------------
        # STABLE
        # -------------------------------------------------
        if regime == "stable":

            drift *= 0.4

            volatility *= 0.45

            momentum = 0.03

            shock_probability = 0.0005

            stability_strength = 1.2

        # -------------------------------------------------
        # MEAN REVERTING
        # -------------------------------------------------
        elif regime == "mean_reverting":

            drift *= 0.35

            volatility *= 0.65

            momentum = 0.02

            shock_probability = 0.001

            stability_strength = 1.0

        # -------------------------------------------------
        # TRENDING
        # -------------------------------------------------
        elif regime == "trending":

            drift *= 1.3

            volatility *= 1.2

            momentum = 0.12

            shock_probability = 0.003

            stability_strength = 0.5

        # -------------------------------------------------
        # VOLATILITY EXPANSION
        # -------------------------------------------------
        elif regime == "volatility_expansion":

            drift *= 0.8

            volatility *= 1.5

            momentum = 0.08

            shock_probability = 0.008

            stability_strength = 0.35

        # -------------------------------------------------
        # REFLEXIVE INSTABILITY
        # -------------------------------------------------
        elif regime == "reflexive_instability":

            drift *= 1.5

            volatility *= 1.8

            momentum = 0.15

            shock_probability = 0.015

            stability_strength = 0.25

        # -------------------------------------------------
        # GAMMA SQUEEZE
        # -------------------------------------------------
        elif regime == "gamma_squeeze":

            drift *= 2.0

            volatility *= 1.7

            momentum = 0.18

            shock_probability = 0.01

            stability_strength = 0.15

        # -------------------------------------------------
        # LIQUIDITY COLLAPSE
        # -------------------------------------------------
        elif regime == "liquidity_collapse":

            drift *= 0.6

            volatility *= 2.0

            momentum = 0.04

            shock_probability = 0.02

            stability_strength = 0.08

        # -------------------------------------------------
        # TRANSITION
        # -------------------------------------------------
        elif regime == "transition":

            drift *= 1.0

            volatility *= 1.3

            momentum = 0.06

            shock_probability = 0.005

            stability_strength = 0.45

        # -------------------------------------------------
        # NEUTRAL
        # -------------------------------------------------
        else:

            momentum = 0.05

            shock_probability = 0.002

            stability_strength = 0.6

        # =================================================
        # GAMMA FLIP ADAPTATION
        # =================================================

        volatility *= (
            1 +
            0.8 * flip_factor
        )

        momentum *= (
            1 +
            0.5 * flip_factor
        )

        # =================================================
        # FLOW PERSISTENCE EFFECT
        # =================================================

        volatility *= (
            1 +
            0.3 * abs(flow_persistence)
        )

        # =================================================
        # STABILITY SUPPRESSION
        # =================================================

        volatility *= (
            1 -
            0.4 * stability_score
        )

        # =================================================
        # SOFT VOLATILITY SATURATION
        # =================================================

        volatility = (

            0.03 *

            np.tanh(
                volatility / 0.03
            )

        )

        volatility = np.clip(
            volatility,
            0.0005,
            0.02
        )

        # =================================================
        # DRIFT REGULARIZATION
        # =================================================

        drift = np.clip(
            drift,
            -0.01,
            0.01
        )

        # =================================================
        # MOMENTUM REGULARIZATION
        # =================================================

        momentum = np.clip(
            momentum,
            0.0,
            0.2
        )

        # =================================================
        # SHOCK REGULARIZATION
        # =================================================

        shock_probability = np.clip(
            shock_probability,
            0.0001,
            0.03
        )

        # =================================================
        # OUTPUT
        # =================================================

        return {

            "drift":
                drift,

            "volatility":
                volatility,

            "momentum":
                momentum,

            "shock_probability":
                shock_probability,

            "stability_strength":
                stability_strength
        }