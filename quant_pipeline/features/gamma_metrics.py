def compute_net_gex(chain):

    """
    Net Gamma Exposure

    Uses:
        gamma
        call_oi
        put_oi
    """

    if chain is None:
        return {
            "callGEX": 0,
            "putGEX": 0,
            "netGEX": 0,
            "gammaLadder": []
        }

    if chain.empty:
        return {
            "callGEX": 0,
            "putGEX": 0,
            "netGEX": 0,
            "gammaLadder": []
        }

    # =================================================
    # CLEAN
    # =================================================

    chain = chain.copy()

    chain["gamma"] = (
        chain["gamma"]
        .fillna(0)
    )

    chain["call_oi"] = (
        chain["call_oi"]
        .fillna(0)
    )

    chain["put_oi"] = (
        chain["put_oi"]
        .fillna(0)
    )

    # =================================================
    # GEX
    # =================================================

    chain["call_gex"] = (
        chain["gamma"] *
        chain["call_oi"]
    )

    chain["put_gex"] = -(
        chain["gamma"] *
        chain["put_oi"]
    )

    chain["gex"] = (
        chain["call_gex"] +
        chain["put_gex"]
    )

    # =================================================
    # TOTALS
    # =================================================

    call_gex = (
        chain["call_gex"]
        .sum()
    )

    put_gex = (
        chain["put_gex"]
        .sum()
    )

    net_gex = (
        chain["gex"]
        .sum()
    )

    # =================================================
    # GAMMA LADDER
    # =================================================

    gamma_ladder = chain[
        ["strike", "gex"]
    ].to_dict(orient="records")

    return {

        "callGEX": float(call_gex),

        "putGEX": float(put_gex),

        "netGEX": float(net_gex),

        "gammaLadder": gamma_ladder
    }



# quant_pipeline/features/gamma_metrics.py

def compute_gamma_flip(chain):

    """
    Gamma Flip Strike

    Finds strike where cumulative GEX
    changes sign.
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

        chain["gamma"] = (
            chain["gamma"]
            .fillna(0)
            .astype(float)
        )

        chain["call_oi"] = (
            chain["call_oi"]
            .fillna(0)
            .astype(float)
        )

        chain["put_oi"] = (
            chain["put_oi"]
            .fillna(0)
            .astype(float)
        )

        # -----------------------------------------
        # STRIKE-WISE GEX
        # -----------------------------------------

        chain["gex"] = (
            chain["gamma"] *
            (
                chain["call_oi"] -
                chain["put_oi"]
            )
        )

        # -----------------------------------------
        # SORT STRIKES
        # -----------------------------------------

        chain = chain.sort_values(
            "strike"
        )

        # -----------------------------------------
        # CUMULATIVE GEX
        # -----------------------------------------

        chain["cum_gex"] = (
            chain["gex"]
            .cumsum()
        )

        # -----------------------------------------
        # SIGN CHANGE
        # -----------------------------------------

        prev = None

        for _, row in chain.iterrows():

            curr = row["cum_gex"]

            if prev is not None:

                # sign flip
                if prev < 0 and curr > 0:
                    return float(row["strike"])

                if prev > 0 and curr < 0:
                    return float(row["strike"])

            prev = curr

        return 0

    except Exception as e:

        print("❌ Gamma Flip error:", e)

        return 0
