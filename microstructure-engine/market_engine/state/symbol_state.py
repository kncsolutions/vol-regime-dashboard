from collections import deque
import numpy as np
from market_engine.features.inventory_dynamics import (
    I1Engine,
    I2Engine,
    I3Engine,
)

class SymbolState:

    def __init__(self, symbol, window=256):

        # =================================================
        # IDENTITY
        # =================================================

        self.symbol = symbol

        # =================================================
        # TIME
        # =================================================

        self.time_readable = ""

        self.time = 0.0

        # =================================================
        # PRICE STATE
        # =================================================

        self.ltp = 0.0

        self.previous_ltp = 0.0

        self.best_bid = 0.0

        self.best_ask = 0.0

        self.microprice = 0.0

        self.spread = 0.0

        # =================================================
        # ORDER FLOW / LIQUIDITY
        # =================================================

        self.ofi = 0.0

        self.flow = 0.0

        self.ltq = 0.0

        # =================================================
        # IMBALANCE
        # =================================================

        self.imbalance_l1 = 0.0

        self.imbalance_l2 = 0.0

        # =================================================
        # PRICE DYNAMICS
        # =================================================

        self.dS = 0.0

        self.log_return = 0.0

        self.HV = 0.0

        # =================================================
        # INVENTORY / PRESSURE PROXIES
        # =================================================
        self.i1_engine = I1Engine()

        self.i2_engine = I2Engine()

        self.i3_engine = I3Engine()

        self.I1 = 0.0

        self.I2 = 0.0

        self.I3 = 0.0

        # =================================================
        # ONLINE INFERENCE
        # =================================================

        self.cluster = -1

        self.entropy = 0.0

        self.confidence = 0.0

        self.expected_return = 0.0

        self.forecast_score = 0.0

        self.signal = "NEUTRAL"

        self.next_state_probs = {}

        # =================================================
        # PERSISTENCE TRACKING
        # =================================================

        self.dwell_time = 0

        self.transition_count = 0

        self.previous_cluster = -1

        self.entropy_trend = 0.0

        self.metastable = False

        self.unstable = False

        self.trapping_score = 0.0

        self.semantic_signal = (
            "NEUTRAL MICROSTRUCTURE"
        )

        # =================================================
        # STATE WINDOWS
        # =================================================

        self.returns_window = deque(
            maxlen=window
        )



        # =================================================
        # REGIME / SIGNAL
        # =================================================

        self.cluster = -1

        self.signal = "NEUTRAL"

    # =====================================================
    # PRICE UPDATE
    # =====================================================

    def update_price(self, ltp):

        # ---------------------------------------------
        # FIRST TICK INITIALIZATION
        # ---------------------------------------------

        if self.ltp == 0:

            self.ltp = ltp

            self.previous_ltp = ltp

            self.dS = 0.0

            self.log_return = 0.0

            return

        # ---------------------------------------------
        # UPDATE
        # ---------------------------------------------

        self.previous_ltp = self.ltp

        self.ltp = ltp

        # ---------------------------------------------
        # PRICE CHANGE
        # ---------------------------------------------

        self.dS = (

            self.ltp
            -
            self.previous_ltp
        )

        # ---------------------------------------------
        # LOG RETURN
        # ---------------------------------------------

        if self.previous_ltp > 0:

            self.log_return = np.log(

                self.ltp
                /
                self.previous_ltp
            )

            self.returns_window.append(
                self.log_return
            )

        # ---------------------------------------------
        # UPDATE HV
        # ---------------------------------------------

        self.compute_hv()

    # =====================================================
    # LIQUIDITY UPDATE
    # =====================================================

    def update_liquidity(

        self,

        best_bid,
        best_ask,

        spread,

        microprice,

        imbalance_l1,
        imbalance_l2,
    ):

        # ---------------------------------------------
        # BEST LEVELS
        # ---------------------------------------------

        self.best_bid = best_bid

        self.best_ask = best_ask

        # ---------------------------------------------
        # MICROSTRUCTURE
        # ---------------------------------------------

        self.spread = spread

        self.microprice = microprice

        # ---------------------------------------------
        # IMBALANCE
        # ---------------------------------------------

        self.imbalance_l1 = imbalance_l1

        self.imbalance_l2 = imbalance_l2

        # ---------------------------------------------
        # OFI APPROXIMATION
        # ---------------------------------------------

        self.ofi = imbalance_l2

    # =====================================================
    # FLOW UPDATE
    # =====================================================

    def update_flow(

        self,

        ltq,
    ):

        self.ltq = ltq

        # ---------------------------------------------
        # FLOW = OFI × LTQ
        # ---------------------------------------------

        self.flow = (

            self.ofi
            *
            self.ltq
        )



    # =====================================================
    # HISTORICAL VOLATILITY
    # =====================================================

    def compute_hv(self):

        if len(self.returns_window) < 2:

            self.HV = 0.0

            return

        # ---------------------------------------------
        # REALIZED VOLATILITY
        # ---------------------------------------------

        self.HV = (

            np.std(
                self.returns_window
            )

            *

            np.sqrt(256)
        )

    # =====================================================
    # INVENTORY PROXIES
    # =====================================================

    def update_inventory_dynamics(self):

        self.I1 = self.i1_engine.update(

            self.flow,

            self.log_return
        )

        self.I2 = self.i2_engine.update(
            self.I1
        )

        self.I3 = self.i3_engine.update(
            self.I1
        )

    # =====================================================
    # SNAPSHOT
    # =====================================================

    def snapshot(self):

        return {

            # =========================================
            # TIME
            # =========================================

            "time_readable": self.time_readable,

            "time": self.time,

            # =========================================
            # PRICE
            # =========================================

            "ltp": self.ltp,

            "best_bid": self.best_bid,

            "best_ask": self.best_ask,

            "microprice": self.microprice,

            "spread": self.spread,

            # =========================================
            # LIQUIDITY
            # =========================================

            "ofi": self.ofi,

            "flow": self.flow,

            "ltq": self.ltq,

            # =========================================
            # IMBALANCE
            # =========================================

            "imbalance_l1": self.imbalance_l1,

            "imbalance_l2": self.imbalance_l2,

            # =========================================
            # PRICE DYNAMICS
            # =========================================

            "dS": self.dS,

            "log_return": self.log_return,

            "HV": self.HV,

            # =========================================
            # INVENTORY
            # =========================================

            "I1": self.I1,

            "I2": self.I2,

            "I3": self.I3,

            # =========================================
            # REGIME
            # =========================================

            "cluster": self.cluster,

            "signal": self.signal,

            # =========================================
            # SYMBOL
            # =========================================

            "symbol": self.symbol,
        }