
from sklearn.cluster import KMeans


class RegimeClusterModel:

    def __init__(self, n_clusters=5):

        self.model = KMeans(
            n_clusters=n_clusters,
            random_state=42
        )

    def fit(self, X):

        self.model.fit(X)

    def predict(self, X):

        return self.model.predict(X)
