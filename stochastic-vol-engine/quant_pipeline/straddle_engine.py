import numpy as np


def implied_move(
    price,
    iv,
    horizon_minutes
):

    annual_fraction = (
        horizon_minutes
        / (252 * 390)
    )

    return (
        price
        * iv
        * np.sqrt(
            annual_fraction
        )
    )


def realized_move(
    current_price,
    future_price
):

    return abs(
        future_price
        - current_price
    )


def straddle_edge(
    current_price,
    future_price,
    iv,
    horizon_minutes
):

    implied = implied_move(
        current_price,
        iv,
        horizon_minutes
    )

    realized = realized_move(
        current_price,
        future_price
    )

    return realized - implied
