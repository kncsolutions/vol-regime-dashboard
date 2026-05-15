class TickCache:

    def __init__(self):

        self.cache = {}

    def update(self, security_id, tick):

        self.cache[security_id] = tick

    def get(self, security_id):

        return self.cache.get(security_id)
