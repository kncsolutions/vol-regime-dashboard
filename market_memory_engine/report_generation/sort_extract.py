def sort_market_list_by_symbol(market_list: list, reverse: bool = False) -> list:
    """
    Sorts the market JSON list alphabetically based on the asset symbol.

    :param market_list: The raw list containing ledger dictionaries.
    :param reverse: Set to True for descending (Z-A) order. Default is False (A-Z).
    :return: A new sorted list of dictionaries.
    """
    # Uses a lambda function to target the nested symbol value safely
    return sorted(
        market_list,
        key=lambda item: item.get("ledger", {}).get("symbol", "").upper(),
        reverse=reverse
    )


def extract_symbol_sublist(market_list: list, target_symbols: list) -> list:
    """
    Extracts a sublist containing only the specific symbols requested.
    The output preserves the exact order of symbols provided in target_symbols.

    :param market_list: The raw list containing ledger dictionaries.
    :param target_symbols: A list of string symbols to extract (e.g., ['HEXAGON', 'LODHA']).
    :return: A filtered sublist of dictionaries matching the requested inputs.
    """
    # Normalize input targets to uppercase to prevent casing mismatches
    normalized_targets = [str(sym).upper() for sym in target_symbols]

    # Map symbols to their corresponding dictionaries for fast lookups
    symbol_map = {}
    for item in market_list:
        sym = item.get("ledger", {}).get("symbol", "").upper()
        if sym:
            symbol_map[sym] = item

    # Reconstruct the list in the exact order requested by the user
    sublist = [symbol_map[sym] for sym in normalized_targets if sym in symbol_map]
    return sublist
