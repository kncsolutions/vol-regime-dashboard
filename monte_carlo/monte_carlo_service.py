import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
# --- Engine imports ---
from monte_carlo.backend.engine.calibration.drift import DriftEstimator
from monte_carlo.backend.engine.calibration.covariance import CovarianceEstimator
from monte_carlo.backend.engine.calibration.dt_model import DTModel
from monte_carlo.backend.engine.core.stochastic import StochasticProcess
from monte_carlo.backend.engine.models.impact_linear import ImpactModel

# --- Local imports ---
from monte_carlo.path_generator import PathGenerator
from monte_carlo.engine import MonteCarloEngine
from monte_carlo.distribution import DistributionAnalyzer


# --- Base state features ---
BASE_FEATURES = [
    'IV', 'callSkew', 'putSkew',
    'netGEX', 'I1', 'I2', 'I3'
]


class MonteCarloService:

    def run(self, df: pd.DataFrame):

        df = df.copy()

        # ==============================
        # 1. Time Handling
        # ==============================
        if 'time' not in df.columns:
            raise ValueError("Missing 'time' column")

        df['time'] = pd.to_datetime(df['time'], unit='ms')
        df = df.sort_values('time').reset_index(drop=True)

        # ==============================
        # 2. dt computation (robust)
        # ==============================
        df['dt'] = df['time'].diff().dt.total_seconds()

        # remove bad values
        df['dt'] = df['dt'].replace([0, np.inf, -np.inf], np.nan)

        median_dt = df['dt'].iloc[1:].median()
        if np.isnan(median_dt):
            median_dt = 1.0

        df['dt'] = df['dt'].fillna(median_dt)

        # ==============================
        # 3. Price handling
        # ==============================
        if 'ltp' not in df.columns:
            raise ValueError("Missing 'ltp' column")

        df['price'] = df['ltp']

        # ==============================
        # 4. Feature Engineering (KEY UPGRADE)
        # ==============================
        df = self._build_features(df)

        FEATURES = [
            'f1','f2','f3','f4','f5','f6','f7'
        ]

        # ==============================
        # 5. Validate required columns
        # ==============================
        required_cols = FEATURES + ['dS']

        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        # ==============================
        # 6. Prepare matrices
        # ==============================
        X = df[FEATURES].values
        dt = df['dt'].values[1:]
        df['ret'] = df['dS'] / df['price'].shift(1)
        df['ret'] = df['ret'].replace([np.inf, -np.inf], 0).fillna(0)

        Y = df['ret'].values

        # ==============================
        # 7. Calibration
        # ==============================
        mu = DriftEstimator().fit(X, dt)
        Sigma = CovarianceEstimator().fit(X, mu, dt)

        # ==============================
        # 8. Impact Model (FAST RIDGE)
        # ==============================
        impact = ImpactModel(alpha=5.0)  # stronger regularization

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        impact.fit(X_scaled[1:], Y[1:])

        # impact.fit(X[1:], Y[1:])

        # ==============================
        # 9. dt model
        # ==============================
        dt_model = DTModel()
        dt_model.fit(dt)

        # ==============================
        # 10. Simulation engine
        # ==============================
        process = StochasticProcess(mu, Sigma)
        generator = PathGenerator(process, impact, dt_model, scaler)
        mc_engine = MonteCarloEngine(generator, n_paths=200)

        # ==============================
        # 11. Initial state
        # ==============================
        X0 = X[-1]
        S0 = df['price'].iloc[-1]

        # ==============================
        # 12. Run simulation
        # ==============================
        gamma_flip = df['gammaFlip'].iloc[-1]

        paths, dt_paths, stats = mc_engine.run_until_converged(
            X0,
            S0,
            steps=6000,
            gamma_flip=gamma_flip,
            tol=0.01,  # 1% tolerance
            max_paths=20000,
            min_paths=1000
        )

        # ==============================
        # 13. Output
        # ==============================
        return paths, dt_paths
        return DistributionAnalyzer().summarize(paths)

    # ==============================
    # Feature Engineering (IMPORTANT)
    # ==============================
    def _build_features(self, df: pd.DataFrame):

        df = df.copy()

        # base signals
        df['f1'] = df['I1']
        df['f2'] = df['I2']
        df['f3'] = df['netGEX']

        # nonlinear interactions (alpha boost)
        df['f4'] = df['I1'] * df['netGEX']
        df['f5'] = df['I2'] * np.abs(df['netGEX'])
        df['f6'] = df['callSkew'] - df['putSkew']
        df['f7'] = df['IV'] * df['I2']

        return df