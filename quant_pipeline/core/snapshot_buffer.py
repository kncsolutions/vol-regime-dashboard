# quant_pipeline/core/snapshot_buffer.py

from collections import deque
import math
import numpy as np

class SnapshotBuffer:

    def __init__(self, size=200):

        self.size = size

        self.data = deque(maxlen=size)

    # =================================================
    # APPEND
    # =================================================

    def append(self, snapshot):

        self.data.append(snapshot)

    # =================================================
    # EXTRACT VALUES
    # =================================================

    def extract_values(self, key):

        values = []

        for item in self.data:

            val = item.get(key)

            if val is None:
                continue

            if not math.isfinite(val):
                continue

            values.append(val)

        return values

    # =================================================
    # MEAN / STD
    # =================================================

    def mean_std(self, values):

        if not values:
            return None, None

        arr = np.array(values)

        mean = np.mean(arr)

        std = np.std(arr)

        return mean, std

    # =================================================
    # 1σ FILTERED MEAN
    # =================================================

    def one_sigma_filtered_mean(self, values):

        if not values:
            return None

        mean, std = self.mean_std(values)

        if mean is None:
            return None

        lower = mean - std

        upper = mean + std

        filtered = []

        for v in values:

            if lower <= v <= upper:

                filtered.append(v)

        if not filtered:

            return float(mean)

        return float(np.mean(filtered))

    # =================================================
    # BUILD AGGREGATED SNAPSHOT
    # =================================================

    def aggregate(self):

        keys = [

            "ltp",

            "gammaFlip",

            "imbalance",

            "microprice",

            "spread",

            "flow",

            "dS",

            "IV",

            "callSkew",

            "putSkew",

            "netGEX",

            "callGEX",

            "putGEX",

            "I1",

            "I2",

            "I3"
        ]

        result = {}

        for key in keys:

            vals = self.extract_values(key)

            result[key] = (
                self.one_sigma_filtered_mean(vals)
            )

        return result