from collections import deque
import numpy as np


# =====================================================
# STATE TRACKER
# =====================================================

class StateTracker:

    # =================================================
    # INIT
    # =================================================

    def __init__(

        self,

        entropy_window=50,

        metastable_threshold=15,
    ):

        # ---------------------------------------------
        # CURRENT STATE
        # ---------------------------------------------

        self.current_cluster = None

        self.previous_cluster = None

        # ---------------------------------------------
        # DWELL
        # ---------------------------------------------

        self.dwell_time = 0

        self.transition_count = 0

        # ---------------------------------------------
        # ENTROPY HISTORY
        # ---------------------------------------------

        self.entropy_history = deque(
            maxlen=entropy_window
        )

        # ---------------------------------------------
        # FLAGS
        # ---------------------------------------------

        self.metastable_threshold = (
            metastable_threshold
        )

    # =================================================
    # UPDATE
    # =================================================

    def update(

        self,

        cluster,

        entropy,
    ):

        cluster = int(cluster)

        entropy = float(entropy)

        # ---------------------------------------------
        # INITIALIZE
        # ---------------------------------------------

        if self.current_cluster is None:

            self.current_cluster = cluster

            self.dwell_time = 1

        # ---------------------------------------------
        # SAME STATE
        # ---------------------------------------------

        elif cluster == self.current_cluster:

            self.dwell_time += 1

        # ---------------------------------------------
        # TRANSITION
        # ---------------------------------------------

        else:

            self.previous_cluster = (
                self.current_cluster
            )

            self.current_cluster = cluster

            self.dwell_time = 1

            self.transition_count += 1

        # ---------------------------------------------
        # ENTROPY HISTORY
        # ---------------------------------------------

        self.entropy_history.append(
            entropy
        )

        # ---------------------------------------------
        # METRICS
        # ---------------------------------------------

        return self.metrics()

    # =================================================
    # ENTROPY TREND
    # =================================================

    def entropy_trend(self):

        if len(self.entropy_history) < 2:

            return 0.0

        x = np.arange(
            len(self.entropy_history)
        )

        y = np.array(
            self.entropy_history
        )

        slope = np.polyfit(
            x,
            y,
            1
        )[0]

        return float(slope)

    # =================================================
    # METASTABLE
    # =================================================

    def metastable(self):

        return (

            self.dwell_time
            >=
            self.metastable_threshold
        )

    # =================================================
    # UNSTABLE
    # =================================================

    def unstable(self):

        if len(self.entropy_history) < 5:
            return False

        current_entropy = (
            self.entropy_history[-1]
        )

        trend = self.entropy_trend()

        return (

                current_entropy > 2.5

                and

                trend > 0.01
        )

    # =================================================
    # TRAPPING SCORE
    # =================================================

    def trapping_score(self):

        if len(self.entropy_history) == 0:

            return 0.0

        entropy = self.entropy_history[-1]

        return float(

            self.dwell_time

            /

            (
                entropy
                +
                1e-8
            )
        )

    # =================================================
    # METRICS
    # =================================================

    def metrics(self):

        return {

            "current_cluster":
                self.current_cluster,

            "previous_cluster":
                self.previous_cluster,

            "dwell_time":
                self.dwell_time,

            "transition_count":
                self.transition_count,

            "entropy_trend":
                self.entropy_trend(),

            "metastable":
                self.metastable(),

            "unstable":
                self.unstable(),

            "trapping_score":
                self.trapping_score(),
        }