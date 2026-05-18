import numpy as np


class LatentPressureEngine:

    def __init__(self):

        # ============================================
        # Persistent Hidden Pressure
        # ============================================
        self.latent_pressure = 0.0

        # ============================================
        # Smoothed Historical Pressure
        # ============================================
        self.pressure_velocity = 0.0

    # =================================================
    # UPDATE LATENT PRESSURE
    # =================================================
    def update(
        self,
        history_state,
        regime_state,
        interaction_state,
        persistence_state,
        current_state
    ):

        # =============================================
        # Historical State
        # =============================================
        local_volatility = history_state.get(
            "local_volatility",
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

        # =============================================
        # Regime State
        # =============================================
        regime = regime_state.get(
            "regime",
            "neutral"
        )

        # =============================================
        # Interaction State
        # =============================================
        interaction_labels = interaction_state.get(
            "interaction_labels",
            []
        )

        # =============================================
        # Persistence State
        # =============================================
        persistence_score = persistence_state.get(
            "persistence_score",
            0.5
        )

        instability_pressure = persistence_state.get(
            "instability_pressure",
            0.0
        )

        regime_duration = persistence_state.get(
            "regime_duration",
            1
        )

        # =============================================
        # Current State
        # =============================================
        spread = current_state.get(
            "spread",
            0.0
        )

        imbalance = current_state.get(
            "imbalance",
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

        distance_to_flip = current_state.get(
            "distance_to_flip",
            1.0
        )

        # =================================================
        # BASE PRESSURE BUILDUP
        # =================================================

        pressure_build = 0.0

        # =============================================
        # Volatility Compression
        # =============================================
        if (
            local_volatility < 0.003
            and iv > hv
        ):

            pressure_build += 0.15

        # =============================================
        # Persistent Imbalance
        # =============================================
        if (
            abs(imbalance) > 0.5
            and flow_persistence > 0.7
        ):

            pressure_build += 0.2

        # =============================================
        # Near Gamma Flip
        # =============================================
        if distance_to_flip < 0.03:

            pressure_build += 0.25

        # =============================================
        # Spread Compression
        # =============================================
        if (
            spread < 0.5
            and local_volatility < 0.005
        ):

            pressure_build += 0.1

        # =============================================
        # Instability Interactions
        # =============================================
        if (
            "short_gamma_instability"
            in interaction_labels
        ):

            pressure_build += 0.3

        if (
            "liquidity_collapse"
            in interaction_labels
        ):

            pressure_build += 0.4

        if (
            "reflexive_instability"
            in interaction_labels
        ):

            pressure_build += 0.5

        # =============================================
        # Persistence Amplification
        # =============================================
        pressure_build *= (
            1 +
            persistence_score
        )

        # =============================================
        # Duration Amplification
        # =============================================
        duration_factor = np.tanh(
            regime_duration / 100
        )

        pressure_build *= (
            1 +
            duration_factor
        )

        # =================================================
        # PRESSURE RELEASE
        # =================================================

        pressure_release = 0.0

        # =============================================
        # Stable Absorption
        # =============================================
        if regime in [
            "stable",
            "mean_reverting"
        ]:

            pressure_release += (
                0.15 *
                stability_score
            )

        # =============================================
        # Dealer Absorption
        # =============================================
        if (
            "dealer_absorption"
            in interaction_labels
        ):

            pressure_release += 0.2

        # =============================================
        # Volatility Expansion Release
        # =============================================
        if regime in [
            "volatility_expansion",
            "gamma_squeeze"
        ]:

            pressure_release += 0.3

        # =================================================
        # PRESSURE VELOCITY
        # =================================================

        delta_pressure = (
            pressure_build
            -
            pressure_release
        )

        self.pressure_velocity = (
            0.9 *
            self.pressure_velocity
            +
            0.1 *
            delta_pressure
        )

        # =================================================
        # LATENT PRESSURE UPDATE
        # =================================================

        self.latent_pressure += (
            self.pressure_velocity
        )

        # =================================================
        # REGULARIZATION
        # =================================================

        self.latent_pressure = np.clip(
            self.latent_pressure,
            0.0,
            5.0
        )

        # =================================================
        # PRESSURE REGIME
        # =================================================

        if self.latent_pressure < 0.5:

            pressure_regime = "calm"

        elif self.latent_pressure < 1.5:

            pressure_regime = "compressed"

        elif self.latent_pressure < 3.0:

            pressure_regime = "stressed"

        else:

            pressure_regime = "critical"

        # =================================================
        # INSTABILITY RISK
        # =================================================

        instability_risk = np.tanh(
            self.latent_pressure / 2
        )

        # =================================================
        # OUTPUT
        # =================================================
        return {

            "latent_pressure":
                self.latent_pressure,

            "pressure_velocity":
                self.pressure_velocity,

            "pressure_regime":
                pressure_regime,

            "instability_risk":
                instability_risk,

            "pressure_build":
                pressure_build,

            "pressure_release":
                pressure_release
        }