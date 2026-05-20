from pathlib import Path
import pandas as pd
import numpy as np


# =====================================================
# ONLINE FORECASTER
# =====================================================

class OnlineForecaster:

    # =================================================
    # INIT
    # =================================================

    def __init__(

        self,

        transition_path=None,

        conditional_path=None,
    ):

        # ---------------------------------------------
        # DEFAULT FILES
        # ---------------------------------------------

        if transition_path is None:

            transition_path = (

                "data/clusters/"
                "transition_matrix.csv"
            )

        if conditional_path is None:

            conditional_path = (

                "data/clusters/"
                "conditional_returns.csv"
            )

        # ---------------------------------------------
        # LOAD TRANSITION MATRIX
        # ---------------------------------------------

        self.transition_matrix = pd.read_csv(

            transition_path,

            index_col=0
        )

        # ---------------------------------------------
        # FORCE INTEGER TYPES
        # ---------------------------------------------

        self.transition_matrix.index = (

            self.transition_matrix.index
            .astype(int)
        )

        self.transition_matrix.columns = (

            self.transition_matrix.columns
            .astype(int)
        )

        # ---------------------------------------------
        # LOAD CONDITIONAL TABLE
        # ---------------------------------------------

        self.conditional = pd.read_csv(
            conditional_path
        )

        # ---------------------------------------------
        # FIX CLUSTER TYPES
        # ---------------------------------------------

        self.conditional["cluster"] = (

            self.conditional["cluster"]
            .astype(int)
        )

        # ---------------------------------------------
        # BUILD ENTROPY TABLE
        # ---------------------------------------------

        self.entropy_table = (
            self.build_entropy_table()
        )

        # ---------------------------------------------
        # DEBUG
        # ---------------------------------------------

        print("\n")

        print("=" * 60)

        print("ONLINE FORECASTER INITIALIZED")

        print("=" * 60)

        print("\nTransition Matrix Index:")

        print(
            self.transition_matrix.index
        )

        print("\nEntropy Table Keys:")

        print(
            self.entropy_table.keys()
        )

        print("\n")

    # =================================================
    # ENTROPY
    # =================================================

    def compute_entropy(

        self,

        probabilities
    ):

        probs = np.array(
            probabilities,
            dtype=float
        )

        probs = probs[probs > 0]

        if len(probs) == 0:

            return 0.0

        return -np.sum(

            probs
            *
            np.log2(probs)
        )

    # =================================================
    # BUILD ENTROPY TABLE
    # =================================================

    def build_entropy_table(self):

        entropy_table = {}

        for cluster in self.transition_matrix.index:

            cluster = int(cluster)

            probs = (

                self.transition_matrix
                .loc[cluster]
                .values
                .astype(float)
            )

            entropy = self.compute_entropy(
                probs
            )

            entropy_table[
                cluster
            ] = float(entropy)

        return entropy_table

    # =================================================
    # NEXT STATE PROBABILITIES
    # =================================================

    def next_state_probabilities(

        self,

        current_cluster
    ):

        current_cluster = int(
            current_cluster
        )

        row = self.transition_matrix.loc[
            current_cluster
        ]

        probs = {

            int(col): float(val)

            for col, val in row.items()
        }

        return probs

    # =================================================
    # EXPECTED RETURN
    # =================================================

    def expected_return(

        self,

        current_cluster
    ):

        current_cluster = int(
            current_cluster
        )

        row = self.conditional[

            self.conditional["cluster"]

            == current_cluster
        ]

        if len(row) == 0:

            return 0.0

        return float(

            row[
                "E[dS_t+1|S_t]"
            ].iloc[0]
        )

    # =================================================
    # CONFIDENCE
    # =================================================

    def confidence(

        self,

        current_cluster
    ):

        current_cluster = int(
            current_cluster
        )

        entropy = self.entropy_table.get(

            current_cluster,

            0.0
        )

        return float(

            1
            /
            (
                1
                +
                entropy
            )
        )

    # =================================================
    # FORECAST SCORE
    # =================================================

    def forecast_score(

        self,

        current_cluster
    ):

        current_cluster = int(
            current_cluster
        )

        exp_ret = self.expected_return(
            current_cluster
        )

        conf = self.confidence(
            current_cluster
        )

        return float(
            exp_ret * conf
        )

    # =================================================
    # SIGNAL LABEL
    # =================================================

    def signal_label(

        self,

        forecast_score
    ):

        if forecast_score > 0.003:

            return "BULLISH"

        elif forecast_score < -0.003:

            return "BEARISH"

        else:

            return "NEUTRAL"

    # =================================================
    # FULL SIGNAL
    # =================================================

    def signal(

        self,

        current_cluster
    ):

        current_cluster = int(
            current_cluster
        )

        # ---------------------------------------------
        # EXPECTED RETURN
        # ---------------------------------------------

        exp_ret = self.expected_return(
            current_cluster
        )

        # ---------------------------------------------
        # CONFIDENCE
        # ---------------------------------------------

        conf = self.confidence(
            current_cluster
        )

        # ---------------------------------------------
        # ENTROPY
        # ---------------------------------------------

        entropy = self.entropy_table.get(

            current_cluster,

            0.0
        )

        # ---------------------------------------------
        # FORECAST SCORE
        # ---------------------------------------------

        forecast_score = (
            exp_ret
            *
            conf
        )

        # ---------------------------------------------
        # LABEL
        # ---------------------------------------------

        label = self.signal_label(
            forecast_score
        )

        # ---------------------------------------------
        # NEXT STATE PROBABILITIES
        # ---------------------------------------------

        next_probs = \
            self.next_state_probabilities(
                current_cluster
            )

        # ---------------------------------------------
        # RETURN
        # ---------------------------------------------

        return {

            "cluster":
                current_cluster,

            "expected_return":
                exp_ret,

            "confidence":
                conf,

            "forecast_score":
                forecast_score,

            "entropy":
                entropy,

            "signal":
                label,

            "next_state_probs":
                next_probs,
        }