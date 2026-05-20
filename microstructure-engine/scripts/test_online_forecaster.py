from market_engine.online.online_forecaster import (
    OnlineForecaster
)


# =====================================================
# TEST
# =====================================================

forecaster = OnlineForecaster()

cluster = 5

result = forecaster.signal(
    cluster
)

print("\n")

print("=" * 70)

print("ONLINE FORECAST")

print("=" * 70)

for k, v in result.items():

    print(
        f"{k}: {v}"
    )