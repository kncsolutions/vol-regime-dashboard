from pathlib import Path
import numpy as np
import joblib
import yaml

from market_engine.normalization.scaler_factory import (
    build_scaler
)


# =====================================================
# ONLINE CLUSTER ENGINE
# =====================================================

class OnlineClusterEngine:

    # =================================================
    # INIT
    # =====================================================

    def __init__(

        self,

        model_path=None,
    ):

        # ---------------------------------------------
        # LOAD CONFIG
        # ---------------------------------------------

        with open(

            "configs/engine.yaml",

            "r"

        ) as f:

            config = yaml.safe_load(f)

        # ---------------------------------------------
        # NORMALIZATION MODE
        # ---------------------------------------------

        self.normalization_mode = config.get(

            "normalization_mode",

            "global"
        )

        # ---------------------------------------------
        # DEFAULT MODEL PATH
        # ---------------------------------------------

        if model_path is None:

            model_path = (

                f"data/models/"
                f"{self.normalization_mode}/"
                f"kmeans_model.pkl"
            )

        # ---------------------------------------------
        # CHECK MODEL EXISTS
        # ---------------------------------------------

        model_path = Path(model_path)

        if not model_path.exists():

            raise FileNotFoundError(

                f"\n\n"
                f"Model not found:\n"
                f"{model_path}\n\n"
                f"Train the model first using:\n"
                f"python -m scripts.train_online_kmeans\n"
            )

        # ---------------------------------------------
        # BUILD SCALER
        # ---------------------------------------------

        self.scaler = build_scaler(
            self.normalization_mode
        )

        # ---------------------------------------------
        # LOAD MODEL
        # ---------------------------------------------

        self.model = joblib.load(
            model_path
        )

        # ---------------------------------------------
        # FEATURE DIMENSION
        # ---------------------------------------------

        self.expected_features = (

            self.model
            .cluster_centers_
            .shape[1]
        )

        # ---------------------------------------------
        # DEBUG
        # ---------------------------------------------

        print("\n")

        print("=" * 60)

        print(
            "ONLINE CLUSTER ENGINE INITIALIZED"
        )

        print("=" * 60)

        print(
            f"Normalization Mode: "
            f"{self.normalization_mode}"
        )

        print(
            f"Model Path: "
            f"{model_path}"
        )

        print(
            f"Expected Features: "
            f"{self.expected_features}"
        )

        print("\n")

    # =================================================
    # FEATURE VECTOR
    # =====================================================

    def build_vector(

        self,

        state,
    ):

        vector = np.array([

            state.flow,

            state.imbalance_l1,

            state.imbalance_l2,

            state.HV,

            state.I1,

            state.I2,

            state.I3,

            state.spread,

        ]).reshape(1, -1)

        return vector

    # =================================================
    # PREDICT
    # =====================================================

    def predict(

        self,

        state,
    ):

        # ---------------------------------------------
        # BUILD VECTOR
        # ---------------------------------------------

        vector = self.build_vector(
            state
        )

        # ---------------------------------------------
        # NORMALIZE
        # ---------------------------------------------

        scaled = self.scaler.transform(

            vector,

            state.symbol
        )

        # ---------------------------------------------
        # DIMENSION CHECK
        # ---------------------------------------------

        actual_features = scaled.shape[1]

        if actual_features != self.expected_features:

            raise ValueError(

                f"\n\n"
                f"Feature mismatch detected.\n\n"
                f"Model expects: "
                f"{self.expected_features} features\n"
                f"Received: "
                f"{actual_features} features\n\n"
                f"Likely cause:\n"
                f"- normalization_mode changed\n"
                f"- model not retrained\n\n"
                f"Current mode: "
                f"{self.normalization_mode}\n"
            )

        # ---------------------------------------------
        # PREDICT
        # ---------------------------------------------

        cluster = self.model.predict(
            scaled
        )[0]

        # ---------------------------------------------
        # RETURN
        # ---------------------------------------------

        return int(cluster)