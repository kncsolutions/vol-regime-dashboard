def calculate_spread(bid, ask):

    return ask - bid


def calculate_imbalance(depth):

    """
    Depth-5 orderbook imbalance

    depth format:
    [
        {
            "bid_qty": ...,
            "ask_qty": ...
        },
        ...
    ]
    """

    if not depth:
        return 0

    total_bid_qty = 0
    total_ask_qty = 0

    for level in depth[:5]:

        total_bid_qty += level.get("bid_qty", 0)

        total_ask_qty += level.get("ask_qty", 0)

    total = total_bid_qty + total_ask_qty

    if total == 0:
        return 0

    imbalance = (
        total_bid_qty - total_ask_qty
    ) / total

    return imbalance


# =========================================================
# DEPTH-5 MICROPRICE
# =========================================================

def calculate_microprice(depth):

    if not depth:
        return 0

    weighted_bid = 0
    weighted_ask = 0

    total_bid_qty = 0
    total_ask_qty = 0

    for level in depth[:5]:

        bid_price = level.get("bid_price", 0)
        ask_price = level.get("ask_price", 0)

        bid_qty = level.get("bid_qty", 0)
        ask_qty = level.get("ask_qty", 0)

        weighted_bid += bid_price * bid_qty
        weighted_ask += ask_price * ask_qty

        total_bid_qty += bid_qty
        total_ask_qty += ask_qty

    total_qty = total_bid_qty + total_ask_qty

    if total_qty == 0:
        return 0

    microprice = (
        weighted_ask +
        weighted_bid
    ) / total_qty

    return microprice
