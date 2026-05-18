import numpy as np


class HistoricalAnalyzer:

    def __init__(self):

        pass

    # =====================================================
    # MAIN LOCAL ANALYSIS
    # =====================================================
    def analyze(self, history_matrix):

        if len(history_matrix) < 5:

            return self._empty_result()

        # ---------------------------------------------
        # Returns
        # ---------------------------------------------
        returns = np.diff(
            history_matrix[:, 0]
        )

        # ---------------------------------------------
        # Local Statistics
        # ---------------------------------------------
        local_volatility = np.std(returns)

        drift_bias = np.mean(returns)

        trend_strength = np.mean(
            np.sign(returns)
        )

        # ---------------------------------------------
        # Stability
        # ---------------------------------------------
        stability_score = 1 / (
            1 + local_volatility
        )

        # ---------------------------------------------
        # Momentum Persistence
        # ---------------------------------------------
        positive_moves = np.sum(
            returns > 0
        )

        negative_moves = np.sum(
            returns < 0
        )

        total_moves = max(
            positive_moves + negative_moves,
            1
        )

        flow_persistence = abs(
            positive_moves - negative_moves
        ) / total_moves

        # ---------------------------------------------
        # Final State
        # ---------------------------------------------
        return {
            "drift_bias": drift_bias,
            "local_volatility": local_volatility,
            "trend_strength": trend_strength,
            "stability_score": stability_score,
            "flow_persistence": flow_persistence
        }

    # =====================================================
    # EMPTY RESULT
    # =====================================================
    def _empty_result(self):

        return {
            "drift_bias": 0.0,
            "local_volatility": 0.0,
            "trend_strength": 0.0,
            "stability_score": 1.0,
            "flow_persistence": 0.0
        }