from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class QueryConfig:
    """
    Configuration for Market Memory queries.
    """

    # Root directory of immutable market memory
    market_memory_root: str = "market_memory"

    # Output directory
    output_root: str = "query_op"

    # Timeframe: MONTHLY or QUARTERLY
    timeframe: str = "MONTHLY"

    # Query period
    year: int = 2026

    # Used only for MONTHLY queries
    months: List[int] = field(default_factory=lambda: [6])

    # Used only for QUARTERLY queries
    quarters: List[int] = field(default_factory=list)

    # Optional stock filter
    symbols: Optional[List[str]] = None

    # Output formats
    save_csv: bool = True
    save_excel: bool = True
    save_parquet: bool = True