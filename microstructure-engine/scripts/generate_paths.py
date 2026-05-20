
from market_engine.montecarlo.gbm_engine import GBMSimulator


def main():

    mc = GBMSimulator()

    paths = mc.generate_paths(
        S0=100,
        steps=250,
        paths=1000
    )

    print(paths.shape)


if __name__ == "__main__":

    main()
