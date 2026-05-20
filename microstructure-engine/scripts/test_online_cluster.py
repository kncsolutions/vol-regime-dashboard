from market_engine.online.online_cluster import (
    OnlineClusterEngine
)


# =====================================================
# MOCK STATE
# =====================================================

class MockState:

    flow = 150000

    imbalance_l1 = 0.25

    imbalance_l2 = 0.18

    HV = 0.004

    I1 = 0.12

    I2 = 0.03

    I3 = -0.01

    spread = 0.25


# =====================================================
# MAIN
# =====================================================

engine = OnlineClusterEngine()

state = MockState()

cluster = engine.predict(
    state
)

print("\n")

print("=" * 60)

print(
    f"Predicted Cluster: {cluster}"
)

print("=" * 60)