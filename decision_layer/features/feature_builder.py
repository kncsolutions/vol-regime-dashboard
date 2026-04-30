import pandas as pd
import numpy as np


class FeatureBuilder:
    """
    Builds HMM-ready feature matrix from snapshot CSV.
    """

    def __init__(self, window=50):
        self.window = window

    # =========================================================
    # LOAD + CLEAN
    # =========================================================
    def load_csv(self, path):
        df = pd.read_csv(path)

        df = df.rename(columns={
            "callSkew": "call_skew",
            "putSkew": "put_skew",
            "callGEX": "call_gex",
            "putGEX": "put_gex",
            "netGEX": "net_gex",
            "gammaFlip": "gamma_flip"
        })

        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.dropna()

        df = df.sort_values("time").reset_index(drop=True)

        return df

    # =========================================================
    # HELPERS
    # =========================================================
    def rolling_norm(self, series):
        denom = series.abs().rolling(self.window).mean()
        return series / (denom + 1e-6)

    def safe_sign(self, series):
        return np.sign(series)

    # =========================================================
    # FEATURE ENGINEERING
    # =========================================================
    def build_features(self, df):

        # =============================
        # 1. INSTABILITY
        # =============================
        df["I1_norm"] = df["I1"]
        df["I2_norm"] = df["I2"] * 10     # scaled
        df["I3_norm"] = df["I3"] * 10     # scaled

        # =============================
        # 2. FLOW DYNAMICS
        # =============================
        df["flow_norm"] = self.rolling_norm(df["flow"])
        df["dS_norm"]   = self.rolling_norm(df["dS"])

        df["flow_sign"] = self.safe_sign(df["flow"])
        df["dS_sign"]   = self.safe_sign(df["dS"])

        # df["flow_alignment"] = (df["flow_sign"] == df["dS_sign"]).astype(int)
        df["flow_alignment"] = np.sign(df["flow_norm"] * df["dS_norm"])
        df["flow_alignment"] = df["flow_alignment"].replace(0, -1)

        # =============================
        # 3. STRUCTURE (FLIP DISTANCE)
        # =============================
        df["flip_distance"] = ((df["ltp"] - df["gamma_flip"]) / df["ltp"]) * 100

        # =============================
        # 4. SKEW (DYNAMICS ONLY)
        # =============================
        skew_diff = df["call_skew"] - df["put_skew"]

        df["skew_change_norm"] = np.tanh(
            self.rolling_norm(skew_diff.diff())
        )

        df["skew_sign"] = np.sign(df["skew_change_norm"])

        # =============================
        # 5. INTERACTIONS (EDGE)
        # =============================
        df["flow_skew_alignment"] = df["flow_sign"] * df["skew_sign"]
        df["flow_skew_tension"] = df["flow_norm"] * df["skew_change_norm"]
        df["flow_persistence"] = df["flow_alignment"].rolling(3).mean()

        # =============================
        # 6. MICROSTRUCTURE
        # =============================
        df["micro_dev"] = ((df["microprice"] - df["ltp"]) / df["ltp"]) * 1000
        df["spread_norm"] = (df["spread"] / df["ltp"]) * 1000

        df["imbalance_norm"] = self.rolling_norm(df["imbalance"])

        # =============================
        # 7. VOLATILITY (CHANGE, NOT LEVEL)
        # =============================
        df["IV_change"] = df["IV"].diff()
        df["IV_change_norm"] = self.rolling_norm(df["IV_change"])
        df["IV_change_norm"] = np.tanh(df["IV_change_norm"])

        # =============================
        # 8. EXPANSION (NONLINEAR)
        # =============================
        raw_expansion = df["I1"] + df["I2"] * np.abs(df["flow"])

        df["expansion_strength"] = np.abs(df["flow"]) * np.abs(raw_expansion) * 100
        df["expansion_direction"] = np.sign(raw_expansion)

        # neutral zone
        threshold = 0.1

        df["expansion_direction"] = np.where(
            df["expansion_strength"] > threshold,
            1,
            np.where(df["expansion_strength"] < -threshold, -1, 0)
        )
        df["regime_intensity"] = df["flow_norm"] * df["expansion_strength"]

        # =============================
        # FINAL CLEAN
        # =============================
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.dropna().reset_index(drop=True)

        return df

    # =========================================================
    # BUILD OBSERVATION MATRIX
    # =========================================================
    def build_X(self, df):

        features = [
            # instability
            "I1_norm",
            "I2_norm",
            "I3_norm",

            # flow
            "flow_norm",
            "dS_norm",
            "flow_alignment",

            # structure
            "flip_distance",

            # skew
            "skew_change_norm",
            "flow_skew_alignment",
            "flow_skew_tension",
            "flow_persistence",

            # microstructure
            "micro_dev",
            "spread_norm",
            "imbalance_norm",

            # volatility
            "IV_change_norm",

            # nonlinear
            "expansion_strength",
            "expansion_direction",
            "regime_intensity"
        ]

        X = df[features].values

        return X, features

    # =========================================================
    # FULL PIPELINE
    # =========================================================
    def run(self, path):

        df = self.load_csv(path)
        df = self.build_features(df)
        X, features = self.build_X(df)

        # sanity check
        stds = np.std(X, axis=0)
        print("\nFeature stds:")
        for f, s in zip(features, stds):
            print(f"{f}: {round(s, 4)}")

        return {
            "df": df,
            "X": X,
            "features": features
        }