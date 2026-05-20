
def compute_imbalance(bid_volume, ask_volume):

    total = bid_volume + ask_volume

    if total == 0:
        return 0.0

    return (bid_volume - ask_volume) / total
