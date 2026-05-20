import joblib
import numpy as np


# =====================================================
# GLOBAL SCALER
# =====================================================

class GlobalScaler:

    def __init__(

        self,

        scaler_path="data/models/scaler.pkl"
    ):

        self.scaler = joblib.load(
            scaler_path
        )

    # =================================================
    # TRANSFORM
    # =================================================

    def transform(

        self,

        vector,

        symbol=None,
    ):

        return self.scaler.transform(
            vector
        )