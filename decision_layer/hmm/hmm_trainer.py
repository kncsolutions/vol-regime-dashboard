import numpy as np
import pandas as pd

from hmmlearn.hmm import GaussianHMM


# =========================================================
# HMM TRAINER CLASS
# =========================================================
class HMMTrainer:
    def __init__(self, n_states=6, covariance_type="full", random_state=42):
        self.n_states = n_states
        self.model = GaussianHMM(
            n_components=n_states,
            covariance_type=covariance_type,
            n_iter=300,
            random_state=random_state
        )

    # =====================================================
    # FIT MODEL
    # =====================================================
    def fit(self, X):
        self.model.fit(X)
        return self

    # =====================================================
    # PREDICT STATES
    # =====================================================
    def predict_states(self, X):
        hidden_states = self.model.predict(X)
        return hidden_states

    # =====================================================
    # TRANSITION MATRIX
    # =====================================================
    def get_transition_matrix(self):
        return self.model.transmat_

    # =====================================================
    # STATE MEANS (IMPORTANT FOR INTERPRETATION)
    # =====================================================
    def get_state_means(self):
        return self.model.means_

    # =====================================================
    # DIAGNOSTICS
    # =====================================================
    def diagnostics(self, X, labeled_states=None):
        print("\n==============================")
        print("HMM DIAGNOSTICS")
        print("==============================")

        hidden_states = self.predict_states(X)

        # ----------------------------
        # State distribution
        # ----------------------------
        counts = pd.Series(hidden_states).value_counts(normalize=True)
        print("\nHidden State Distribution:")
        print(counts.sort_index())

        # ----------------------------
        # Transition matrix
        # ----------------------------
        print("\nTransition Matrix:")
        print(pd.DataFrame(self.get_transition_matrix()))

        # ----------------------------
        # Persistence (diagonal)
        # ----------------------------
        diag = np.diag(self.get_transition_matrix())
        print("\nState Persistence (Diagonal):")
        print(diag)

        # ----------------------------
        # Compare with labeler
        # ----------------------------
        if labeled_states is not None:
            print("\nLabel vs HMM Crosstab:")
            print(pd.crosstab(labeled_states, hidden_states, normalize="index"))

        return hidden_states


# =========================================================
# HELPER FUNCTION (PIPELINE FRIENDLY)
# =========================================================
def train_hmm_pipeline(X, features, df=None):
    trainer = HMMTrainer(n_states=3,
                         covariance_type="diag")

    trainer.fit(X)
    means = trainer.get_state_means()

    for i, m in enumerate(means):
        print(f"\nState {i} mean:")
        print(dict(zip(features, m)))

    labeled_states = None
    if df is not None and "state" in df.columns:
        labeled_states = df["state"]

    hidden_states = trainer.diagnostics(X, labeled_states=labeled_states)

    if df is not None:
        df = df.copy()
        df["hmm_state"] = hidden_states

    return {
        "model": trainer.model,
        "hidden_states": hidden_states,
        "df": df
    }