import numpy as np


# =====================================================
# TRADE POLICY ENGINE
# =====================================================

class TradePolicy:

    # =================================================
    # INIT
    # =====================================================

    def __init__(

        self,

        long_threshold=0.002,

        short_threshold=-0.002,

        entropy_cutoff=2.8,

        min_confidence=0.25,

        min_persistence=3,
    ):

        self.long_threshold = (
            long_threshold
        )

        self.short_threshold = (
            short_threshold
        )

        self.entropy_cutoff = (
            entropy_cutoff
        )

        self.min_confidence = (
            min_confidence
        )

        self.min_persistence = (
            min_persistence
        )

    # =================================================
    # NORMALIZED ENTROPY
    # =====================================================

    def normalized_entropy(

        self,

        entropy,

        max_entropy=3.0
    ):

        return min(

            entropy / max_entropy,

            1.0
        )

    # =================================================
    # PERSISTENCE SCORE
    # =====================================================

    def persistence_score(

        self,

        dwell_time
    ):

        return np.tanh(

            dwell_time / 10.0
        )

    # =================================================
    # VOLATILITY PENALTY
    # =====================================================

    def volatility_penalty(

        self,

        hv
    ):

        return 1.0 / (

            1.0 + hv * 100
        )

    # =================================================
    # ENTROPY PENALTY
    # =====================================================

    def entropy_penalty(

        self,

        entropy
    ):

        h = self.normalized_entropy(
            entropy
        )

        return 1.0 - h

    # =================================================
    # TRANSITION STABILITY
    # =====================================================

    def transition_stability(

        self,

        trapping_score
    ):

        return np.tanh(

            trapping_score
        )

    # =================================================
    # TRADE SCORE
    # =====================================================

    def trade_score(

        self,

        state
    ):

        # ---------------------------------------------
        # CORE EDGE
        # ---------------------------------------------

        edge = (
            state.expected_return
        )

        # ---------------------------------------------
        # CONFIDENCE
        # ---------------------------------------------

        confidence = (
            state.confidence
        )

        # ---------------------------------------------
        # PERSISTENCE
        # ---------------------------------------------

        persistence = (
            self.persistence_score(

                state.dwell_time
            )
        )

        # ---------------------------------------------
        # ENTROPY
        # ---------------------------------------------

        entropy_penalty = (
            self.entropy_penalty(

                state.entropy
            )
        )

        # ---------------------------------------------
        # VOLATILITY
        # ---------------------------------------------

        hv_penalty = (
            self.volatility_penalty(

                state.HV
            )
        )

        # ---------------------------------------------
        # STABILITY
        # ---------------------------------------------

        stability = (
            self.transition_stability(

                state.trapping_score
            )
        )

        # ---------------------------------------------
        # FINAL SCORE
        # ---------------------------------------------

        score = (

            edge
            *
            confidence
            *
            persistence
            *
            entropy_penalty
            *
            hv_penalty
            *
            stability
        )

        return float(score)

    # =================================================
    # POSITION SIZE
    # =====================================================

    def position_size(

        self,

        state,

        max_size=1.0
    ):

        score = abs(

            self.trade_score(state)
        )

        size = min(

            score * 100,

            max_size
        )

        return float(size)

    # =================================================
    # RISK SCORE
    # =====================================================

    def risk_score(

        self,

        state
    ):

        risk = (

            state.entropy
            *
            (
                1.0 + state.HV * 50
            )
        )

        return float(risk)

    # =================================================
    # FILTERS
    # =====================================================

    def trade_allowed(

        self,

        state
    ):

        # ---------------------------------------------
        # ENTROPY FILTER
        # ---------------------------------------------

        if state.entropy > self.entropy_cutoff:

            return False

        # ---------------------------------------------
        # CONFIDENCE FILTER
        # ---------------------------------------------

        if state.confidence < self.min_confidence:

            return False

        # ---------------------------------------------
        # PERSISTENCE FILTER
        # ---------------------------------------------

        if state.dwell_time < self.min_persistence:

            return False

        return True

    # =================================================
    # ACTION
    # =====================================================

    def action(

        self,

        state
    ):

        # ---------------------------------------------
        # FILTER
        # ---------------------------------------------

        if not self.trade_allowed(
            state
        ):
            return {

                "action":
                    "NO_TRADE",

                "reason":
                    "FILTERED",

                "score":
                    0.0,

                "size":
                    0.0,

                "risk":
                    self.risk_score(
                        state
                    ),

                "confidence":
                    float(
                        state.confidence
                    ),

                "entropy":
                    float(
                        state.entropy
                    ),

                "expected_return":
                    float(
                        state.expected_return
                    ),

                "persistence":
                    float(
                        self.persistence_score(
                            state.dwell_time
                        )
                    ),

                "volatility_penalty":
                    float(
                        self.volatility_penalty(
                            state.HV
                        )
                    ),

                "entropy_penalty":
                    float(
                        self.entropy_penalty(
                            state.entropy
                        )
                    ),
            }

        # ---------------------------------------------
        # SCORE
        # ---------------------------------------------

        score = self.trade_score(
            state
        )

        # ---------------------------------------------
        # SIZE
        # ---------------------------------------------

        size = self.position_size(
            state
        )

        # ---------------------------------------------
        # LONG
        # ---------------------------------------------

        if score > self.long_threshold:

            action = "LONG"

        # ---------------------------------------------
        # SHORT
        # ---------------------------------------------

        elif score < self.short_threshold:

            action = "SHORT"

        # ---------------------------------------------
        # NEUTRAL
        # ---------------------------------------------

        else:

            action = "NO_TRADE"

        # ---------------------------------------------
        # RETURN
        # ---------------------------------------------

        return {

            "action":
                action,

            "score":
                float(score),

            "size":
                float(size),

            "risk":
                self.risk_score(
                    state
                ),

            "confidence":
                float(
                    state.confidence
                ),

            "entropy":
                float(
                    state.entropy
                ),

            "expected_return":
                float(
                    state.expected_return
                ),

            "persistence":
                float(
                    self.persistence_score(
                        state.dwell_time
                    )
                ),

            "volatility_penalty":
                float(
                    self.volatility_penalty(
                        state.HV
                    )
                ),

            "entropy_penalty":
                float(
                    self.entropy_penalty(
                        state.entropy
                    )
                ),
        }