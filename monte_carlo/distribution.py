import numpy as np
class DistributionAnalyzer:

    def summarize(self, paths):

        final = paths[:, -1]

        return {
            "p5": np.percentile(final, 5),
            "p50": np.percentile(final, 50),
            "p95": np.percentile(final, 95),
            "mean": np.mean(final),
            "std": np.std(final)
        }


import numpy as np


def probability_of_hit(paths, level):
    """
    Probability of hitting a price level at ANY time
    """

    hits = np.any(paths >= level, axis=1)
    prob = np.mean(hits)

    return prob


def probability_of_hit_down(paths, level):
    """
    Probability of hitting a downside level
    """

    hits = np.any(paths <= level, axis=1)
    prob = np.mean(hits)

    return prob


def probability_of_hit_within_T(paths, level, T):
    """
    Probability of hitting level within first T steps
    """

    truncated = paths[:, :T]

    hits = np.any(truncated >= level, axis=1)
    return np.mean(hits)


def probability_of_hit_up_within_time(paths, dts, level, T_seconds):
    """
    paths: (n_paths, steps)
    dts: (n_paths, steps) time increments
    T_seconds: time horizon in seconds
    """

    n_paths, steps = paths.shape
    hits = []

    for i in range(n_paths):

        cumulative_time = 0
        hit = False

        for j in range(steps):

            cumulative_time += dts[i, j]

            if cumulative_time > T_seconds:
                break

            if paths[i, j] >= level:
                hit = True
                break

        hits.append(hit)

    return np.mean(hits)



def probability_with_confidence(paths, level, T, z=1.96):
    """
    Returns:
    p_hat, lower_bound, upper_bound
    """

    truncated = paths[:, :T]

    hits = np.any(truncated >= level, axis=1)
    p_hat = np.mean(hits)

    N = len(hits)

    # standard error
    se = np.sqrt(p_hat * (1 - p_hat) / N)

    lower = p_hat - z * se
    upper = p_hat + z * se

    return p_hat, lower, upper


def probability_of_hit_down_within_time(paths, dt_paths, level, T_seconds):

    n_paths, steps = paths.shape
    hits = []

    for i in range(n_paths):

        cumulative_time = 0
        hit = False

        for j in range(steps):

            cumulative_time += dt_paths[i, j]

            if cumulative_time > T_seconds:
                break

            if paths[i, j] <= level:   # ✅ FIX
                hit = True
                break

        hits.append(hit)

    return np.mean(hits)