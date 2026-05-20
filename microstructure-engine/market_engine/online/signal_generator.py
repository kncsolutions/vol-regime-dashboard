# =====================================================
# REGIME-AWARE SIGNAL GENERATOR
# =====================================================

class SignalGenerator:

    # =================================================
    # GENERATE
    # =================================================

    def generate(

        self,

        state
    ):

        # ---------------------------------------------
        # SHORTCUTS
        # ---------------------------------------------

        score = state.forecast_score

        entropy = state.entropy

        dwell = state.dwell_time

        hv = state.HV

        flow = state.flow

        metastable = state.metastable

        unstable = state.unstable

        trapping = state.trapping_score

        # =================================================
        # METASTABLE REGIMES
        # =================================================

        if metastable:

            # -----------------------------------------
            # BULLISH TRAP
            # -----------------------------------------

            if score > 0:

                return (
                    "METASTABLE BULLISH "
                    "ACCUMULATION"
                )

            # -----------------------------------------
            # BEARISH TRAP
            # -----------------------------------------

            elif score < 0:

                return (
                    "METASTABLE SELL PRESSURE"
                )

            # -----------------------------------------
            # SIDEWAYS
            # -----------------------------------------

            else:

                return (
                    "METASTABLE LIQUIDITY "
                    "TRAP"
                )

        # =================================================
        # UNSTABLE REGIMES
        # =================================================

        if unstable:

            # -----------------------------------------
            # NEGATIVE FLOW
            # -----------------------------------------

            if flow < 0:

                return (
                    "UNSTABLE SELL AUCTION"
                )

            # -----------------------------------------
            # POSITIVE FLOW
            # -----------------------------------------

            else:

                return (
                    "UNSTABLE BUY AUCTION"
                )

        # =================================================
        # TRENDING REGIMES
        # =================================================

        if score > 0.005:

            if entropy < 1.5:

                return (
                    "STABLE BULL TREND"
                )

            else:

                return (
                    "WEAK BULLISH DRIFT"
                )

        if score < -0.005:

            if entropy < 1.5:

                return (
                    "STABLE BEAR TREND"
                )

            else:

                return (
                    "WEAK BEARISH DRIFT"
                )

        # =================================================
        # VOLATILITY EXPANSION
        # =================================================

        if hv > 0.01:

            return (
                "VOLATILITY EXPANSION"
            )

        # =================================================
        # TRAPPING
        # =================================================

        if trapping > 5:

            return (
                "LIQUIDITY ABSORPTION"
            )

        # =================================================
        # DEFAULT
        # =================================================

        return "NEUTRAL MICROSTRUCTURE"