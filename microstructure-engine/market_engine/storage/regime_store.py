from pathlib import Path
import pandas as pd


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

            "symbol":
                state.symbol,

            "cluster":
                state.cluster,

            "signal":
                state.semantic_signal,

            "start_time":
                state.time,

            "end_time":
                state.time,

            "dwell":
                1,

            # -----------------------------------------
            # RUNNING MEANS
            # -----------------------------------------

            "entropy_mean":
                state.entropy,

            "hv_mean":
                state.HV,

            "flow_mean":
                state.flow,

            "confidence_mean":
                state.confidence,
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