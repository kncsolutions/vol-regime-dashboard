from pathlib import Path
def get_output_file_name_path(
        timeframe,
        year,
        month=None,
        quarter=None,
        filename="report_nifty50"
):
    timeframe = timeframe.upper()

    if timeframe == "MONTHLY":

        folder = f"{year}_{month:02d}"
        filename_suffix = f"{year}_{month:02d}"

    elif timeframe == "QUARTERLY":

        folder = f"{year}_Q{quarter}"
        filename_suffix = f"{year}_Q{quarter}"

    else:

        raise ValueError(
            f"Unknown timeframe : {timeframe}"
        )

    output_dir = (

            Path("query_op")

            / timeframe

            / folder

    )

    output_dir.mkdir(

        parents=True,

        exist_ok=True

    )
    filename = f"{filename}_{filename_suffix}"
    return output_dir / f"{filename}.pdf"