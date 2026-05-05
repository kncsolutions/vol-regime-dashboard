import numpy as np
import matplotlib.pyplot as plt


# =========================================================
# 1. PATH VISUALIZATION
# =========================================================

def plot_paths(paths, n_plot=50):
    n_paths, steps = paths.shape

    plt.figure(figsize=(12, 6))

    for i in range(min(n_plot, n_paths)):
        plt.plot(paths[i], alpha=0.3)

    mean_path = np.mean(paths, axis=0)
    plt.plot(mean_path, linewidth=2, label='Mean')

    plt.title("Monte Carlo Price Paths")
    plt.xlabel("Time Steps")
    plt.ylabel("Price")
    plt.legend()
    plt.grid(True)
    plt.show()


def plot_with_bands(paths):
    steps = paths.shape[1]

    mean = np.mean(paths, axis=0)
    p5 = np.percentile(paths, 5, axis=0)
    p95 = np.percentile(paths, 95, axis=0)

    plt.figure(figsize=(12, 6))

    plt.plot(mean, label="Mean", linewidth=2)
    plt.fill_between(range(steps), p5, p95, alpha=0.3, label="5–95 Band")

    plt.title("Confidence Band (5–95)")
    plt.legend()
    plt.grid(True)
    plt.show()


# =========================================================
# 2. DISTRIBUTION
# =========================================================

def plot_distribution(paths):
    final_prices = paths[:, -1]

    plt.figure(figsize=(10, 5))
    plt.hist(final_prices, bins=50, alpha=0.7)

    plt.axvline(np.mean(final_prices), linestyle='--', label='Mean')
    plt.axvline(np.percentile(final_prices, 5), linestyle='--', label='p5')
    plt.axvline(np.percentile(final_prices, 95), linestyle='--', label='p95')

    plt.title("Final Price Distribution")
    plt.xlabel("Price")
    plt.ylabel("Frequency")
    plt.legend()
    plt.grid(True)
    plt.show()


# =========================================================
# 3. PATHS WITH GAMMA FLIP + BARRIERS
# =========================================================

def plot_paths_with_levels(paths, S0, gamma_flip=None, levels=None, n_plot=50):

    n_paths, steps = paths.shape

    plt.figure(figsize=(12, 6))

    for i in range(min(n_plot, n_paths)):
        plt.plot(paths[i], alpha=0.2)

    mean_path = np.mean(paths, axis=0)
    plt.plot(mean_path, linewidth=2, label="Mean")

    plt.axhline(S0, linestyle='--', label="Spot")

    if gamma_flip is not None:
        plt.axhline(gamma_flip, linestyle='--', linewidth=2, label="Gamma Flip")

    if levels:
        for lvl in levels:
            plt.axhline(lvl, linestyle=':', label=f"Barrier {lvl}")

    plt.title("Paths with Gamma Flip & Barriers")
    plt.legend()
    plt.grid(True)
    plt.show()


# =========================================================
# 4. PROBABILITY CURVES
# =========================================================

def probability_curve(paths, level):
    n_paths, steps = paths.shape
    probs = []

    for t in range(1, steps + 1):
        hits = np.any(paths[:, :t] >= level, axis=1)
        probs.append(np.mean(hits))

    return np.array(probs)


def plot_probability_curve(paths, level):
    probs = probability_curve(paths, level)

    plt.figure(figsize=(10, 5))
    plt.plot(probs)

    plt.title(f"P(hit {level}) vs Time")
    plt.xlabel("Time Steps")
    plt.ylabel("Probability")
    plt.grid(True)
    plt.show()


# =========================================================
# 5. PROBABILITY + CONFIDENCE INTERVAL
# =========================================================

def probability_with_confidence(paths, level, T, z=1.96):

    truncated = paths[:, :T]
    hits = np.any(truncated >= level, axis=1)

    p = np.mean(hits)
    N = len(hits)

    se = np.sqrt(p * (1 - p) / N)

    lower = p - z * se
    upper = p + z * se

    return p, lower, upper


def plot_probability_curve_ci(paths, level, z=1.96):

    n_paths, steps = paths.shape

    probs = []
    lower = []
    upper = []

    for t in range(1, steps + 1):

        hits = np.any(paths[:, :t] >= level, axis=1)
        p = np.mean(hits)

        se = np.sqrt(p * (1 - p) / n_paths)

        probs.append(p)
        lower.append(p - z * se)
        upper.append(p + z * se)

    probs = np.array(probs)
    lower = np.array(lower)
    upper = np.array(upper)

    plt.figure(figsize=(10, 5))

    plt.plot(probs, label="Probability")
    plt.fill_between(range(len(probs)), lower, upper, alpha=0.3, label="95% CI")

    plt.title(f"Probability Curve + CI ({level})")
    plt.xlabel("Time Steps")
    plt.ylabel("Probability")

    plt.legend()
    plt.grid(True)
    plt.show()


# =========================================================
# 6. TIME-TO-HIT DISTRIBUTION
# =========================================================

def plot_time_to_hit(paths, level):

    times = []

    for path in paths:
        hit_idx = np.where(path >= level)[0]

        if len(hit_idx) > 0:
            times.append(hit_idx[0])

    if len(times) == 0:
        print("No paths hit the level")
        return

    plt.figure(figsize=(10, 5))
    plt.hist(times, bins=50, alpha=0.7)

    plt.title(f"Time-to-Hit Distribution ({level})")
    plt.xlabel("Steps")
    plt.ylabel("Frequency")

    plt.grid(True)
    plt.show()


# =========================================================
# 7. UP vs DOWN PROBABILITY
# =========================================================

def plot_up_down_prob(paths, upper, lower):

    n_paths, steps = paths.shape

    p_up = []
    p_down = []

    for t in range(1, steps + 1):

        up_hits = np.any(paths[:, :t] >= upper, axis=1)
        down_hits = np.any(paths[:, :t] <= lower, axis=1)

        p_up.append(np.mean(up_hits))
        p_down.append(np.mean(down_hits))

    plt.figure(figsize=(10, 5))

    plt.plot(p_up, label=f"Up ({upper})")
    plt.plot(p_down, label=f"Down ({lower})")

    plt.title("Up vs Down Probability")
    plt.xlabel("Time Steps")
    plt.ylabel("Probability")

    plt.legend()
    plt.grid(True)
    plt.show()