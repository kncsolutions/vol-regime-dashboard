from market_engine.core.symbol_mapper import (
    SymbolMapper
)


mapper = SymbolMapper(
    "configs/stocks.csv"
)

print(
    mapper.get_symbol("10217")
)

print(
    mapper.get_security_id("ADANIENSOL")
)