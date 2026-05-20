from collections import deque
import numpy as np


# =====================================================
# I1 ENGINE
# =====================================================

class I1Engine:

    def __init__(self, window=50):

        self.window = window

        self.flow = deque(maxlen=window)

        self.returns = deque(maxlen=window)

    # =================================================
    # UPDATE
    # =================================================

    def update(self, flow, ret):

        # ---------------------------------------------
        # APPEND
        # ---------------------------------------------

        self.flow.append(flow)

        self.returns.append(ret)

        # ---------------------------------------------
        # SUFFICIENT DATA
        # ---------------------------------------------

        if len(self.flow) < 5:

            return 0.0

        # ---------------------------------------------
        # ARRAYS
        # ---------------------------------------------

        flow_arr = np.array(
            self.flow,
            dtype=np.float64
        )

        ret_arr = np.array(
            self.returns,
            dtype=np.float64
        )

        # ---------------------------------------------
        # VALID FILTER
        # ---------------------------------------------

        valid = (

            np.isfinite(flow_arr)

            &

            np.isfinite(ret_arr)
        )

        flow_arr = flow_arr[valid]

        ret_arr = ret_arr[valid]

        if len(flow_arr) < 5:

            return 0.0

        # ---------------------------------------------
        # STANDARDIZATION
        # ---------------------------------------------

        mean_flow = np.mean(flow_arr)

        mean_ret = np.mean(ret_arr)

        std_flow = np.std(flow_arr)

        std_ret = np.std(ret_arr)

        # ---------------------------------------------
        # NUMERICAL STABILITY
        # ---------------------------------------------

        std_flow = max(std_flow, 1e-8)

        std_ret = max(std_ret, 1e-8)

        # ---------------------------------------------
        # CURRENT VALUES
        # ---------------------------------------------

        curr_flow = flow_arr[-1]

        curr_ret = ret_arr[-1]

        # ---------------------------------------------
        # Z-SCORES
        # ---------------------------------------------

        z_flow = (

            curr_flow
            -
            mean_flow

        ) / std_flow

        z_ret = (

            curr_ret
            -
            mean_ret

        ) / std_ret

        # ---------------------------------------------
        # INVENTORY PRESSURE
        # ---------------------------------------------

        I1 = z_flow - z_ret

        return float(I1)


# =====================================================
# I2 ENGINE
# =====================================================

class I2Engine:

    def __init__(self):

        self.prev_I1 = None

    def update(self, I1):

        if self.prev_I1 is None:

            self.prev_I1 = I1

            return 0.0

        I2 = I1 - self.prev_I1

        self.prev_I1 = I1

        return float(I2)


# =====================================================
# I3 ENGINE
# =====================================================

class I3Engine:

    def __init__(self):

        self.prev_I2 = None

        self.prev_I1 = None

    def update(self, I1):

        # ---------------------------------------------
        # FIRST VALUE
        # ---------------------------------------------

        if self.prev_I1 is None:

            self.prev_I1 = I1

            return 0.0

        # ---------------------------------------------
        # FIRST DERIVATIVE
        # ---------------------------------------------

        I2 = I1 - self.prev_I1

        # ---------------------------------------------
        # SECOND DERIVATIVE INIT
        # ---------------------------------------------

        if self.prev_I2 is None:

            self.prev_I2 = I2

            self.prev_I1 = I1

            return 0.0

        # ---------------------------------------------
        # SECOND DERIVATIVE
        # ---------------------------------------------

        I3 = I2 - self.prev_I2

        # ---------------------------------------------
        # UPDATE STATE
        # ---------------------------------------------

        self.prev_I2 = I2

        self.prev_I1 = I1

        return float(I3)