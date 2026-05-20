import numpy as np

from market_engine.normalization.global_scaler import (
    GlobalScaler
)

from market_engine.normalization.local_scaler import (
    LocalScaler
)


# =====================================================
# HYBRID SCALER
# =====================================================

class HybridScaler:

    # =================================================
    # INIT
    # =================================================

    def __init__(self):

        self.global_scaler = (
            GlobalScaler()
        )

        self.local_scaler = (
            LocalScaler()
        )

    # =================================================
    # TRANSFORM
    # =================================================

    def transform(

        self,

        vector,

        symbol
    ):

        # ---------------------------------------------
        # GLOBAL
        # ---------------------------------------------

        global_vec = (
            self.global_scaler.transform(
                vector
            )
        )

        # ---------------------------------------------
        # LOCAL
        # ---------------------------------------------

        local_vec = (
            self.local_scaler.transform(

                vector,

                symbol
            )
        )

        # ---------------------------------------------
        # CONCAT
        # ---------------------------------------------

        combined = np.concatenate([

            global_vec.flatten(),

            local_vec.flatten()

        ])

        return combined.reshape(1, -1)