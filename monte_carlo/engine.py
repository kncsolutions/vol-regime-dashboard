import numpy as np


class MonteCarloEngine:

    def __init__(self, path_generator, n_paths=2000, batch_size=500):
        self.path_generator = path_generator
        self.n_paths = n_paths
        self.batch_size = batch_size

    def run_until_converged(
        self,
        X0,
        S0,
        steps,
        gamma_flip,
        tol=0.01,
        max_paths=20000,
        min_paths=1000
    ):

        paths = []
        dt_paths = []

        prev_stats = None

        total_paths = 0

        while total_paths < max_paths:

            # --- generate batch ---
            for _ in range(self.batch_size):

                path, dt_path = self.path_generator.generate(
                    X0, S0, steps, gamma_flip
                )

                paths.append(path)
                dt_paths.append(dt_path)

            total_paths += self.batch_size

            paths_arr = np.array(paths)

            # --- compute stats on final price ---
            final = paths_arr[:, -1]

            stats = {
                "mean": np.mean(final),
                "std": np.std(final),
                "p5": np.percentile(final, 5),
                "p95": np.percentile(final, 95),
            }

            print(f"[{total_paths} paths] stats:", stats)

            # --- check convergence ---
            if prev_stats is not None and total_paths >= min_paths:

                if self._is_converged(prev_stats, stats, tol):
                    print(f"✅ Converged at {total_paths} paths")
                    break

            prev_stats = stats

        return np.array(paths), np.array(dt_paths), stats

    def _is_converged(self, prev, curr, tol):

        for key in ["mean", "std", "p5", "p95"]:

            if abs(curr[key] - prev[key]) / (abs(prev[key]) + 1e-8) > tol:
                return False

        return True