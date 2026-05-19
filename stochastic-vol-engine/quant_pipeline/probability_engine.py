import numpy as np
import pandas as pd


def estimate_probability(
    labels,
    neighbor_indices,
    distances,
    neighbor_edges,
    epsilon=1e-6
):

    # ========================================================
    # LABELS
    # ========================================================

    neighbor_labels = labels.iloc[
        neighbor_indices
    ].values

    # ========================================================
    # EDGE VALUES
    # ========================================================

    edges = neighbor_edges.values

    # ========================================================
    # DISTANCE WEIGHTS
    # ========================================================

    weights = 1.0 / (
        distances + epsilon
    )

    # ========================================================
    # WEIGHTED PROBABILITY
    # ========================================================

    weighted_probability = np.sum(
        weights * neighbor_labels
    ) / np.sum(weights)

    # ========================================================
    # EXPECTED EDGE
    # ========================================================

    expected_edge = np.sum(
        weights * edges
    ) / np.sum(weights)

    edge_variance = np.sum(

        weights
        * (edges - expected_edge) ** 2

    ) / np.sum(weights)

    edge_volatility = np.sqrt(
        edge_variance
    )
    positive_tail_probability = np.mean(
        edges > 50
    )
    negative_tail_probability = np.mean(
        edges < -70
    )

    # ========================================================
    # NORMALIZED WEIGHTS
    # ========================================================

    normalized_weights = (
        weights / np.sum(weights)
    )

    # ========================================================
    # EDGE CONTRIBUTION
    # ========================================================

    edge_contribution = (
        normalized_weights * edges
    )

    # ========================================================
    # CONTRIBUTION DATAFRAME
    # ========================================================

    contribution_df = pd.DataFrame({

        "edge":
            edges,

        "weight":
            weights,

        "weighted_edge":
            weights * edges,

        "edge_contribution":
            edge_contribution,

        "distance":
            distances
    })

    # ========================================================
    # INTERPRETATION
    # ========================================================

    def classify(row):

        edge = row["edge"]

        if edge > 100:
            return "convexity expansion"

        if edge > 30:
            return "strong positive"

        if edge > 0:
            return "mild positive"

        if edge < -70:
            return "volatility suppression"

        if edge < -30:
            return "strong negative"

        return "negative"

    contribution_df[
        "interpretation"
    ] = contribution_df.apply(
        classify,
        axis=1
    )

    # ========================================================
    # SORT BY ABSOLUTE IMPACT
    # ========================================================

    contribution_df = contribution_df.sort_values(
        by="edge_contribution",
        key=lambda x: np.abs(x),
        ascending=False
    )

    return (

        weighted_probability,

        expected_edge,

        edge_variance,

        edge_volatility,

        positive_tail_probability,

        negative_tail_probability,

        contribution_df
    )