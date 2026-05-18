import numpy as np


class StateTransitionMatrix:

    def __init__(self):

        # ============================================
        # Supported Regimes
        # ============================================
        self.regimes = [

            "neutral",

            "stable",

            "mean_reverting",

            "trending",

            "volatility_expansion",

            "reflexive_instability",

            "gamma_squeeze",

            "liquidity_collapse",

            "transition"
        ]

    # =================================================
    # MAIN TRANSITION ESTIMATION
    # =================================================
    def compute(
        self,
        regime_state,
        persistence_state,
        latent_pressure_state,
        interaction_state,
        participant_state
    ):

        # =================================================
        # CURRENT REGIME
        # =================================================
        current_regime = regime_state.get(
            "regime",
            "neutral"
        )

        # safety fallback
        if current_regime not in self.regimes:

            current_regime = "neutral"

        # =================================================
        # PERSISTENCE STATE
        # =================================================
        persistence_score = (
            persistence_state.get(
                "persistence_score",
                0.5
            )
        )

        regime_stickiness = (
            persistence_state.get(
                "regime_stickiness",
                0.5
            )
        )

        transition_resistance = (
            persistence_state.get(
                "transition_resistance",
                0.5
            )
        )

        # =================================================
        # LATENT PRESSURE STATE
        # =================================================
        latent_pressure = (
            latent_pressure_state.get(
                "latent_pressure",
                0.0
            )
        )

        instability_risk = (
            latent_pressure_state.get(
                "instability_risk",
                0.0
            )
        )

        # =================================================
        # INTERACTION STATE
        # =================================================
        interaction_labels = (
            interaction_state.get(
                "interaction_labels",
                []
            )
        )

        # =================================================
        # PARTICIPANT STATE
        # =================================================
        dealer_stabilization = (
            participant_state.get(
                "dealer_stabilization",
                0.0
            )
        )

        liquidity_support = (
            participant_state.get(
                "liquidity_support",
                1.0
            )
        )

        panic_level = (
            participant_state.get(
                "panic_level",
                0.0
            )
        )

        reflexivity_index = (
            participant_state.get(
                "reflexivity_index",
                0.0
            )
        )

        # =================================================
        # INITIAL PROBABILITIES
        # =================================================
        probs = {

            regime: 0.01
            for regime in self.regimes
        }

        # =================================================
        # BASE PERSISTENCE
        # =================================================
        probs[current_regime] += (

            0.35

            +

            0.45 * regime_stickiness

        )

        # =================================================
        # INSTABILITY FACTOR
        # =================================================
        instability_factor = np.tanh(
            latent_pressure / 2
        )

        # =================================================
        # LOW PRESSURE STABILITY
        # =================================================
        if latent_pressure < 0.3:

            probs["neutral"] += 0.10

            probs["stable"] += 0.15

            probs["mean_reverting"] += 0.12

        # =================================================
        # MODERATE PRESSURE
        # =================================================
        elif latent_pressure < 1.0:

            probs["transition"] += 0.10

            probs["trending"] += 0.08

            probs["volatility_expansion"] += 0.05

        # =================================================
        # HIGH PRESSURE
        # =================================================
        else:

            probs["volatility_expansion"] += (

                0.15 *
                instability_factor

            )

            probs["reflexive_instability"] += (

                0.20 *
                instability_factor

            )

            probs["transition"] += (

                0.12 *
                instability_factor

            )

        # =================================================
        # INTERACTION EFFECTS
        # =================================================

        # ---------------------------------------------
        # SHORT GAMMA
        # ---------------------------------------------
        if (
            "short_gamma_instability"
            in interaction_labels
        ):

            probs[
                "reflexive_instability"
            ] += 0.12

            probs[
                "gamma_squeeze"
            ] += 0.08

        # ---------------------------------------------
        # LIQUIDITY COLLAPSE
        # ---------------------------------------------
        if (
            "liquidity_collapse"
            in interaction_labels
        ):

            probs[
                "liquidity_collapse"
            ] += 0.18

            probs[
                "volatility_expansion"
            ] += 0.10

        # ---------------------------------------------
        # DEALER ABSORPTION
        # ---------------------------------------------
        if (
            "dealer_absorption"
            in interaction_labels
        ):

            probs[
                "stable"
            ] += 0.18

            probs[
                "mean_reverting"
            ] += 0.12

        # ---------------------------------------------
        # LIQUIDITY PRESSURE
        # ---------------------------------------------
        if (
            "liquidity_pressure"
            in interaction_labels
        ):

            probs[
                "trending"
            ] += 0.08

        # =================================================
        # PARTICIPANT ECOLOGY EFFECTS
        # =================================================

        # ---------------------------------------------
        # Panic Amplification
        # ---------------------------------------------
        probs["transition"] += (
            0.05 * panic_level
        )

        probs["volatility_expansion"] += (
            0.08 * panic_level
        )

        # ---------------------------------------------
        # Reflexive Instability
        # ---------------------------------------------
        probs["reflexive_instability"] += (
            0.06 * reflexivity_index
        )

        # ---------------------------------------------
        # Dealer Stabilization
        # ---------------------------------------------
        if dealer_stabilization > 0.8:

            probs["stable"] += 0.10

            probs["mean_reverting"] += 0.08

        # ---------------------------------------------
        # Liquidity Support
        # ---------------------------------------------
        if liquidity_support > 1.0:

            probs["stable"] += 0.08

            probs["neutral"] += 0.05

        # =================================================
        # TRANSITION RESISTANCE
        # =================================================
        for regime in self.regimes:

            if regime != current_regime:

                probs[regime] *= (

                    1

                    -

                    0.4 *

                    transition_resistance

                )

        # =================================================
        # NUMERICAL SAFETY
        # =================================================
        for regime in probs:

            probs[regime] = max(
                probs[regime],
                1e-6
            )

        # =================================================
        # NORMALIZATION
        # =================================================
        total_prob = sum(
            probs.values()
        )

        for regime in probs:

            probs[regime] /= total_prob

        # =================================================
        # SAMPLE NEXT REGIME
        # =================================================
        next_regime = np.random.choice(

            self.regimes,

            p=[
                probs[r]
                for r in self.regimes
            ]
        )

        # =================================================
        # TRANSITION ENTROPY
        # =================================================
        entropy = -sum(

            p * np.log(p + 1e-12)

            for p in probs.values()

        )

        entropy /= np.log(
            len(self.regimes)
        )

        entropy = np.clip(
            entropy,
            0.0,
            1.0
        )

        # =================================================
        # ENTROPY STABILIZATION
        # =================================================
        if dealer_stabilization > 0.8:

            entropy *= 0.85

        if liquidity_support > 1.0:

            entropy *= 0.90

        entropy = np.clip(
            entropy,
            0.0,
            1.0
        )

        # =================================================
        # OUTPUT
        # =================================================
        return {

            "current_regime":
                current_regime,

            "next_regime":
                next_regime,

            "transition_probabilities":
                probs,

            "transition_entropy":
                entropy
        }