from market_engine.online.online_cluster import (
    OnlineClusterEngine
)

from market_engine.online.online_forecaster import (
    OnlineForecaster
)

from market_engine.online.state_tracker import (
    StateTracker
)
from market_engine.online.signal_generator import (
    SignalGenerator
)
from market_engine.storage.regime_store import (
    RegimeStore
)
from market_engine.policy.trade_policy import (
    TradePolicy
)
# =====================================================
# INFERENCE PIPELINE
# =====================================================

class InferencePipeline:

    # =================================================
    # INIT
    # =================================================

    def __init__(self):

        # ---------------------------------------------
        # ONLINE CLUSTER ENGINE
        # ---------------------------------------------

        self.cluster_engine = (
            OnlineClusterEngine()
        )

        # ---------------------------------------------
        # FORECAST ENGINE
        # ---------------------------------------------

        self.forecaster = (
            OnlineForecaster()
        )

        self.trackers = {}
        self.signal_generator = (
            SignalGenerator()
        )

        self.regime_store = (
            RegimeStore()
        )
        self.trade_policy = (
            TradePolicy()
        )

    # =================================================
    # PROCESS
    # =================================================

    def process(

        self,

        state
    ):

        # ---------------------------------------------
        # CLUSTER ASSIGNMENT
        # ---------------------------------------------

        cluster = self.cluster_engine.predict(
            state
        )

        # ---------------------------------------------
        # STORE CLUSTER
        # ---------------------------------------------

        state.cluster = cluster

        # ---------------------------------------------
        # FORECAST
        # ---------------------------------------------

        forecast = self.forecaster.signal(
            cluster
        )

        # ---------------------------------------------
        # STATE TRACKER
        # ---------------------------------------------

        symbol = state.symbol

        if symbol not in self.trackers:
            self.trackers[symbol] = (
                StateTracker()
            )

        tracker = self.trackers[symbol]

        tracking = tracker.update(

            cluster,

            forecast["entropy"]
        )
        # ---------------------------------------------
        # SEMANTIC SIGNAL
        # ---------------------------------------------

        semantic_signal = \
            self.signal_generator.generate(
                state
            )

        state.semantic_signal = (
            semantic_signal
        )

        # ---------------------------------------------
        # STORE FORECAST
        # ---------------------------------------------

        state.expected_return = forecast[
            "expected_return"
        ]

        state.confidence = forecast[
            "confidence"
        ]

        state.forecast_score = forecast[
            "forecast_score"
        ]

        state.entropy = forecast[
            "entropy"
        ]

        state.signal = forecast[
            "signal"
        ]

        state.next_state_probs = forecast[
            "next_state_probs"
        ]

        state.dwell_time = tracking[
            "dwell_time"
        ]

        state.transition_count = tracking[
            "transition_count"
        ]

        state.previous_cluster = tracking[
            "previous_cluster"
        ]

        state.entropy_trend = tracking[
            "entropy_trend"
        ]

        state.metastable = tracking[
            "metastable"
        ]

        state.unstable = tracking[
            "unstable"
        ]

        state.trapping_score = tracking[
            "trapping_score"
        ]

        # ---------------------------------------------
        # REGIME STORAGE
        # ---------------------------------------------

        self.regime_store.update_regime(
            state
        )
        trade = self.trade_policy.action(
            state
        )

        state.trade_action = trade[
            "action"
        ]

        state.trade_score = trade[
            "score"
        ]

        state.position_size = trade[
            "size"
        ]

        state.risk_score = trade[
            "risk"
        ]

        # ---------------------------------------------
        # RETURN
        # ---------------------------------------------

        return state