import numpy as np


class OrnsteinUhlenbeckProcess:

    def __init__(
        self,
        theta=0.15,
        mu=0.0,
        sigma=0.2
    ):

        self.theta = theta

        self.mu = mu

        self.sigma = sigma

    def simulate(
        self,
        x0,
        steps,
        dt=1/252
    ):

        path = [x0]

        for _ in range(steps):

            previous = path[-1]

            dx = (
                self.theta
                * (self.mu - previous)
                * dt
            )

            dx += (
                self.sigma
                * np.sqrt(dt)
                * np.random.normal()
            )

            path.append(
                previous + dx
            )

        return np.array(path)
