import numpy as np


class ParticipantResponse:

    def __init__(self):

        # ============================================
        # Behavioral Memory
        # ============================================
        self.panic_memory = 0.0

        self.trend_memory = 0.0

        self.liquidity_memory = 1.0

    # =================================================
    # MAIN PARTICIPANT RESPONSE
    # =================================================
    def evaluate(
        self,
        current_state,
        regime_state,
        interaction_state,
        latent_pressure_state,
        persistence_state,
        transition_state
    ):

        # =================================================
        # CURRENT STATE
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

        net_gex = current_state.get(
            "netGEX",
            0.0
        )

        distance_to_flip = current_state.get(
            "distance_to_flip",
            1.0
        )

        # =================================================
        # REGIME STATE
        # =================================================
        regime = regime_state.get(
            "regime",
            "neutral"
        )

        regime_score = regime_state.get(
            "score",
            0.5
        )

        # =================================================
        # INTERACTIONS
        # =================================================
        interaction_labels = (
            interaction_state.get(
                "interaction_labels",
                []
            )
        )

        # =================================================
        # LATENT PRESSURE
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
        # PERSISTENCE
        # =================================================
        persistence_score = (
            persistence_state.get(
                "persistence_score",
                0.0
            )
        )

        # =================================================
        # TRANSITION STATE
        # =================================================
        transition_entropy = (
            transition_state.get(
                "transition_entropy",
                0.5
            )
        )

        next_regime = (
            transition_state.get(
                "next_regime",
                regime
            )
        )

        # =================================================
        # RISK APPETITE
        # =================================================

        risk_appetite = (

            1.0

            -

            0.4 * instability_risk

            -

            0.2 * transition_entropy

        )

        if regime in [
            "stable",
            "mean_reverting"
        ]:

            risk_appetite += 0.15

        if (
            "dealer_absorption"
            in interaction_labels
        ):

            risk_appetite += 0.15

        risk_appetite = np.clip(
            risk_appetite,
            0.0,
            1.5
        )

        # =================================================
        # PANIC RESPONSE
        # =================================================

        panic_build = (

            0.3 * instability_risk

            +

            0.2 * transition_entropy

            +

            0.15 * abs(imbalance)

        )

        if (
            "liquidity_collapse"
            in interaction_labels
        ):

            panic_build += 0.4

        if (
            "short_gamma_instability"
            in interaction_labels
        ):

            panic_build += 0.25

        # smoothed panic memory
        self.panic_memory = (

            0.9 * self.panic_memory

            +

            0.1 * panic_build

        )

        panic_level = np.clip(
            self.panic_memory,
            0.0,
            2.0
        )

        # =================================================
        # TREND FOLLOWING
        # =================================================

        trend_signal = (

            0.2 * abs(imbalance)

            +

            0.2 * persistence_score

        )

        if regime in [
            "trending",
            "gamma_squeeze"
        ]:

            trend_signal += 0.3

        self.trend_memory = (

            0.85 * self.trend_memory

            +

            0.15 * trend_signal

        )

        trend_following = np.clip(
            self.trend_memory,
            0.0,
            2.0
        )

        # =================================================
        # LIQUIDITY PROVISION
        # =================================================

        liquidity_support = (

            1.0

            -

            0.5 * panic_level

            -

            0.3 * spread

        )

        if (
            "dealer_absorption"
            in interaction_labels
        ):

            liquidity_support += 0.4

        if regime == "stable":

            liquidity_support += 0.2

        self.liquidity_memory = (

            0.9 * self.liquidity_memory

            +

            0.1 * liquidity_support

        )

        liquidity_support = np.clip(
            self.liquidity_memory,
            0.0,
            2.0
        )

        # =================================================
        # HEDGING PRESSURE
        # =================================================

        hedging_pressure = (

            np.exp(
                -4 * distance_to_flip
            )

            *

            (1 + instability_risk)

        )

        if net_gex < 0:

            hedging_pressure *= 1.4

        hedging_pressure = np.clip(
            hedging_pressure,
            0.0,
            3.0
        )

        # =================================================
        # DEALER STABILIZATION
        # =================================================

        dealer_stabilization = (

            max(net_gex, 0)

            /

            (
                abs(net_gex)
                +
                1e-6
            )

        )

        dealer_stabilization *= (
            liquidity_support
        )

        dealer_stabilization = np.clip(
            dealer_stabilization,
            0.0,
            2.0
        )

        # =================================================
        # REFLEXIVITY INDEX
        # =================================================

        reflexivity_index = (

            trend_following

            *

            (1 + panic_level)

            /

            (1 + dealer_stabilization)

        )

        reflexivity_index = np.clip(
            reflexivity_index,
            0.0,
            5.0
        )

        # =================================================
        # BEHAVIORAL REGIME
        # =================================================

        if reflexivity_index < 0.5:

            behavioral_regime = "anchored"

        elif reflexivity_index < 1.2:

            behavioral_regime = "adaptive"

        elif reflexivity_index < 2.5:

            behavioral_regime = "reflexive"

        else:

            behavioral_regime = "panic_reflexive"

        # =================================================
        # OUTPUT
        # =================================================
        return {

            "risk_appetite":
                risk_appetite,

            "panic_level":
                panic_level,

            "trend_following":
                trend_following,

            "liquidity_support":
                liquidity_support,

            "hedging_pressure":
                hedging_pressure,

            "dealer_stabilization":
                dealer_stabilization,

            "reflexivity_index":
                reflexivity_index,

            "behavioral_regime":
                behavioral_regime
        }