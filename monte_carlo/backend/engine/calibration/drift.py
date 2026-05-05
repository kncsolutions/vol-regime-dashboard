import numpy as np


class DriftEstimator:
    """
    Estimates drift vector μ for multivariate process:
    dX ≈ μ * dt + noise
    """

    def fit(self, X: np.ndarray, dt: np.ndarray) -> np.ndarray:
        """
        X: (T, d) feature matrix
        dt: (T-1,) time differences
        """

        if len(X) < 2:
            raise ValueError("Not enough data to estimate drift")

        dX = np.diff(X, axis=0)

        # Avoid division issues
        dt = dt.reshape(-1, 1)
        dt[dt == 0] = 1e-8

        dX_norm = dX / dt

        self.mu = np.mean(dX_norm, axis=0)

        return self.mu