
class SignalEngine:

    def generate_signal(
        self,
        probability_up,
        probability_down
    ):

        if probability_up > 0.65:
            return "BUY"

        if probability_down > 0.65:
            return "SELL"

        return "NEUTRAL"
