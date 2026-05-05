class ScenarioGenerator:

    def shock_vol(self, X, factor=1.5):
        X[0] *= factor  # IV shock
        return X

    def flip_gamma(self, X):
        X[3] *= -1      # netGEX flip
        return X