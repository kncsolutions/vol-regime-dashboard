
import numpy as np


class GBMSimulator:

    def __init__(
        self,
        mu=0.0,
        sigma=0.2,
        dt=1/252
    ):

        self.mu = mu
        self.sigma = sigma
        self.dt = dt

    def generate_paths(
        self,
        S0,
        steps=100,
        paths=1000
    ):

        result = np.zeros((paths, steps))

        result[:, 0] = S0

        for t in range(1, steps):

            z = np.random.standard_normal(paths)

            result[:, t] = (
                result[:, t-1]
                *
                np.exp(
                    (
                        self.mu
                        -
                        0.5 * self.sigma**2
                    ) * self.dt
                    +
                    self.sigma
                    *
                    np.sqrt(self.dt)
                    *
                    z
                )
            )

        return result
