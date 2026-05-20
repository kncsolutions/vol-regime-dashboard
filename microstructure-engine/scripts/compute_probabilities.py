
from market_engine.montecarlo.gbm_engine import GBMSimulator

from market_engine.montecarlo.probability.directional_probability import (
    probability_up,
    probability_down,
)


def main():

    mc = GBMSimulator()

    paths = mc.generate_paths(
        S0=100,
        steps=250,
        paths=1000
    )

    print("P(up):", probability_up(paths))
    print("P(down):", probability_down(paths))


if __name__ == "__main__":

    main()
