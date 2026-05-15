def compute_flow(imbalance, ltq):

    """
    Trade-pressure flow

    imbalance : depth imbalance
    ltq       : last traded quantity
    """

    return imbalance * ltq


def compute_dS(current_microprice,
               previous_microprice):

    return (
        current_microprice -
        previous_microprice
    )
