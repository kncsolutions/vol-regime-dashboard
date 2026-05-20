import pandas as pd


class SymbolMapper:

    def __init__(self, csv_path):

        df = pd.read_csv(csv_path)

        self.sid_to_symbol = {}

        self.symbol_to_sid = {}

        for _, row in df.iterrows():

            sid = str(
                row["security_id"]
            )

            symbol = str(
                row["symbol"]
            )

            self.sid_to_symbol[sid] = symbol

            self.symbol_to_sid[symbol] = sid

    # =========================================
    # SID -> SYMBOL
    # =========================================

    def get_symbol(self, security_id):

        security_id = str(security_id)

        return self.sid_to_symbol.get(
            security_id,
            security_id
        )

    # =========================================
    # SYMBOL -> SID
    # =========================================

    def get_security_id(self, symbol):

        symbol = str(symbol)

        return self.symbol_to_sid.get(symbol)