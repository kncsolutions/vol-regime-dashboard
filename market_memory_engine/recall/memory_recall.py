import json
from pathlib import Path

class MarketMemoryRecall:

    def __init__(self, root):

        self.root = Path(root)

        self.memories = []

    ########################################################################

    def _recall(

        self,

        pattern,

        ledger_type,

        predicate=None

    ):

        results = []

        self.memories = []

        for file in self.root.rglob(pattern):

            ###############################################################
            # Ignore generated HTML library
            ###############################################################

            if "library" in file.parts:

                continue

            ###############################################################
            # Load JSON
            ###############################################################

            with open(file) as f:

                envelope = json.load(f)

            ###############################################################
            # Ledger Type Filter
            ###############################################################

            if envelope["ledger_type"] != ledger_type:

                continue

            ###############################################################
            # Optional Predicate
            ###############################################################

            if predicate is not None:

                if not predicate(envelope):

                    continue

            ###############################################################
            # Store Result
            ###############################################################

            results.append(envelope)

            # Future object representation
            #
            # self.memories.append(
            #
            #     RecallResult(
            #
            #         symbol=envelope["ledger"]["symbol"],
            #
            #         path=file,
            #
            #         envelope=envelope,
            #
            #         ledger=envelope["ledger"]
            #
            #     )
            #
            # )

        return results

    ########################################################################

    def recall_month(

        self,

        year,

        month

    ):

        return self._recall(

            pattern=f"{year}_{month:02d}.json",

            ledger_type="MONTHLY"

        )

    ########################################################################

    def recall_quarter(

        self,

        year,

        quarter

    ):

        return self._recall(

            pattern=f"Q{quarter}.json",

            ledger_type="QUARTERLY",

            predicate=lambda e: e["ledger"]["year"] == year

        )