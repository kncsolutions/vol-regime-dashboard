import numpy as np
from sklearn.ensemble import RandomForestRegressor


class ImpactModel:

    def __init__(self):
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=6,
            random_state=42,
            n_jobs=-1
        )
        self.feature_names = None

    def fit(self, X, y, feature_names=None):
        self.model.fit(X, y)
        self.feature_names = feature_names

    def predict(self, X):
        return float(self.model.predict(X.reshape(1, -1))[0])