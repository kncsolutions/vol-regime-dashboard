from market_engine.montecarlo.montecarlo_engine import MonteCarloEngine


def run_integrity():

    print("=" * 60)
    print("MONTE CARLO INTEGRITY TEST")
    print("=" * 60)

    try:

        engine = MonteCarloEngine()

        print("\n[OK] Engine initialized")

        # -----------------------------------------
        # TRANSITION MATRIX
        # -----------------------------------------

        tm = engine.transition_matrix

        print(
            f"[OK] Transition matrix shape: "
            f"{tm.shape}"
        )

        # -----------------------------------------
        # CONDITIONAL TABLES
        # -----------------------------------------

        print(
            f"[OK] Return table clusters: "
            f"{len(engine.return_table)}"
        )

        print(
            f"[OK] HV table clusters: "
            f"{len(engine.hv_table)}"
        )

        print(
            f"[OK] Entropy table clusters: "
            f"{len(engine.entropy_table)}"
        )

        # -----------------------------------------
        # CLUSTER CONSISTENCY
        # -----------------------------------------

        clusters = sorted(
            engine.return_table.keys()
        )

        print(
            f"[OK] Clusters detected: {clusters}"
        )

        # -----------------------------------------
        # TRANSITION ROW SUMS
        # -----------------------------------------

        for idx, row in tm.iterrows():

            s = row.sum()

            if abs(s - 1.0) > 1e-6:

                print(
                    f"[FAIL] Row {idx} "
                    f"does not sum to 1: {s}"
                )

                return

        print(
            "[OK] Transition probabilities valid"
        )

        # -----------------------------------------
        # MONTE CARLO TEST
        # -----------------------------------------

        start_cluster = clusters[0]

        df = engine.simulate_path(

            start_cluster=start_cluster,

            steps=10
        )

        print(
            "[OK] Path simulation successful"
        )

        print("\nSample Path:\n")

        print(df.head())

        print("\n" + "=" * 60)
        print("INTEGRITY TEST PASSED")
        print("=" * 60)

    except Exception as e:

        print("\n[FAIL] Integrity test failed")
        print(type(e).__name__)
        print(e)


if __name__ == "__main__":

    run_integrity()