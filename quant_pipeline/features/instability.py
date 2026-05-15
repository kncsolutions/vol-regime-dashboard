from collections import deque
import numpy as np
class I1Engine:

    def __init__(self, window=50):

        from collections import deque

        self.window = window

        self.flow = deque(maxlen=window)

        self.returns = deque(maxlen=window)

    # =================================================
    # UPDATE
    # =================================================

    def update(self, flow, ret):

        import numpy as np

        # ---------------------------------------------
        # APPEND
        # ---------------------------------------------

        self.flow.append(flow)

        self.returns.append(ret)

        # ---------------------------------------------
        # USE AVAILABLE DATA
        # ---------------------------------------------

        if len(self.flow) < 2:
            return 0

        flow_arr = np.array(self.flow)

        ret_arr = np.array(self.returns)

        # ---------------------------------------------
        # REMOVE NaN / inf
        # ---------------------------------------------

        valid = (
            np.isfinite(flow_arr) &
            np.isfinite(ret_arr)
        )

        flow_arr = flow_arr[valid]

        ret_arr = ret_arr[valid]

        if len(flow_arr) < 2:
            return 0

        # ---------------------------------------------
        # STATS
        # ---------------------------------------------

        mean_flow = np.mean(flow_arr)

        mean_ret = np.mean(ret_arr)

        std_flow = np.std(flow_arr)

        std_ret = np.std(ret_arr)

        # ---------------------------------------------
        # PROTECTION
        # ---------------------------------------------

        if std_flow < 1e-8:
            std_flow = 1e-8

        if std_ret < 1e-8:
            std_ret = 1e-8

        # ---------------------------------------------
        # CURRENT
        # ---------------------------------------------

        curr_flow = flow_arr[-1]

        curr_ret = ret_arr[-1]

        z_flow = (
            curr_flow - mean_flow
        ) / std_flow

        z_ret = (
            curr_ret - mean_ret
        ) / std_ret

        # ---------------------------------------------
        # FINAL SIGNAL
        # ---------------------------------------------

        I1 = z_flow - z_ret

        return float(I1)

class I2Engine:

    def __init__(self):
        self.prev_I1 = None

    def update(self, I1):
        if self.prev_I1 is None:
            self.prev_I1 = I1

            return 0

        I2 = I1 - self.prev_I1

        self.prev_I1 = I1

        return float(I2)



class I3Engine:

    def __init__(self):

        self.prev_I1 = None
        self.prev_I2 = None

    def update(self, I1):

        if self.prev_I1 is None:

            self.prev_I1 = I1

            return 0

        I2 = I1 - self.prev_I1

        if self.prev_I2 is None:

            self.prev_I2 = I2
            self.prev_I1 = I1

            return 0

        I3 = I2 - self.prev_I2

        self.prev_I2 = I2
        self.prev_I1 = I1

        return float(I3)