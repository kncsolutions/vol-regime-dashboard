import numpy as np


class PersistenceEngine:

    def __init__(self):

        # ============================================
        # Regime Tracking
        # ============================================
        self.current_regime = None

        self.regime_duration = 0

        # ============================================
        # Historical Persistence Memory
        # ============================================
        self.persistence_score = 0.5

    # =================================================
    # UPDATE PERSISTENCE STATE
    # =================================================
    def update(
        self,
        regime_state,
        interaction_state,
        history_state
    ):

        regime = regime_state["regime"]

        # =================================================
        # 1. Regime Duration Tracking
        # =================================================
        if regime == self.current_regime:

            self.regime_duration += 1

        else:

            self.current_regime = regime

            self.regime_duration = 1

        # =================================================
        # 2. Historical State Inputs
        # =================================================
        stability_score = history_state.get(
            "stability_score",
            1.0
        )

        local_volatility = history_state.get(
            "local_volatility",
            0.0
        )

        flow_persistence = history_state.get(
            "flow_persistence",
            0.0
        )

        # =================================================
        # 3. Interaction State
        # =================================================
        interaction_labels = interaction_state.get(
            "interaction_labels",
            []
        )

        instability_pressure = 0.0

        # ---------------------------------------------
        # Instability Amplifiers
        # ---------------------------------------------
        if (
            "short_gamma_instability"
            in interaction_labels
        ):

            instability_pressure += 0.25

        if (
            "liquidity_collapse"
            in interaction_labels
        ):

            instability_pressure += 0.35

        if (
            "reflexive_instability"
            in interaction_labels
        ):

            instability_pressure += 0.45

        # ---------------------------------------------
        # Stabilization
        # ---------------------------------------------
        if (
            "dealer_absorption"
            in interaction_labels
        ):

            instability_pressure -= 0.25

        instability_pressure = np.clip(
            instability_pressure,
            -0.5,
            1.0
        )

        # =================================================
        # 4. Duration Persistence
        # =================================================

        # Faster saturation than before
        duration_factor = np.tanh(
            self.regime_duration / 20
        )

        # =================================================
        # 5. Persistence Fatigue
        # =================================================

        # prolonged occupancy eventually weakens persistence
        fatigue = np.tanh(
            self.regime_duration / 100
        )

        # =================================================
        # 6. Persistence Construction
        # =================================================
        persistence = (

            0.30 * duration_factor

            +

            0.25 * flow_persistence

            +

            0.15 * stability_score

            +

            0.10 * local_volatility

            +

            instability_pressure

        )

        # ---------------------------------------------
        # Fatigue Decay
        # ---------------------------------------------
        persistence -= (
            0.20 * fatigue
        )

        # =================================================
        # 7. Persistence Smoothing
        # =================================================

        persistence = (

            0.85 * self.persistence_score

            +

            0.15 * persistence

        )

        # =================================================
        # 8. Numerical Safety
        # =================================================
        persistence = np.clip(
            persistence,
            0.0,
            1.0
        )

        self.persistence_score = persistence

        # =================================================
        # 9. Regime Stickiness
        # =================================================

        # softer stickiness range
        regime_stickiness = (

            0.35

            +

            0.40 * persistence

        )

        regime_stickiness = np.clip(
            regime_stickiness,
            0.35,
            0.75
        )

        # =================================================
        # 10. Transition Resistance
        # =================================================

        transition_resistance = (

            regime_stickiness

            *

            np.exp(
                -2.5 * instability_pressure
            )
        )

        transition_resistance = np.clip(
            transition_resistance,
            0.05,
            0.85
        )

        # =================================================
        # 11. Metastability Index
        # =================================================

        metastability_index = (

            persistence

            *

            regime_stickiness

            *

            (
                1 -
                instability_pressure
            )
        )

        metastability_index = np.clip(
            metastability_index,
            0.0,
            1.0
        )

        # =================================================
        # 12. Persistence Decay Pressure
        # =================================================

        persistence_decay_pressure = (

            fatigue

            *

            instability_pressure

        )

        persistence_decay_pressure = np.clip(
            persistence_decay_pressure,
            0.0,
            1.0
        )

        # =================================================
        # 13. Output
        # =================================================
        return {

            "current_regime":
                self.current_regime,

            "regime_duration":
                self.regime_duration,

            "persistence_score":
                persistence,

            "regime_stickiness":
                regime_stickiness,

            "transition_resistance":
                transition_resistance,

            "instability_pressure":
                instability_pressure,

            "fatigue":
                fatigue,

            "metastability_index":
                metastability_index,

            "persistence_decay_pressure":
                persistence_decay_pressure
        }