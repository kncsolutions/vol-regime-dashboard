from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class LedgerEnvelope:

    schema_version: int = 1

    ledger_type: str = ""

    immutable: bool = True

    created_at: str = field(
        default_factory=lambda: datetime.now().astimezone().isoformat()
    )

    source: str = "MarketMemoryEngine"

    ledger: Any = None

    def to_dict(self):

        return asdict(self)