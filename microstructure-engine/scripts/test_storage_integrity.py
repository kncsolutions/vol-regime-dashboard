from pathlib import Path
import pandas as pd
import numpy as np


BASE_DIR = Path("data/features")


# =====================================================
# VALIDATION HELPERS
# =====================================================

def validate_columns(df, required):

    missing = [

        col

        for col in required

        if col not in df.columns
    ]

    return missing


def validate_nan_inf(df):

    numeric = df.select_dtypes(
        include=[np.number]
    )

    nan_count = numeric.isna().sum().sum()

    inf_count = np.isinf(
        numeric.values
    ).sum()

    return nan_count, inf_count


def validate_duplicates(df):

    if "time" not in df.columns:

        return 0

    return df.duplicated(
        subset=["time"]
    ).sum()


def validate_ranges(df):

    problems = []

    # -----------------------------------------
    # SPREAD
    # -----------------------------------------

    if "spread_avg" in df.columns:

        if (df["spread_avg"] < 0).any():

            problems.append(
                "Negative spread detected"
            )

    # -----------------------------------------
    # HV
    # -----------------------------------------

    if "HV_avg" in df.columns:

        if (df["HV_avg"] < 0).any():

            problems.append(
                "Negative HV detected"
            )

    # -----------------------------------------
    # IMBALANCE
    # -----------------------------------------

    imbalance_cols = [

        "imbalance_l1_avg",

        "imbalance_l2_avg",
    ]

    for col in imbalance_cols:

        if col in df.columns:

            if (

                (df[col] < -1).any()

                or

                (df[col] > 1).any()
            ):

                problems.append(
                    f"{col} outside [-1,1]"
                )

    return problems


# =====================================================
# MAIN TEST
# =====================================================

def run_integrity_check():

    required_columns = [

        "time",

        "symbol",

        "samples",

        "ltp_avg",

        "microprice_avg",

        "spread_avg",

        "flow_avg",

        "imbalance_l1_avg",

        "imbalance_l2_avg",

        "dS_avg",

        "HV_avg",

        "I1_avg",

        "I2_avg",

        "I3_avg",
    ]

    # =================================================
    # FIND FILES
    # =================================================

    parquet_files = list(

        BASE_DIR.rglob("*.parquet")
    )

    if len(parquet_files) == 0:

        print(
            "❌ No parquet files found"
        )

        return

    print(
        f"\n📦 Found "
        f"{len(parquet_files)} parquet files\n"
    )

    # =================================================
    # VALIDATE EACH FILE
    # =================================================

    for file in parquet_files:

        print("=" * 60)

        print(f"📁 FILE: {file}")

        print("=" * 60)

        try:

            df = pd.read_parquet(file)

        except Exception as e:

            print(
                f"❌ READ FAILED: {e}"
            )

            continue

        # ---------------------------------------------
        # ROWS
        # ---------------------------------------------

        print(
            f"ROWS: {len(df)}"
        )

        # ---------------------------------------------
        # EMPTY
        # ---------------------------------------------

        if len(df) == 0:

            print(
                "❌ EMPTY DATAFRAME"
            )

            continue

        # ---------------------------------------------
        # COLUMNS
        # ---------------------------------------------

        missing = validate_columns(

            df,

            required_columns
        )

        if len(missing) > 0:

            print(
                f"❌ Missing Columns: "
                f"{missing}"
            )

        else:

            print(
                "✅ Column schema valid"
            )

        # ---------------------------------------------
        # NaN / inf
        # ---------------------------------------------

        nan_count, inf_count = \
            validate_nan_inf(df)

        print(
            f"NaN Count: {nan_count}"
        )

        print(
            f"Inf Count: {inf_count}"
        )

        # ---------------------------------------------
        # DUPLICATES
        # ---------------------------------------------

        duplicates = validate_duplicates(df)

        print(
            f"Duplicate timestamps: "
            f"{duplicates}"
        )

        # ---------------------------------------------
        # RANGE CHECKS
        # ---------------------------------------------

        problems = validate_ranges(df)

        if len(problems) == 0:

            print(
                "✅ Range checks passed"
            )

        else:

            for p in problems:

                print(f"❌ {p}")

        # ---------------------------------------------
        # PREVIEW
        # ---------------------------------------------

        print("\nTAIL PREVIEW:\n")

        print(df.tail(3))

        print("\n")

    print("=" * 60)

    print("✅ STORAGE INTEGRITY TEST COMPLETE")

    print("=" * 60)


# =====================================================
# ENTRY
# =====================================================

if __name__ == "__main__":

    run_integrity_check()