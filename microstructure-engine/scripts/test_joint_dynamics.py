from pathlib import Path
import pandas as pd
import numpy as np


# =====================================================
# CONFIG
# =====================================================

CLUSTER_FILE = (
    "data/clusters/test_clusters.parquet"
)

HORIZON = 1


# =====================================================
# LOAD
# =====================================================

def load_data():

    path = Path(CLUSTER_FILE)

    if not path.exists():

        raise Exception(
            "Cluster parquet missing"
        )

    df = pd.read_parquet(path)

    return df


# =====================================================
# PREPARE
# =====================================================

def prepare(df):

    # ---------------------------------------------
    # SORT
    # ---------------------------------------------

    df = df.sort_values(
        by="time"
    ).reset_index(drop=True)

    # ---------------------------------------------
    # FUTURE STATE
    # ---------------------------------------------

    df["next_cluster"] = (

        df["cluster"]
        .shift(-HORIZON)
    )

    # ---------------------------------------------
    # FUTURE RETURN
    # ---------------------------------------------

    df["future_dS"] = (

        df["dS_avg"]
        .shift(-HORIZON)
    )

    # ---------------------------------------------
    # CLEAN
    # ---------------------------------------------

    df = df.dropna()

    df["next_cluster"] = (
        df["next_cluster"]
        .astype(int)
    )

    return df


# =====================================================
# JOINT DYNAMICS
# =====================================================

def compute_joint_dynamics(df):

    current_states = sorted(
        df["cluster"].unique()
    )

    results = []

    for current_state in current_states:

        subset = df[
            df["cluster"]
            ==
            current_state
        ]

        total = len(subset)

        next_states = sorted(
            subset["next_cluster"].unique()
        )

        for next_state in next_states:

            transition_subset = subset[

                subset["next_cluster"]
                ==
                next_state
            ]

            count = len(
                transition_subset
            )

            probability = (
                count / total
            )

            future_returns = transition_subset[
                "future_dS"
            ]

            mean_return = np.mean(
                future_returns
            )

            variance = np.var(
                future_returns
            )

            std_dev = np.std(
                future_returns
            )

            up_prob = np.mean(
                future_returns > 0
            )

            down_prob = np.mean(
                future_returns < 0
            )

            # -------------------------------------
            # STORE
            # -------------------------------------

            results.append({

                "S_t": current_state,

                "S_t+1": next_state,

                "P(S_t+1|S_t)": probability,

                "samples": count,

                "E[dS_t+1]": mean_return,

                "Var[dS_t+1]": variance,

                "Std[dS_t+1]": std_dev,

                "P(up)": up_prob,

                "P(down)": down_prob,
            })

    return pd.DataFrame(results)


# =====================================================
# MAIN
# =====================================================

def main():

    # -------------------------------------------------
    # LOAD
    # -------------------------------------------------

    df = load_data()

    print("\n")

    print("=" * 70)

    print("DATASET")

    print("=" * 70)

    print(df.tail())

    # -------------------------------------------------
    # PREPARE
    # -------------------------------------------------

    df = prepare(df)

    # -------------------------------------------------
    # JOINT DYNAMICS
    # -------------------------------------------------

    results = compute_joint_dynamics(df)

    # -------------------------------------------------
    # DISPLAY
    # -------------------------------------------------

    print("\n")

    print("=" * 70)

    print("JOINT REGIME DYNAMICS")

    print("=" * 70)

    print(

        results.round(6)
    )

    # -------------------------------------------------
    # INTERPRETATION
    # -------------------------------------------------

    print("\n")

    print("=" * 70)

    print("TRANSITION INTERPRETATION")

    print("=" * 70)

    for _, row in results.iterrows():

        s0 = int(row["S_t"])

        s1 = int(row["S_t+1"])

        prob = row["P(S_t+1|S_t)"]

        exp_ret = row["E[dS_t+1]"]

        up_prob = row["P(up)"]

        print("\n")

        print(
            f"S_t={s0} → S_t+1={s1}"
        )

        print("-" * 50)

        print(
            f"Transition Probability: "
            f"{prob:.4f}"
        )

        print(
            f"Expected Future dS: "
            f"{exp_ret:.6f}"
        )

        print(
            f"P(up): "
            f"{up_prob:.4f}"
        )

        # -----------------------------------------
        # REGIME LABEL
        # -----------------------------------------

        if exp_ret > 0:

            label = "Bullish transition"

        elif exp_ret < 0:

            label = "Bearish transition"

        else:

            label = "Neutral transition"

        print(
            f"Interpretation: {label}"
        )

    # -------------------------------------------------
    # SAVE
    # -------------------------------------------------

    output_dir = Path(
        "data/clusters"
    )

    output_dir.mkdir(

        parents=True,

        exist_ok=True
    )

    output_file = (
        output_dir
        /
        "joint_dynamics.csv"
    )

    results.to_csv(

        output_file,

        index=False
    )

    print("\n")

    print("=" * 70)

    print(
        f"✅ Saved joint dynamics "
        f"→ {output_file}"
    )

    print("=" * 70)


# =====================================================
# ENTRY
# =====================================================

if __name__ == "__main__":

    main()