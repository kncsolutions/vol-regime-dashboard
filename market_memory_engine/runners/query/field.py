from market_memory_engine.runners.query.query import Condition
class Field:

    def __init__(self, path):

        self.path = path

    def __gt__(self, value):

        return Condition(self.path, ">", value)

    def __lt__(self, value):

        return Condition(self.path, "<", value)

    def __eq__(self, value):

        return Condition(self.path, "==", value)

    def __ge__(self, value):

        return Condition(self.path, ">=", value)

    def __le__(self, value):

        return Condition(self.path, "<=", value)