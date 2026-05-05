import numpy as np
from sklearn.linear_model import Ridge


class ImpactModel:

    def __init__(self, alpha=1.0):
        self.model = Ridge(alpha=alpha)
        self.coef_ = None
        self.intercept_ = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        self.model.fit(X, y)

        # store coefficients for fast inference
        self.coef_ = self.model.coef_
        self.intercept_ = self.model.intercept_

    def predict(self, X: np.ndarray) -> float:
        # fast manual prediction (no sklearn overhead)
        return float(np.dot(self.coef_, X) + self.intercept_)