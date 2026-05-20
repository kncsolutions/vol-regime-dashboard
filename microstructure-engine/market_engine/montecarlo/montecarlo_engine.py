from pathlib import Path

import numpy as np
import pandas as pd


# =====================================================
# MONTE CARLO ENGINE
# =====================================================

class MonteCarloEngine:

    # =================================================
    # INIT
    # =================================================

    def __init__(

        self,

        transition_path=None,

        conditional_path=None,
    ):

        # ---------------------------------------------
        # DEFAULT PATHS
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
        # PATH VALIDATION
        # ---------------------------------------------

        transition_path = Path(transition_path)
        conditional_path = Path(conditional_path)

        if not transition_path.exists():

            raise FileNotFoundError(

                f"Transition matrix not found:\n"
                f"{transition_path}"
            )

        if not conditional_path.exists():

            raise FileNotFoundError(

                f"Conditional returns not found:\n"
                f"{conditional_path}"
            )

        # ---------------------------------------------
        # LOAD TABLES
        # ---------------------------------------------

        self.transition_matrix = pd.read_csv(

            transition_path,

            index_col=0
        )

        self.conditional = pd.read_csv(

            conditional_path
        )

        # ---------------------------------------------
        # DIAGNOSTICS
        # ---------------------------------------------

        print("\nLoaded Monte Carlo Tables")
        print("=" * 60)

        print(

            "Transition Matrix Shape:",

            self.transition_matrix.shape
        )

        print(

            "Conditional Columns:",

            self.conditional.columns.tolist()
        )

        # ---------------------------------------------
        # TYPE ALIGNMENT
        # ---------------------------------------------

        self.transition_matrix.index = (
            self.transition_matrix.index.astype(int)
        )

        self.transition_matrix.columns = (
            self.transition_matrix.columns.astype(int)
        )

        self.conditional["cluster"] = (
            self.conditional["cluster"].astype(int)
        )

        # ---------------------------------------------
        # CACHE TABLES
        # ---------------------------------------------

        self.return_table = {}

        self.hv_table = {}

        self.entropy_table = {}

        # ---------------------------------------------
        # REQUIRED COLUMNS
        # ---------------------------------------------

        required_columns = [

            "cluster",

            "E[dS_t+1|S_t]",

            "Std[dS_t+1|S_t]",
        ]

        for col in required_columns:

            if col not in self.conditional.columns:

                raise ValueError(

                    f"Missing required column:\n"
                    f"{col}"
                )

        # ---------------------------------------------
        # BUILD STATE TABLES
        # ---------------------------------------------

        for cluster in self.conditional[
            "cluster"
        ].unique():

            cluster = int(cluster)

            cluster_df = self.conditional[
                self.conditional["cluster"]
                == cluster
            ]

            # -----------------------------------------
            # CONDITIONAL RETURN
            # -----------------------------------------

            self.return_table[
                cluster
            ] = float(

                cluster_df[
                    "E[dS_t+1|S_t]"
                ].values[0]
            )

            # -----------------------------------------
            # CONDITIONAL VOLATILITY
            # -----------------------------------------

            self.hv_table[
                cluster
            ] = float(

                cluster_df[
                    "Std[dS_t+1|S_t]"
                ].values[0]
            )

            # -----------------------------------------
            # ENTROPY
            # FROM TRANSITION TOPOLOGY
            # -----------------------------------------

            if cluster in self.transition_matrix.index:

                transition_probs = (

                    self.transition_matrix
                    .loc[cluster]
                    .values
                )

                transition_probs = transition_probs[
                    transition_probs > 0
                ]

                if len(transition_probs) > 0:

                    entropy = -np.sum(

                        transition_probs

                        *

                        np.log2(
                            transition_probs
                        )
                    )

                else:

                    entropy = 0.0

            else:

                entropy = 0.0

            self.entropy_table[
                cluster
            ] = float(entropy)

        # ---------------------------------------------
        # FINAL DIAGNOSTICS
        # ---------------------------------------------

        print("\nLoaded Clusters")
        print("-" * 60)

        print(

            sorted(
                self.return_table.keys()
            )
        )

        print("\nEntropy Table")
        print("-" * 60)

        for k, v in self.entropy_table.items():

            print(

                f"Cluster {k}: "
                f"{v:.4f}"
            )

    # =================================================
    # NEXT STATE
    # =================================================

    def next_state(

        self,

        current_state
    ):

        # ---------------------------------------------
        # VALIDATION
        # ---------------------------------------------

        if current_state not in self.transition_matrix.index:

            raise ValueError(

                f"Unknown state:\n"
                f"{current_state}"
            )

        # ---------------------------------------------
        # PROBABILITIES
        # ---------------------------------------------

        probs = self.transition_matrix.loc[
            current_state
        ].values.astype(float)

        # ---------------------------------------------
        # NORMALIZATION SAFETY
        # ---------------------------------------------

        probs_sum = probs.sum()

        if probs_sum <= 0:

            probs = np.ones_like(probs)

            probs = probs / probs.sum()

        else:

            probs = probs / probs_sum

        # ---------------------------------------------
        # SAMPLE NEXT STATE
        # ---------------------------------------------

        next_state = np.random.choice(

            self.transition_matrix.columns,

            p=probs
        )

        return int(next_state)

    # =================================================
    # SAMPLE RETURN
    # =================================================

    def sample_return(

        self,

        cluster
    ):

        # ---------------------------------------------
        # LOOKUP
        # ---------------------------------------------

        mu = self.return_table.get(
            cluster,
            0.0
        )

        sigma = self.hv_table.get(
            cluster,
            0.0
        )

        # ---------------------------------------------
        # NUMERICAL SAFETY
        # ---------------------------------------------

        sigma = max(
            float(sigma),
            1e-8
        )

        # ---------------------------------------------
        # SAMPLE
        # ---------------------------------------------

        return np.random.normal(

            mu,

            sigma
        )

    # =================================================
    # SIMULATE SINGLE PATH
    # =================================================

    def simulate_path(

        self,

        start_cluster,

        steps=25
    ):

        current_cluster = int(start_cluster)

        cumulative = 0.0

        rows = []

        # ---------------------------------------------
        # SIMULATION LOOP
        # ---------------------------------------------

        for step in range(steps):

            # -----------------------------------------
            # RETURN SAMPLE
            # -----------------------------------------

            dS = self.sample_return(
                current_cluster
            )

            cumulative += dS

            # -----------------------------------------
            # ENTROPY
            # -----------------------------------------

            entropy = self.entropy_table.get(

                current_cluster,

                0.0
            )

            # -----------------------------------------
            # VOLATILITY
            # -----------------------------------------

            hv = self.hv_table.get(

                current_cluster,

                0.0
            )

            # -----------------------------------------
            # STORE STEP
            # -----------------------------------------

            rows.append({

                "step":
                    step,

                "state":
                    current_cluster,

                "entropy":
                    entropy,

                "hv":
                    hv,

                "dS":
                    dS,

                "cum_dS":
                    cumulative,
            })

            # -----------------------------------------
            # NEXT STATE
            # -----------------------------------------

            current_cluster = self.next_state(
                current_cluster
            )

        # ---------------------------------------------
        # RETURN PATH
        # ---------------------------------------------

        return pd.DataFrame(rows)

    # =================================================
    # MULTI PATH SIMULATION
    # =================================================

    def simulate(

        self,

        start_cluster,

        n_paths=100,

        steps=25
    ):

        paths = []

        # ---------------------------------------------
        # GENERATE PATHS
        # ---------------------------------------------

        for i in range(n_paths):

            df = self.simulate_path(

                start_cluster=start_cluster,

                steps=steps
            )

            df["path"] = i

            paths.append(df)

        # ---------------------------------------------
        # CONCAT
        # ---------------------------------------------

        return pd.concat(

            paths,

            ignore_index=True
        )

    # =================================================
    # SUMMARY STATISTICS
    # =================================================

    def summarize_paths(

        self,

        paths_df
    ):

        terminal = (

            paths_df
            .groupby("path")["cum_dS"]
            .last()
        )

        return {

            "mean":
                float(
                    terminal.mean()
                ),

            "std":
                float(
                    terminal.std()
                ),

            "p5":
                float(
                    terminal.quantile(0.05)
                ),

            "p95":
                float(
                    terminal.quantile(0.95)
                ),
        }


# =====================================================
# CLI TEST
# =====================================================

if __name__ == "__main__":

    print("\n" + "=" * 60)
    print("MONTE CARLO ENGINE TEST")
    print("=" * 60)

    engine = MonteCarloEngine()

    clusters = sorted(

        engine.return_table.keys()
    )

    start_cluster = clusters[0]

    print(

        f"\nStarting Cluster: "
        f"{start_cluster}"
    )

    paths = engine.simulate(

        start_cluster=start_cluster,

        n_paths=10,

        steps=25
    )

    stats = engine.summarize_paths(
        paths
    )

    print("\nSimulation Statistics")
    print("-" * 60)

    for k, v in stats.items():

        print(f"{k}: {v:.4f}")

    print("\nSample Paths")
    print("-" * 60)

    print(paths.head())