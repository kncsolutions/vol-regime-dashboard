from pathlib import Path
import pandas as pd
import numpy as np


# =====================================================
# CONFIG
# =====================================================

CLUSTER_FILE = (
    "data/clusters/test_clusters.parquet"
)

N_PATHS = 5

PATH_LENGTH = 25

START_STATE = 3


# =====================================================
# LOAD DATA
# =====================================================

def load_data():

    path = Path(CLUSTER_FILE)

    if not path.exists():

        raise Exception(
            "Cluster parquet missing"
        )

    return pd.read_parquet(path)


# =====================================================
# PREPARE DATA
# =====================================================

def prepare(df):

    df = df.sort_values(
        by="time"
    ).reset_index(drop=True)

    # ---------------------------------------------
    # FUTURE STATE
    # ---------------------------------------------

    df["next_cluster"] = (
        df["cluster"]
        .shift(-1)
    )

    # ---------------------------------------------
    # FUTURE RETURNS
    # ---------------------------------------------

    df["future_dS"] = (
        df["dS_avg"]
        .shift(-1)
    )

    # ---------------------------------------------
    # FUTURE HV
    # ---------------------------------------------

    df["future_HV"] = (
        df["HV_avg"]
        .shift(-1)
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
# ENTROPY
# =====================================================

def compute_entropy(probabilities):

    probs = np.array(probabilities)

    probs = probs[probs > 0]

    if len(probs) == 0:

        return 0.0

    return -np.sum(

        probs
        *
        np.log2(probs)
    )


# =====================================================
# BUILD JOINT TABLE
# =====================================================

def build_joint_table(df):

    table = {}

    current_states = sorted(
        df["cluster"].unique()
    )

    for s0 in current_states:

        subset = df[
            df["cluster"] == s0
        ]

        total = len(subset)

        transitions = {}

        next_states = sorted(
            subset["next_cluster"].unique()
        )

        # -------------------------------------------------
        # DWELL TIMES
        # -------------------------------------------------

        dwell_times = []

        current_run = 0

        prev_state = None

        for state in subset["cluster"]:

            if state == prev_state:

                current_run += 1

            else:

                if current_run > 0:

                    dwell_times.append(
                        current_run
                    )

                current_run = 1

            prev_state = state

        if current_run > 0:

            dwell_times.append(
                current_run
            )

        # -------------------------------------------------
        # TRANSITIONS
        # -------------------------------------------------

        for s1 in next_states:

            sub = subset[
                subset["next_cluster"]
                == s1
            ]

            probability = (
                len(sub)
                / total
            )

            returns = sub[
                "future_dS"
            ].values

            hv_values = sub[
                "future_HV"
            ].values

            transitions[s1] = {

                "probability": probability,

                "returns": returns,

                "hv": hv_values,
            }

        # -------------------------------------------------
        # STORE
        # -------------------------------------------------

        table[s0] = {

            "transitions": transitions,

            "dwell_times": dwell_times,
        }

    return table


# =====================================================
# BUILD ENTROPY TABLE
# =====================================================

def build_entropy_table(joint_table):

    entropy_table = {}

    for state, state_info in joint_table.items():

        transitions = state_info[
            "transitions"
        ]

        probs = [

            data["probability"]

            for data in transitions.values()
        ]

        entropy = compute_entropy(
            probs
        )

        entropy_table[state] = entropy

    return entropy_table


# =====================================================
# SAMPLE NEXT STATE
# =====================================================

def sample_next_state(transitions):

    states = list(
        transitions.keys()
    )

    probs = [

        transitions[s]["probability"]

        for s in states
    ]

    return np.random.choice(

        states,

        p=probs
    )


# =====================================================
# SAMPLE RETURN
# =====================================================

def sample_return(

    transitions,

    state
):

    returns = transitions[state][
        "returns"
    ]

    return np.random.choice(
        returns
    )


# =====================================================
# SAMPLE HV
# =====================================================

def sample_hv(

    transitions,

    state
):

    hv = transitions[state][
        "hv"
    ]

    return np.random.choice(hv)


# =====================================================
# SAMPLE DWELL TIME
# =====================================================

def sample_dwell_time(

    dwell_times
):

    if len(dwell_times) == 0:

        return 1

    return int(

        np.random.choice(
            dwell_times
        )
    )


# =====================================================
# SIMULATE PATH
# =====================================================

def simulate_path(

    joint_table,

    entropy_table,

    start_state,

    path_length,
):

    states = [start_state]

    returns = []

    entropies = []

    hv_values = []

    current_state = start_state

    path_entropy = 0.0

    step = 0

    # -------------------------------------------------
    # MAIN LOOP
    # -------------------------------------------------

    while step < path_length:

        # ---------------------------------------------
        # STATE INFO
        # ---------------------------------------------

        state_info = joint_table[
            current_state
        ]

        transitions = state_info[
            "transitions"
        ]

        dwell_times = state_info[
            "dwell_times"
        ]

        # ---------------------------------------------
        # ENTROPY
        # ---------------------------------------------

        current_entropy = entropy_table[
            current_state
        ]

        # ---------------------------------------------
        # NEXT STATE
        # ---------------------------------------------

        next_state = sample_next_state(
            transitions
        )

        # ---------------------------------------------
        # DWELL TIME
        # ---------------------------------------------

        dwell = sample_dwell_time(
            dwell_times
        )

        remaining = (
            path_length
            - step
        )

        dwell = min(
            dwell,
            remaining
        )

        # ---------------------------------------------
        # PERSISTENCE LOOP
        # ---------------------------------------------

        for _ in range(dwell):

            # -----------------------------------------
            # SAMPLE RETURN
            # -----------------------------------------

            dS = sample_return(

                transitions,

                next_state
            )

            # -----------------------------------------
            # SAMPLE HV
            # -----------------------------------------

            step_hv = sample_hv(

                transitions,

                next_state
            )

            # -----------------------------------------
            # STORE
            # -----------------------------------------

            states.append(
                next_state
            )

            returns.append(dS)

            entropies.append(
                current_entropy
            )

            hv_values.append(
                step_hv
            )

            path_entropy += (
                current_entropy
            )

            step += 1

            if step >= path_length:

                break

        # ---------------------------------------------
        # ADVANCE
        # ---------------------------------------------

        current_state = next_state

    # -------------------------------------------------
    # PATH METRICS
    # -------------------------------------------------

    cumulative = np.cumsum(
        returns
    )

    total_return = np.sum(
        returns
    )

    average_entropy = (

        path_entropy
        /
        len(entropies)
    )

    path_confidence = (

        1
        /
        (
            1
            +
            average_entropy
        )
    )

    path_hv = np.mean(
        hv_values
    )

    confidence_adjusted_return = (

        total_return
        *
        path_confidence
    )

    risk_adjusted_path = (

        total_return
        /
        (
            path_hv
            *
            path_entropy
            +
            1e-8
        )
    )

    metrics = {

        "path_entropy":
            path_entropy,

        "average_entropy":
            average_entropy,

        "path_confidence":
            path_confidence,

        "total_return":
            total_return,

        "confidence_adjusted_return":
            confidence_adjusted_return,

        "path_hv":
            path_hv,

        "risk_adjusted_path":
            risk_adjusted_path,
    }

    return (

        states,

        returns,

        entropies,

        hv_values,

        cumulative,

        metrics,
    )


# =====================================================
# MAIN
# =====================================================

def main():

    # -------------------------------------------------
    # LOAD
    # -------------------------------------------------

    df = load_data()

    # -------------------------------------------------
    # PREPARE
    # -------------------------------------------------

    df = prepare(df)

    # -------------------------------------------------
    # BUILD TABLES
    # -------------------------------------------------

    joint_table = build_joint_table(
        df
    )

    entropy_table = build_entropy_table(
        joint_table
    )

    # -------------------------------------------------
    # DISPLAY JOINT TABLE
    # -------------------------------------------------

    print("\n")

    print("=" * 70)

    print("JOINT DYNAMICS TABLE")

    print("=" * 70)

    for s0, state_info in joint_table.items():

        transitions = state_info[
            "transitions"
        ]

        dwell_times = state_info[
            "dwell_times"
        ]

        print("\n")

        print(f"S_t={s0}")

        print(
            f"Mean Dwell Time: "
            f"{np.mean(dwell_times):.2f}"
        )

        for s1, data in transitions.items():

            print(

                f"  → S_t+1={s1} "

                f"P={data['probability']:.4f} "

                f"N={len(data['returns'])}"
            )

    # -------------------------------------------------
    # MONTE CARLO PATHS
    # -------------------------------------------------

    print("\n")

    print("=" * 70)

    print("STOCHASTIC PATHS")

    print("=" * 70)

    output_dir = Path(
        "data/montecarlo"
    )

    output_dir.mkdir(

        parents=True,

        exist_ok=True
    )

    for i in range(N_PATHS):

        (
            states,

            returns,

            entropies,

            hv_values,

            cumulative,

            metrics,
        ) = simulate_path(

            joint_table,

            entropy_table,

            START_STATE,

            PATH_LENGTH,
        )

        # -------------------------------------------------
        # DATAFRAME
        # -------------------------------------------------

        path_df = pd.DataFrame({

            "step": np.arange(
                len(returns)
            ),

            "state": states[1:],

            "entropy": entropies,

            "hv": hv_values,

            "dS": returns,

            "cum_dS": cumulative,

            # -----------------------------------------
            # PATH METRICS
            # -----------------------------------------

            "path_entropy": metrics[
                "path_entropy"
            ],

            "avg_entropy": metrics[
                "average_entropy"
            ],

            "path_confidence": metrics[
                "path_confidence"
            ],

            "path_hv": metrics[
                "path_hv"
            ],

            "conf_adjusted_return": metrics[
                "confidence_adjusted_return"
            ],

            "risk_adjusted_path": metrics[
                "risk_adjusted_path"
            ],
        })

        # -------------------------------------------------
        # DISPLAY
        # -------------------------------------------------

        print("\n")

        print(f"PATH {i+1}")

        print("-" * 50)

        print(path_df)

        print("\n")

        print("PATH METRICS")

        print("-" * 50)

        for k, v in metrics.items():

            print(
                f"{k}: {v:.6f}"
            )

        # -------------------------------------------------
        # SAVE
        # -------------------------------------------------

        output_file = (

            output_dir
            /
            f"path_{i+1}.csv"
        )

        path_df.to_csv(

            output_file,

            index=False
        )

    # -------------------------------------------------
    # DONE
    # -------------------------------------------------

    print("\n")

    print("=" * 70)

    print(
        "✅ Saved stochastic paths "
        "→ data/montecarlo/"
    )

    print("=" * 70)


# =====================================================
# ENTRY
# =====================================================

if __name__ == "__main__":

    main()