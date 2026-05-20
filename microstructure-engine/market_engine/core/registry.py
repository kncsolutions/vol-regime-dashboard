from market_engine.state.symbol_state import SymbolState


class SymbolRegistry:

    def __init__(self):

        self.states = {}

    def get(self, symbol):

        if symbol not in self.states:

            self.states[symbol] = SymbolState(symbol)

        return self.states[symbol]

    def all_states(self):

        return self.states