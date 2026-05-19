from backend.config import (
    LONG_THRESHOLD,
    SHORT_THRESHOLD
)


def decide(probability_long):

    probability_short = (
        1 - probability_long
    )

    if probability_long >= LONG_THRESHOLD:

        return "LONG_STRADDLE"

    if probability_short >= SHORT_THRESHOLD:

        return "SHORT_STRADDLE"

    return "NO_TRADE"
