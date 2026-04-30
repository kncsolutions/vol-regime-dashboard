from decision_layer.features.feature_builder import FeatureBuilder
import numpy as np

from decision_layer.labeling.state_labeler import apply_state_labels
from decision_layer.hmm.hmm_trainer import train_hmm_pipeline
from decision_layer.signals.regime_signal_engine_v2 import RegimeSignalEngineV2
from decision_layer.risk.risk_engine import RiskEngine
from decision_layer.evaluation.performance_analyzer import PerformanceAnalyzer
from decision_layer.evaluation.trade_analyzer import TradeAnalyzer
# =========================================================
# FEATURE BUILDING
# =========================================================
fb = FeatureBuilder(window=50)

fb_result = fb.run("backend/training_data/NIFTY.csv")

X = fb_result["X"]
df = fb_result["df"]
features = fb_result["features"]

# ----------------------------
# Labeling (weak prior)
# ----------------------------
df = apply_state_labels(df)

# =========================================================
# FEATURE DIAGNOSTICS
# =========================================================
print("\n=== FEATURE DIAGNOSTICS ===")
print("X shape:", X.shape)
print("Features:", features)

stds = np.std(X, axis=0)
print("Min std:", stds.min())
print("Max std:", stds.max())
print(list(zip(features, stds)))

print(df.tail())

# =========================================================
# HMM TRAINING
# =========================================================
hmm_result = train_hmm_pipeline(X, features, df)

df = hmm_result["df"]
hmm_model = hmm_result["model"]   # IMPORTANT
# hmm_model = hmm_result["model"].model
print("\n=== HMM OUTPUT ===")
print(df[["state_name", "hmm_state"]].tail(20))

# =========================================================
# SIGNAL ENGINE V2
# =========================================================
signal_engine = RegimeSignalEngineV2()

df = signal_engine.apply(df, hmm_model)

print("\n=== SIGNAL OUTPUT ===")
print(df[[
    "hmm_state",
    "signal",
    "confidence",
    "strength",
    "vol_adj",
    "position_size"
]].tail(20))

# =========================================================
# RISK ENGINE
# =========================================================
risk_engine = RiskEngine()

df = risk_engine.apply(df)

print("\n=== FINAL OUTPUT ===")
print(df[[
    "signal",
    "position_size",
    "position",
    "pnl",
    "capital"
]].tail(20))


analyzer = PerformanceAnalyzer()

report, df = analyzer.analyze(df)


print("\n=== PERFORMANCE REPORT ===")
print("Sharpe:", report["sharpe"])
print("Max Drawdown:", report["max_drawdown"])
print("Win Rate:", report["win_rate"])
print("Profit Factor:", report["profit_factor"])
print("Final Return:", report["final_return"])

print("\n=== REGIME PERFORMANCE ===")
print(report["regime_performance"])

print("\n=== SIGNAL PERFORMANCE ===")
print(report["signal_performance"])

analyzer = TradeAnalyzer()

trade_report = analyzer.analyze(df)

print("\n=== TRADE SUMMARY ===")
print(trade_report["summary"])

print("\n=== HOLDING TIME ===")
print(trade_report["holding"])

print("\n=== PNL BY DURATION ===")
print(trade_report["duration_pnl"])

print("\n=== SIGNAL TRADE PERFORMANCE ===")
print(trade_report["signal_trade_performance"])