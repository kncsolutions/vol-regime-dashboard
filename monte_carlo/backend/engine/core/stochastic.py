import numpy as np


class StochasticProcess:
    """
    Multivariate stochastic process:

    X_{t+dt} = X_t + μ dt + L sqrt(dt) ε
    """

    def __init__(self, mu: np.ndarray, Sigma: np.ndarray):

        self.mu = mu

        # Ensure positive-definite covariance
        self.Sigma = self._make_pd(Sigma)

        self.L = np.linalg.cholesky(self.Sigma)

    def _make_pd(self, Sigma):
        """
        Fix numerical issues if covariance is not PD
        """
        eps = 1e-6
        return Sigma + np.eye(Sigma.shape[0]) * eps

    def step(self, X: np.ndarray, dt: float) -> np.ndarray:

        eps = np.random.randn(len(X))

        dX = self.mu * dt + np.sqrt(dt) * (self.L @ eps)

        return X + dX