from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any


@dataclass
class RecallResult:

    symbol: str

    path: Path

    envelope: Dict[str, Any]

    ledger: Dict[str, Any]

    ##########################################################

    @property
    def ledger_type(self):

        return self.envelope["ledger_type"]

    ##########################################################

    @property
    def timeframe(self):

        return self.envelope["ledger_type"]

    ##########################################################

    @property
    def year(self):

        return self.ledger.get("year")

    ##########################################################

    @property
    def month(self):

        return self.ledger.get("month")

    ##########################################################

    @property
    def quarter(self):

        return self.ledger.get("quarter")

    ##########################################################

    @property
    def statistics(self):

        return self.ledger.get("statistics", {})

    ##########################################################

    def get(self, key, default=None):

        return self.ledger.get(key, default)

    ##########################################################

    def to_dict(self):

        return {

            "symbol": self.symbol,

            "path": str(self.path),

            "ledger_type": self.ledger_type,

            **self.ledger
        }

    ##########################################################

    def __repr__(self):

        if self.ledger_type == "MONTHLY":

            return (

                f"<MonthlyRecall "

                f"{self.symbol} "

                f"{self.year}-{self.month:02d}>"

            )

        if self.ledger_type == "QUARTERLY":

            return (

                f"<QuarterlyRecall "

                f"{self.symbol} "

                f"{self.year} "

                f"Q{self.quarter}>"

            )

        return f"<RecallResult {self.symbol}>"