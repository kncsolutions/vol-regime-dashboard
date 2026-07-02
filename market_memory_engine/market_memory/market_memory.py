from dataclasses import dataclass

from market_memory_engine.market_memory.market_node import MarketNode


@dataclass(frozen=True)
class MarketMemory(MarketNode):

    pass