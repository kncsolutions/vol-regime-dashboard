import numpy as np
import pandas as pd


class RiskEngine:

    def __init__(
        self,
        max_position=1.0,
        max_step=0.5,
        vol_target=0.02,
        dd_limit=0.05,
        capital=1.0,
        leverage=5.0,
        min_size=0.05,
        min_hold=5  # 🔥 NEW
    ):
        self.max_position = max_position
        self.max_step = max_step
        self.vol_target = vol_target
        self.dd_limit = dd_limit
        self.capital = capital
        self.leverage = leverage
        self.min_size = min_size
        self.min_hold = min_hold

    # =====================================================
    # VOLATILITY SCALING
    # =====================================================
    def vol_scale(self, row):
        iv = abs(row.get("IV_change_norm", 0.0))
        spread = abs(row.get("spread_norm", 0.0))
        vol = iv + spread

        if vol <= 0:
            return 1.0

        scale = self.vol_target / vol
        return float(min(scale, 1.0))

    # =====================================================
    # DIRECTION FROM SIGNAL (aligned with your engine)
    # =====================================================
    def signal_direction(self, signal):
        if signal in ("LONG_TREND", "REVERSAL_LONG"):
            return 1
        if signal in ("SHORT_TREND", "REVERSAL_SHORT"):
            return -1
        return 0

    # =====================================================
    # RAW TARGET (no clipping here)
    # =====================================================
    def compute_raw_target(self, row):
        signal = row["signal"]

        # hard flat
        if signal == "WAIT":
            return 0.0

        direction = self.signal_direction(signal)
        base_size = float(row.get("position_size", 0.0))

        # filter micro trades
        if base_size < self.min_size or direction == 0:
            return 0.0

        vol_adj = self.vol_scale(row)

        # leverage applied here
        return direction * base_size * vol_adj * self.leverage

    # =====================================================
    # POSITION SMOOTHING (rate limiter)
    # =====================================================
    def smooth_position(self, prev_pos, target_pos):
        delta = target_pos - prev_pos

        if abs(delta) > self.max_step:
            delta = np.sign(delta) * self.max_step

        return prev_pos + delta

    # =====================================================
    # PNL UPDATE (uses previous position)
    # =====================================================
    def update_pnl(self, prev_price, curr_price, prev_position):
        if prev_price is None:
            return 0.0

        ret = (curr_price - prev_price) / prev_price
        return prev_position * ret

    # =====================================================
    # APPLY ENGINE
    # =====================================================
    def apply(self, df):
        df = df.copy()

        positions = []
        pnls = []
        capital_curve = []

        prev_pos = 0.0
        prev_price = None
        capital = float(self.capital)
        peak_capital = capital

        holding_time = 0  # 🔥 NEW

        for i in range(len(df)):
            row = df.iloc[i]

            # ----------------------------
            # 1. raw target
            # ----------------------------
            raw_target = self.compute_raw_target(row)

            # ----------------------------
            # 2. smooth
            # ----------------------------
            pos = self.smooth_position(prev_pos, raw_target)

            # ----------------------------
            # 3. HOLDING LOGIC (🔥 KEY FIX)
            # ----------------------------
            if row["signal"] == "REVERSAL_LONG":
                min_hold = 8  # 🔥 let reversals breathe

            elif row["signal"] == "LONG_TREND":
                min_hold = 3  # quick trades

            else:
                min_hold = 0
            if prev_pos != 0:
                holding_time += 1
            else:
                holding_time = 0

            # enforce minimum hold
            if prev_pos != 0 and holding_time < min_hold:

                # only hold if signal still supports position
                curr_signal = row["signal"]
                direction = self.signal_direction(curr_signal)

                if direction == np.sign(prev_pos):
                    pos = prev_pos
                # else: allow exit

            # ----------------------------
            # 4. WAIT → flat (after hold constraint)
            # ----------------------------
            if row["signal"] == "WAIT" and holding_time >= self.min_hold:
                pos = 0.0

            # ----------------------------
            # 5. clip
            # ----------------------------
            pos = float(np.clip(pos, -self.max_position, self.max_position))

            # ----------------------------
            # 6. pnl
            # ----------------------------
            price = row["ltp"]
            step_pnl = self.update_pnl(prev_price, price, prev_pos)

            capital += step_pnl

            # ----------------------------
            # 7. drawdown control
            # ----------------------------
            peak_capital = max(peak_capital, capital)
            drawdown = (peak_capital - capital) / peak_capital

            if drawdown > self.dd_limit:
                pos = 0.0
                holding_time = 0  # reset

            # ----------------------------
            # store
            # ----------------------------
            positions.append(pos)
            pnls.append(step_pnl)
            capital_curve.append(capital)

            # ----------------------------
            # update
            # ----------------------------
            prev_pos = pos
            prev_price = price

        df["position"] = positions
        df["pnl"] = pnls
        df["capital"] = capital_curve

        return df