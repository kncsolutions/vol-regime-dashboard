class StressTester:

    def run_crash_scenario(self, generator, X0, S0):

        X0[0] *= 2        # IV spike
        X0[3] *= -2       # GEX shock

        return generator.generate(X0, S0, steps=300)