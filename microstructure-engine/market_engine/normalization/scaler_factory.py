from market_engine.normalization.global_scaler import (
    GlobalScaler
)

from market_engine.normalization.local_scaler import (
    LocalScaler
)

from market_engine.normalization.hybrid_scaler import (
    HybridScaler
)


# =====================================================
# FACTORY
# =====================================================

def build_scaler(mode):

    if mode == "global":

        return GlobalScaler()

    elif mode == "local":

        return LocalScaler()

    elif mode == "hybrid":

        return HybridScaler()

    else:

        raise ValueError(

            f"Unknown mode: {mode}"
        )