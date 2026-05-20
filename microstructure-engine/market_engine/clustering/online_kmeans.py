from sklearn.cluster import MiniBatchKMeans
from sklearn.preprocessing import StandardScaler
import numpy as np


class OnlineKMeans:

    def __init__(

        self,

        n_clusters=6,

        batch_size=128,
    ):

        self.features = [

            "flow_avg",

            "imbalance_l1_avg",

            "imbalance_l2_avg",

            "dS_avg",

            "HV_avg",

            "I1_avg",

            "I2_avg",

            "I3_avg",

            "spread_avg",
        ]

        self.scaler = StandardScaler()

        self.model = MiniBatchKMeans(

            n_clusters=n_clusters,

            batch_size=batch_size,

            random_state=42,
        )

        self.initialized = False

    # =================================================
    # FEATURE MATRIX
    # =================================================

    def build_matrix(self, df):

        X = df[
            self.features
        ].values

        return np.nan_to_num(X)

    # =================================================
    # FIT
    # =================================================

    def partial_fit(self, df):

        X = self.build_matrix(df)

        # -----------------------------------------
        # SCALER
        # -----------------------------------------

        if not self.initialized:

            X_scaled = self.scaler.fit_transform(X)

            self.model.partial_fit(X_scaled)

            self.initialized = True

        else:

            X_scaled = self.scaler.transform(X)

            self.model.partial_fit(X_scaled)

    # =================================================
    # PREDICT
    # =================================================

    def predict(self, df):

        X = self.build_matrix(df)

        X_scaled = self.scaler.transform(X)

        return self.model.predict(X_scaled)