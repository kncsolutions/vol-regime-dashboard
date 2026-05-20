
def compute_spread(best_ask, best_bid):

    return best_ask - best_bid


def compute_microprice(
    best_bid,
    best_ask,
    bid_qty,
    ask_qty
):

    denominator = bid_qty + ask_qty

    if denominator == 0:
        return 0.0

    return (
        best_bid * ask_qty
        +
        best_ask * bid_qty
    ) / denominator
