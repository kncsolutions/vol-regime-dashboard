import numpy as np


class PathGenerator:

    def __init__(self, process, impact_model, dt_model, scaler):
        self.process = process
        self.impact = impact_model
        self.dt_model = dt_model
        self.scaler = scaler

    def generate(self, X0, S0, steps, gamma_flip):

        X = X0.copy()
        S = S0

        path = np.zeros(steps)
        dt_path = np.zeros(steps)

        anchor = S0

        # initial regime
        regime = self._get_regime(X)

        for i in range(steps):

            # ============================
            # 1. Time step
            # ============================
            dt = self.dt_model.sample()
            dt = min(dt, 5.0)

            # ============================
            # 2. Evolve features
            # ============================
            X = self.process.step(X, dt)

            # ============================
            # 3. Scale features
            # ============================
            X_scaled = self.scaler.transform(X.reshape(1, -1))[0]

            # ============================
            # 4. Base return prediction
            # ============================
            ret = self.impact.predict(X_scaled)

            # ============================
            # 5. Gamma Flip Transition
            # ============================
            flip_prob = self._flip_probability(S, gamma_flip)

            # probabilistic regime switching
            if np.random.rand() < flip_prob:
                regime = "short_gamma" if regime == "long_gamma" else "long_gamma"

            # ============================
            # 6. Regime-specific dynamics
            # ============================
            if regime == "long_gamma":

                # low volatility
                vol = 0.001 + 0.0003 * abs(X[1])

                # tight clipping
                ret = np.clip(ret, -2 * vol, 2 * vol)

                # strong mean reversion
                ret += -0.02 * (S - anchor) / anchor

            else:

                # higher volatility
                vol = 0.002 + 0.001 * abs(X[1])

                # wider clipping
                ret = np.clip(ret, -4 * vol, 4 * vol)

                # weak mean reversion
                ret += -0.005 * (S - anchor) / anchor

                # trend persistence
                ret += 0.2 * ret

            # ============================
            # 7. Occasional shock
            # ============================
            if np.random.rand() < 0.01:
                ret += np.random.normal(0, vol)

            # ============================
            # 8. Price update
            # ============================
            S = S * (1 + ret)

            path[i] = S
            dt_path[i] = dt

        return path, dt_path

    # ============================
    # Regime detection (initial)
    # ============================
    def _get_regime(self, X):
        netGEX = X[2]  # ensure correct index for your feature set
        return "long_gamma" if netGEX > 0 else "short_gamma"

    # ============================
    # Gamma flip probability
    # ============================
    def _flip_probability(self, S, flip, scale=50):
        """
        Higher probability near gamma flip level
        """
        distance = abs(S - flip)
        return np.exp(-distance / scale)