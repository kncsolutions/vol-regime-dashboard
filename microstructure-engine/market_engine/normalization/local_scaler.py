from collections import defaultdict, deque
import numpy as np


# =====================================================
# LOCAL SCALER
# =====================================================

class LocalScaler:

    # =================================================
    # INIT
    # =================================================

    def __init__(

        self,

        window=500
    ):

        self.window = window

        self.history = defaultdict(

            lambda: deque(
                maxlen=window
            )
        )

    # =================================================
    # UPDATE
    # =================================================

    def update(

        self,

        symbol,

        vector
    ):

        self.history[symbol].append(
            vector.flatten()
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
        # UPDATE
        # ---------------------------------------------

        self.update(

            symbol,

            vector
        )

        history = np.array(
            self.history[symbol]
        )

        # ---------------------------------------------
        # EARLY
        # ---------------------------------------------

        if len(history) < 10:

            return vector

        # ---------------------------------------------
        # STATS
        # ---------------------------------------------

        mu = history.mean(axis=0)

        sigma = history.std(axis=0)

        sigma[sigma < 1e-8] = 1e-8

        # ---------------------------------------------
        # ZSCORE
        # ---------------------------------------------

        z = (

            vector.flatten()
            - mu
        ) / sigma

        return z.reshape(1, -1)