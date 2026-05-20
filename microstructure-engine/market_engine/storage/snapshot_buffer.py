from collections import defaultdict


class SnapshotBuffer:

    def __init__(self):

        self.buffer = defaultdict(list)

    # =========================================
    # APPEND
    # =========================================

    def append(self, symbol, snapshot):

        self.buffer[symbol].append(
            snapshot
        )

    # =========================================
    # GET
    # =========================================

    def get(self, symbol):

        return self.buffer[symbol]

    # =========================================
    # CLEAR
    # =========================================

    def clear(self, symbol):

        self.buffer[symbol] = []