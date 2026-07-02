import json
from pathlib import Path
from dataclasses import asdict
from datetime import datetime
import numpy as np

from market_memory_engine.ingestion.ledger_envelope import LedgerEnvelope


class LedgerJSONEncoder(json.JSONEncoder):

    def default(self, obj):

        if isinstance(obj, datetime):
            return obj.isoformat()

        if isinstance(obj, np.integer):
            return int(obj)

        if isinstance(obj, np.floating):
            return float(obj)

        if isinstance(obj, np.bool_):
            return bool(obj)

        return super().default(obj)


class LedgerWriter:

    @staticmethod
    def save(
        ledger,
        filepath,
        ledger_type,
    ):

        envelope = LedgerEnvelope(

            ledger_type=ledger_type,

            ledger=ledger
        )

        filepath = Path(filepath)

        filepath.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        with open(filepath, "w") as f:

            json.dump(

                envelope.to_dict(),

                f,

                cls=LedgerJSONEncoder,

                indent=4,
            )