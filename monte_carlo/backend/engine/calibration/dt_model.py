import numpy as np


class DTModel:
    """
    Empirical dt sampler
    """

    def fit(self, dt: np.ndarray):
        dt = dt[dt > 0]

        if len(dt) == 0:
            raise ValueError("Invalid dt values")

        self.dt_pool = dt

    def sample(self) -> float:
        return float(np.random.choice(self.dt_pool))