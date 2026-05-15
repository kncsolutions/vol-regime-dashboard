
import numpy as np
import pandas as pd
def compute_call_skew(chain, spot):

    """
    Call-side IV gradient

    Uses OTM calls only
    """

    if chain.empty:
        return 0

    # -----------------------------------------
    # OTM CALLS
    # -----------------------------------------

    calls = chain[
        chain["strike"] >= spot
    ].copy()

    if len(calls) < 3:
        return 0

    calls = calls.sort_values("strike")

    iv = calls["iv"].values
    strikes = calls["strike"].values

    gradients = []

    for i in range(1, len(iv) - 1):

        prev_iv = iv[i - 1]
        next_iv = iv[i + 1]

        prev_k = strikes[i - 1]
        next_k = strikes[i + 1]

        dK = next_k - prev_k

        if dK == 0:
            continue

        grad = (
            next_iv - prev_iv
        ) / dK

        gradients.append(grad)

    if not gradients:
        return 0

    return float(np.mean(gradients))


def compute_put_skew(chain, spot):

    """
    Put-side IV gradient

    Uses OTM puts only
    """

    if chain.empty:
        return 0

    # -----------------------------------------
    # OTM PUTS
    # -----------------------------------------

    puts = chain[
        chain["strike"] <= spot
    ].copy()

    if len(puts) < 3:
        return 0

    puts = puts.sort_values("strike")

    iv = puts["iv"].values
    strikes = puts["strike"].values

    gradients = []

    for i in range(1, len(iv) - 1):

        prev_iv = iv[i - 1]
        next_iv = iv[i + 1]

        prev_k = strikes[i - 1]
        next_k = strikes[i + 1]

        dK = next_k - prev_k

        if dK == 0:
            continue

        grad = (
            next_iv - prev_iv
        ) / dK

        gradients.append(grad)

    if not gradients:
        return 0

    return float(np.mean(gradients))
