# quant_pipeline/features/volatility.py

import math


def compute_approx_hv(
    ltp,
    prev_close,
    scale=256
):

    """
    Approximate realized volatility
    using previous close reference.

    HV = |log return| * sqrt(scale)
    """

    if not ltp or not prev_close:
        return 0

    try:

        # -----------------------------------------
        # LOG RETURN
        # -----------------------------------------

        r = math.log(
            ltp / prev_close
        )

        # -----------------------------------------
        # ABS MOVE
        # -----------------------------------------

        abs_r = abs(r)

        # -----------------------------------------
        # ANNUALIZATION
        # -----------------------------------------

        hv = (
            abs_r *
            math.sqrt(scale)
        )

        return float(hv)

    except Exception:

        return 0



# quant_pipeline/features/volatility.py

def compute_atm_iv(chain, spot):

    """
    ATM IV

    Finds strike closest to spot
    and returns corresponding IV.
    """

    if chain is None:
        return 0

    if chain.empty:
        return 0

    try:

        chain = chain.copy()

        # -----------------------------------------
        # CLEAN
        # -----------------------------------------

        chain["strike"] = (
            chain["strike"]
            .astype(float)
        )

        chain["iv"] = (
            chain["iv"]
            .fillna(0)
            .astype(float)
        )

        # -----------------------------------------
        # DISTANCE TO SPOT
        # -----------------------------------------

        chain["distance"] = (
            chain["strike"] - spot
        ).abs()

        # -----------------------------------------
        # ATM ROW
        # -----------------------------------------

        atm_row = (
            chain
            .sort_values("distance")
            .iloc[0]
        )

        atm_iv = atm_row["iv"]

        return float(atm_iv)

    except Exception as e:

        print("❌ ATM IV error:", e)

        return 0