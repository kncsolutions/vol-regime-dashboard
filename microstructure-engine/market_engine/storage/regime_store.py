from pathlib import Path
import pandas as pd
import json


# =====================================================
# REGIME STORE
# =====================================================

class RegimeStore:

    # =================================================
    # INIT
    # =================================================

    def __init__(

        self,

        output_dir="data/regimes"
    ):

        self.output_dir = Path(
            output_dir
        )

        self.output_dir.mkdir(

            parents=True,

            exist_ok=True
        )

        # ---------------------------------------------
        # ACTIVE REGIMES
        # ---------------------------------------------

        self.active = {}

    # =================================================
    # START REGIME
    # =================================================

    def start_regime(

        self,

        state
    ):

        self.active[state.symbol] = {

            # =================================================
            # CORE
            # =================================================

            "symbol":
                state.symbol,

            "cluster":
                state.cluster,

            "previous_cluster":
                state.previous_cluster,

            # =================================================
            # TEMPORAL
            # =================================================

            "start_time":
                state.time,

            "end_time":
                state.time,

            "dwell":
                1,

            "transition_count":
                state.transition_count,

            # =================================================
            # SIGNALS
            # =================================================

            "signal":
                state.signal,
            "next_state_probs":
                json.dumps(
                    state.next_state_probs
                ),

            "semantic_signal":
                state.semantic_signal,

            "trade_action":
                state.trade_action,

            # =================================================
            # FORECAST GEOMETRY
            # =================================================

            "expected_return":
                state.expected_return,

            "forecast_score":
                state.forecast_score,

            "confidence_mean":
                state.confidence,

            "entropy_mean":
                state.entropy,

            "entropy_trend":
                state.entropy_trend,

            # =================================================
            # RISK GEOMETRY
            # =================================================

            "hv_mean":
                state.HV,

            "risk_score":
                state.risk_score,

            "position_size":
                state.position_size,

            # =================================================
            # FLOW GEOMETRY
            # =================================================

            "flow_mean":
                state.flow,

            "ofi_mean":
                state.ofi,

            "imbalance_l1_mean":
                state.imbalance_l1,

            "imbalance_l2_mean":
                state.imbalance_l2,

            # =================================================
            # ECOLOGICAL STATES
            # =================================================

            "metastable":
                state.metastable,

            "unstable":
                state.unstable,

            "trapping_score":
                state.trapping_score,

            # =================================================
            # MARKET
            # =================================================

            "start_ltp":
                state.ltp,

            "end_ltp":
                state.ltp,
        }

    # =================================================
    # UPDATE REGIME
    # =================================================

    def update_regime(

        self,

        state
    ):

        symbol = state.symbol

        # ---------------------------------------------
        # INITIALIZE
        # ---------------------------------------------

        if symbol not in self.active:

            self.start_regime(
                state
            )

            return

        regime = self.active[symbol]

        # ---------------------------------------------
        # SAME REGIME
        # ---------------------------------------------

        if regime["cluster"] == state.cluster:

            n = regime["dwell"]

            # -----------------------------------------
            # UPDATE DWELL
            # -----------------------------------------

            regime["dwell"] += 1

            regime["end_time"] = (
                state.time
            )

            # -----------------------------------------
            # O(1) MEANS
            # -----------------------------------------

            regime["entropy_mean"] += (

                state.entropy
                -
                regime["entropy_mean"]

            ) / (n + 1)

            regime["hv_mean"] += (

                state.HV
                -
                regime["hv_mean"]

            ) / (n + 1)

            regime["flow_mean"] += (

                state.flow
                -
                regime["flow_mean"]

            ) / (n + 1)

            regime["confidence_mean"] += (

                state.confidence
                -
                regime["confidence_mean"]

            ) / (n + 1)

            regime["expected_return"] += (
                                                 state.expected_return
                                                 -
                                                 regime["expected_return"]
                                         ) / (n + 1)

            regime["forecast_score"] += (
                                                state.forecast_score
                                                -
                                                regime["forecast_score"]
                                        ) / (n + 1)

            regime["risk_score"] += (
                                            state.risk_score
                                            -
                                            regime["risk_score"]
                                    ) / (n + 1)

            regime["ofi_mean"] += (
                                          state.ofi
                                          -
                                          regime["ofi_mean"]
                                  ) / (n + 1)

            regime["imbalance_l1_mean"] += (
                                                   state.imbalance_l1
                                                   -
                                                   regime["imbalance_l1_mean"]
                                           ) / (n + 1)

            regime["imbalance_l2_mean"] += (
                                                   state.imbalance_l2
                                                   -
                                                   regime["imbalance_l2_mean"]
                                           ) / (n + 1)

            regime["expected_return"] += (
                                                 state.expected_return
                                                 -
                                                 regime["expected_return"]
                                         ) / (n + 1)

            regime["forecast_score"] += (
                                                state.forecast_score
                                                -
                                                regime["forecast_score"]
                                        ) / (n + 1)

            regime["risk_score"] += (
                                            state.risk_score
                                            -
                                            regime["risk_score"]
                                    ) / (n + 1)

            regime["ofi_mean"] += (
                                          state.ofi
                                          -
                                          regime["ofi_mean"]
                                  ) / (n + 1)

            regime["imbalance_l1_mean"] += (
                                                   state.imbalance_l1
                                                   -
                                                   regime["imbalance_l1_mean"]
                                           ) / (n + 1)

            regime["imbalance_l2_mean"] += (
                                                   state.imbalance_l2
                                                   -
                                                   regime["imbalance_l2_mean"]
                                           ) / (n + 1)

            regime["end_ltp"] = state.ltp

            regime["entropy_trend"] = (
                state.entropy_trend
            )

            regime["metastable"] = (
                state.metastable
            )

            regime["unstable"] = (
                state.unstable
            )

            regime["trapping_score"] = (
                state.trapping_score
            )

            regime["trade_action"] = (
                state.trade_action
            )

            regime["semantic_signal"] = (
                state.semantic_signal
            )

        # ---------------------------------------------
        # TRANSITION
        # ---------------------------------------------

        else:

            # -----------------------------------------
            # FLUSH OLD
            # -----------------------------------------

            self.flush(symbol)

            # -----------------------------------------
            # START NEW
            # -----------------------------------------

            self.start_regime(
                state
            )

    # =================================================
    # FLUSH
    # =================================================

    def flush(

        self,

        symbol
    ):

        if symbol not in self.active:

            return

        regime = self.active[symbol]

        # ---------------------------------------------
        # DATAFRAME
        # ---------------------------------------------

        df = pd.DataFrame([

            regime
        ])

        # ---------------------------------------------
        # PATH
        # ---------------------------------------------

        path = (

            self.output_dir
            /
            f"{symbol}.parquet"
        )

        # ---------------------------------------------
        # APPEND
        # ---------------------------------------------

        if path.exists():

            old = pd.read_parquet(
                path
            )

            df = pd.concat([

                old,

                df

            ])

        # ---------------------------------------------
        # SAVE
        # ---------------------------------------------

        df.to_parquet(

            path,

            index=False
        )

        print(

            f"Saved regime → "
            f"{symbol}"
        )

    # =================================================
    # FLUSH ALL
    # =================================================

    def flush_all(self):

        for symbol in list(
            self.active.keys()
        ):

            self.flush(symbol)