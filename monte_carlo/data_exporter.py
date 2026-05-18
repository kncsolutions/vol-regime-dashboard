from datetime import datetime
import os
import pandas as pd
import json
import time


# =========================================================
# OUTPUT DIRECTORY
# =========================================================
def create_output_directory(csv_name):

    # =====================================================
    # One Persistent Folder Per Stock
    # =====================================================
    output_dir = os.path.join(

        "monte_carlo_output",

        csv_name

    )

    # =====================================================
    # Create Directory If Missing
    # =====================================================
    os.makedirs(

        output_dir,

        exist_ok=True
    )

    return output_dir








# =========================================================
# EXPORT REPORTS
# =========================================================
def export_reports(
    output_dir,
    report,
    csv_name
):

    # =====================================================
    # Create Output Directory
    # =====================================================
    os.makedirs(
        output_dir,
        exist_ok=True
    )

    # =====================================================
    # Timestamp Fields
    # =====================================================
    current_time = time.time()

    report["timestamp_unix"] = int(
        current_time
    )

    report["timestamp_unix_ms"] = int(
        current_time * 1000
    )

    report["timestamp_human"] = str(
        pd.Timestamp.now()
    )

    # =====================================================
    # Persistent CSV Per Stock
    # =====================================================
    csv_path = os.path.join(

        output_dir,

        f"{csv_name}_report.csv"

    )

    # =====================================================
    # CSV Append Handling
    # =====================================================
    csv_exists = os.path.exists(
        csv_path
    )

    report_df = pd.DataFrame(
        [report]
    )

    report_df.to_csv(

        csv_path,

        mode="a",

        header=not csv_exists,

        index=False
    )

    # =====================================================
    # Persistent JSON History
    # =====================================================
    json_path = os.path.join(

        output_dir,

        f"{csv_name}_report.json"

    )

    # =====================================================
    # Append JSON History
    # =====================================================
    if os.path.exists(json_path):

        try:

            with open(json_path, "r") as f:

                existing_data = json.load(f)

            if not isinstance(
                existing_data,
                list
            ):

                existing_data = [
                    existing_data
                ]

        except Exception:

            existing_data = []

    else:

        existing_data = []

    existing_data.append(report)

    # =====================================================
    # Save Updated JSON
    # =====================================================
    with open(json_path, "w") as f:

        json.dump(

            existing_data,

            f,

            indent=4
        )

    # =====================================================
    # Logging
    # =====================================================
    print(
        f"\nUpdated CSV report: {csv_path}"
    )

    print(
        f"Updated JSON report: {json_path}"
    )