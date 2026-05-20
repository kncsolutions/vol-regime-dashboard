from pathlib import Path

import numpy as np
import pandas as pd


# =====================================================
# LOCAL GEOMETRY BUILDER
# =====================================================

class LocalGeometryBuilder:

    # =================================================
    # INIT
    # =====================================================

    def __init__(

        self,

        clustered_path=None,
    ):

        # ---------------------------------------------
        # DEFAULT PATH
        # ---------------------------------------------

        if clustered_path is None:

            clustered_path = (

                "data/clusters/"
                "test_clusters.parquet"
            )

        # ---------------------------------------------
        # LOAD
        # ---------------------------------------------

        self.df = pd.read_parquet(
            clustered_path
        )

        # ---------------------------------------------
        # SORT
        # ---------------------------------------------

        self.df = self.df.sort_values([

            "symbol",

            "time"
        ])

    # =================================================
    # SYMBOL DATA
    # =====================================================

    def symbol_data(

        self,

        symbol
    ):

        sdf = self.df[

            self.df["symbol"] == symbol

        ].copy()

        sdf = sdf.sort_values(
            "time"
        )

        sdf = sdf.reset_index(
            drop=True
        )

        return sdf

    # =================================================
    # TRANSITION MATRIX
    # =====================================================

    def transition_matrix(

        self,

        symbol,

        n_clusters=6
    ):

        sdf = self.symbol_data(
            symbol
        )

        clusters = sdf[
            "cluster"
        ].values

        # ---------------------------------------------
        # COUNTS
        # ---------------------------------------------

        counts = np.zeros(

            (n_clusters, n_clusters)
        )

        # ---------------------------------------------
        # BUILD
        # ---------------------------------------------

        for i in range(

            len(clusters) - 1
        ):

            current_state = int(
                clusters[i]
            )

            next_state = int(
                clusters[i + 1]
            )

            counts[
                current_state,
                next_state
            ] += 1

        # ---------------------------------------------
        # NORMALIZE
        # ---------------------------------------------

        row_sums = counts.sum(

            axis=1,

            keepdims=True
        )

        row_sums[
            row_sums == 0
        ] = 1

        probs = counts / row_sums

        # ---------------------------------------------
        # DF
        # ---------------------------------------------

        transition_df = pd.DataFrame(

            probs,

            index=range(n_clusters),

            columns=range(n_clusters)
        )

        return transition_df

    # =================================================
    # CONDITIONAL RETURNS
    # =====================================================

    def conditional_returns(

        self,

        symbol
    ):

        sdf = self.symbol_data(
            symbol
        )

        # ---------------------------------------------
        # FUTURE RETURN
        # ---------------------------------------------

        sdf["future_dS"] = sdf[
            "dS_avg"
        ].shift(-1)

        sdf = sdf.dropna(
            subset=["future_dS"]
        )

        rows = []

        clusters = sorted(

            sdf["cluster"]
            .unique()
            .tolist()
        )

        for cluster in clusters:

            # -----------------------------------------
            # FILTER
            # -----------------------------------------

            cdf = sdf[

                sdf["cluster"]
                == cluster

            ]

            future_returns = cdf[
                "future_dS"
            ].values

            # -----------------------------------------
            # PROBABILITIES
            # -----------------------------------------

            p_up = np.mean(
                future_returns > 0
            )

            p_down = np.mean(
                future_returns < 0
            )

            p_flat = np.mean(
                future_returns == 0
            )

            # -----------------------------------------
            # ENTROPY
            # -----------------------------------------

            entropy = 0.0

            probs = [

                p_up,

                p_down,

                p_flat,
            ]

            for p in probs:

                if p > 0:

                    entropy -= (

                        p
                        *
                        np.log2(p)
                    )

            # -----------------------------------------
            # STORE
            # -----------------------------------------

            rows.append({

                "cluster":
                    int(cluster),

                "samples":
                    int(len(cdf)),

                "expected_return":
                    float(
                        np.mean(
                            future_returns
                        )
                    ),

                "variance":
                    float(
                        np.var(
                            future_returns
                        )
                    ),

                "std_dev":
                    float(
                        np.std(
                            future_returns
                        )
                    ),

                "p_up":
                    float(p_up),

                "p_down":
                    float(p_down),

                "p_flat":
                    float(p_flat),

                "entropy":
                    float(entropy),
            })

        return pd.DataFrame(rows)

    # =================================================
    # ENTROPY TABLE
    # =====================================================

    def entropy_table(

        self,

        symbol
    ):

        conditional = self.conditional_returns(
            symbol
        )

        table = {}

        for _, row in conditional.iterrows():

            table[
                int(row["cluster"])
            ] = float(
                row["entropy"]
            )

        return table

    # =================================================
    # RETURN TABLE
    # =====================================================

    def return_table(

        self,

        symbol
    ):

        conditional = self.conditional_returns(
            symbol
        )

        table = {}

        for _, row in conditional.iterrows():

            table[
                int(row["cluster"])
            ] = float(
                row["expected_return"]
            )

        return table

    # =================================================
    # HV TABLE
    # =====================================================

    def hv_table(

        self,

        symbol
    ):

        conditional = self.conditional_returns(
            symbol
        )

        table = {}

        for _, row in conditional.iterrows():

            table[
                int(row["cluster"])
            ] = float(
                row["std_dev"]
            )

        return table

    # =================================================
    # FULL GEOMETRY
    # =====================================================

    def build(

        self,

        symbol
    ):

        transition_matrix = self.transition_matrix(
            symbol
        )

        conditional = self.conditional_returns(
            symbol
        )

        entropy_table = self.entropy_table(
            symbol
        )

        return_table = self.return_table(
            symbol
        )

        hv_table = self.hv_table(
            symbol
        )

        geometry = {

            "symbol":
                symbol,

            "transition_matrix":
                transition_matrix,

            "conditional_returns":
                conditional,

            "entropy_table":
                entropy_table,

            "return_table":
                return_table,

            "hv_table":
                hv_table,
        }

        return geometry