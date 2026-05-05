import numpy as np


class CovarianceEstimator:
    """
    Estimates covariance matrix Σ for:
    dX = μ dt + Σ^{1/2} sqrt(dt) ε
    """

    def fit(self, X: np.ndarray, mu: np.ndarray, dt: np.ndarray) -> np.ndarray:

        if len(X) < 2:
            raise ValueError("Not enough data to estimate covariance")

        dX = np.diff(X, axis=0)

        dt = dt.reshape(-1, 1)
        dt[dt == 0] = 1e-8

        # residuals
        residuals = dX - mu * dt

        # normalize by sqrt(dt)
        scaled = residuals / np.sqrt(dt)

        self.Sigma = np.cov(scaled.T)

        return self.Sigma