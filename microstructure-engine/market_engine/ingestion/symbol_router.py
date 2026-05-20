from datetime import datetime


class SymbolRouter:

    def __init__(self, registry):

        self.registry = registry

    def process(self, packet):

        state = self.registry.get(packet.symbol)

        # =========================================
        # TIME
        # =========================================

        state.time = packet.timestamp

        state.time_readable = datetime.fromtimestamp(
            packet.timestamp
        ).strftime("%H:%M:%S")

        # =========================================
        # PRICE
        # =========================================

        state.update_price(
            packet.ltp
        )

        # =========================================
        # FLOW
        # =========================================

        state.update_flow(
            packet.volume
        )

        # =========================================
        # LIQUIDITY
        # =========================================

        state.update_liquidity(

            best_bid=packet.best_bid,

            best_ask=packet.best_ask,

            spread=packet.spread,

            microprice=packet.microprice,

            imbalance_l1=packet.imbalance_l1,

            imbalance_l2=packet.imbalance_l2,
        )

        # =========================================
        # INVENTORY PROXIES
        # =========================================

        state.update_inventory_dynamics()

        return state