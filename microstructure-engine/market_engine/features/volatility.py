
import numpy as np


def compute_hv(returns):

    if len(returns) < 2:
        return 0.0

    return np.std(returns)
