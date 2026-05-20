from market_engine.storage.feature_aggregator import (
    FeatureAggregator
)


class AggregatorRegistry:

    def __init__(self):

        self.aggregators = {}

    # =========================================
    # GET AGGREGATOR
    # =========================================

    def get(self, symbol):

        if symbol not in self.aggregators:

            self.aggregators[symbol] = (
                FeatureAggregator()
            )

        return self.aggregators[symbol]

    # =========================================
    # ALL
    # =========================================

    def all(self):

        return self.aggregators