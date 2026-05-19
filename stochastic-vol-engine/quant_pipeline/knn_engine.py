import numpy as np

from sklearn.neighbors import (
    NearestNeighbors
)

from backend.config import (
    K_NEIGHBORS
)


class KNNEngine:

    def __init__(self):

        self.model = NearestNeighbors(
            n_neighbors=K_NEIGHBORS + 1,
            metric="mahalanobis"
        )

    def fit(self, X):

        covariance = np.cov(X.T)

        inverse_covariance = np.linalg.pinv(
            covariance
        )

        self.model.set_params(
            metric_params={
                "VI": inverse_covariance
            }
        )

        self.model.fit(X)

    def query(self, state):

        distances, indices = (
            self.model.kneighbors(
                state
            )
        )

        return (
            distances[0][1:],
            indices[0][1:]
        )
