
import numpy as np


def probability_up(paths):

    final_prices = paths[:, -1]
    initial_prices = paths[:, 0]

    return np.mean(final_prices > initial_prices)


def probability_down(paths):

    final_prices = paths[:, -1]
    initial_prices = paths[:, 0]

    return np.mean(final_prices < initial_prices)
