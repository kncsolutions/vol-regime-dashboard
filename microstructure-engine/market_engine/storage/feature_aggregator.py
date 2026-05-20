from collections import deque
import numpy as np
import time


class FeatureAggregator:

    def __init__(

        self,

        window=200,

        min_ticks=25,

        flush_timeout=15,
    ):

        self.window = window

        self.min_ticks = min_ticks

        self.flush_timeout = flush_timeout

        # =========================================
        # TIMING
        # =========================================

        self.last_flush = time.time()

        self.tick_count = 0

        # =========================================
        # FEATURE BUFFERS
        # =========================================

        self.ltp = deque(maxlen=window)

        self.flow = deque(maxlen=window)

        self.microprice = deque(maxlen=window)

        self.spread = deque(maxlen=window)

        self.imbalance_l1 = deque(maxlen=window)

        self.imbalance_l2 = deque(maxlen=window)

        self.ds = deque(maxlen=window)

        self.hv = deque(maxlen=window)

        self.i1 = deque(maxlen=window)

        self.i2 = deque(maxlen=window)

        self.i3 = deque(maxlen=window)

    # =================================================
    # UPDATE
    # =================================================

    def update(self, state):

        self.tick_count += 1

        self.ltp.append(state.ltp)

        self.flow.append(state.flow)

        self.microprice.append(
            state.microprice
        )

        self.spread.append(state.spread)

        self.imbalance_l1.append(
            state.imbalance_l1
        )

        self.imbalance_l2.append(
            state.imbalance_l2
        )

        self.ds.append(state.dS)

        self.hv.append(state.HV)

        self.i1.append(state.I1)

        self.i2.append(state.I2)

        self.i3.append(state.I3)

    # =================================================
    # SAFE MEAN
    # =================================================

    def mean(self, arr):

        if len(arr) == 0:

            return 0.0

        return float(np.mean(arr))

    # =================================================
    # SHOULD FLUSH
    # =================================================

    def should_flush(self):

        now = time.time()

        elapsed = now - self.last_flush

        # -----------------------------------------
        # ACTIVE SYMBOL
        # -----------------------------------------

        if self.tick_count >= self.min_ticks:

            return True

        # -----------------------------------------
        # INACTIVE SYMBOL
        # -----------------------------------------

        if elapsed >= self.flush_timeout:

            return True

        return False

    # =================================================
    # SNAPSHOT
    # =================================================

    def snapshot(self, symbol, timestamp):

        return {

            # -------------------------------------
            # META
            # -------------------------------------

            "time": timestamp,

            "symbol": symbol,

            "samples": self.tick_count,

            # -------------------------------------
            # PRICE
            # -------------------------------------

            "ltp_avg": self.mean(
                self.ltp
            ),

            "microprice_avg": self.mean(
                self.microprice
            ),

            "spread_avg": self.mean(
                self.spread
            ),

            # -------------------------------------
            # FLOW
            # -------------------------------------

            "flow_avg": self.mean(
                self.flow
            ),

            # -------------------------------------
            # IMBALANCE
            # -------------------------------------

            "imbalance_l1_avg": self.mean(
                self.imbalance_l1
            ),

            "imbalance_l2_avg": self.mean(
                self.imbalance_l2
            ),

            # -------------------------------------
            # RETURNS
            # -------------------------------------

            "dS_avg": self.mean(
                self.ds
            ),

            "HV_avg": self.mean(
                self.hv
            ),

            # -------------------------------------
            # INVENTORY DYNAMICS
            # -------------------------------------

            "I1_avg": self.mean(
                self.i1
            ),

            "I2_avg": self.mean(
                self.i2
            ),

            "I3_avg": self.mean(
                self.i3
            ),
        }

    # =================================================
    # RESET FLUSH STATE
    # =================================================

    def mark_flushed(self):

        self.last_flush = time.time()

        self.tick_count = 0