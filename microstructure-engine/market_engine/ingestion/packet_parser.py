from dataclasses import dataclass


@dataclass
class MarketPacket:

    symbol: str

    security_id: str

    timestamp: float

    ltp: float
    ltq: float

    volume: float

    best_bid: float
    best_ask: float

    spread: float

    bid_qty_l1: float
    ask_qty_l1: float

    bid_qty_total: float
    ask_qty_total: float

    imbalance_l1: float
    imbalance_l2: float

    microprice: float

    total_buy_qty: float
    total_sell_qty: float


def safe_divide(a, b):

    if b == 0:
        return 0.0

    return a / b


def parse_dhan_packet(raw, mapper):

    depth = raw.get("depth", [])
    security_id = str(
        raw.get("securityId")
    )

    symbol = mapper.get_symbol(
        security_id
    )
    print(symbol)

    # -----------------------------------------
    # EMPTY DEPTH PROTECTION
    # -----------------------------------------

    if len(depth) == 0:

        return MarketPacket(

            security_id=str(
                security_id
            ),

            symbol = symbol,

            timestamp=raw.get("ltt", 0),

            ltp=raw.get("ltp", 0),

            ltq=raw.get("ltq", 0),

            volume=raw.get("volume", 0),

            best_bid=0,
            best_ask=0,

            spread=0,

            bid_qty_l1=0,
            ask_qty_l1=0,

            bid_qty_total=0,
            ask_qty_total=0,

            imbalance_l1=0,
            imbalance_l2=0,

            microprice=0,

            total_buy_qty=0,
            total_sell_qty=0,
        )

    # -----------------------------------------
    # L1
    # -----------------------------------------

    top = depth[0]

    best_bid = top["bid_price"]

    best_ask = top["ask_price"]

    bid_qty_l1 = top["bid_qty"]

    ask_qty_l1 = top["ask_qty"]

    spread = best_ask - best_bid

    # -----------------------------------------
    # L2 DEPTH AGGREGATION
    # -----------------------------------------

    bid_qty_total = sum(
        level["bid_qty"]
        for level in depth
    )

    ask_qty_total = sum(
        level["ask_qty"]
        for level in depth
    )

    # -----------------------------------------
    # IMBALANCE
    # -----------------------------------------

    imbalance_l1 = safe_divide(

        (bid_qty_l1 - ask_qty_l1),

        (bid_qty_l1 + ask_qty_l1)
    )

    imbalance_l2 = safe_divide(

        (bid_qty_total - ask_qty_total),

        (bid_qty_total + ask_qty_total)
    )

    # -----------------------------------------
    # WEIGHTED MICROPRICE
    # -----------------------------------------

    weighted_bid = 0
    weighted_ask = 0

    total_bid_weight = 0
    total_ask_weight = 0

    for level in depth:

        weighted_bid += (
            level["bid_price"]
            *
            level["bid_qty"]
        )

        weighted_ask += (
            level["ask_price"]
            *
            level["ask_qty"]
        )

        total_bid_weight += level["bid_qty"]

        total_ask_weight += level["ask_qty"]

    avg_bid = safe_divide(
        weighted_bid,
        total_bid_weight
    )

    avg_ask = safe_divide(
        weighted_ask,
        total_ask_weight
    )

    microprice = safe_divide(

        (
            avg_bid * ask_qty_total
        )
        +
        (
            avg_ask * bid_qty_total
        ),

        (
            bid_qty_total
            +
            ask_qty_total
        )
    )

    # -----------------------------------------
    # RETURN
    # -----------------------------------------

    return MarketPacket(

        security_id=str(
            security_id
        ),

        symbol=symbol,

        timestamp=raw.get("ltt", 0),

        ltp=raw.get("ltp", 0),

        ltq=raw.get("ltq", 0),

        volume=raw.get("volume", 0),

        best_bid=best_bid,

        best_ask=best_ask,

        spread=spread,

        bid_qty_l1=bid_qty_l1,

        ask_qty_l1=ask_qty_l1,

        bid_qty_total=bid_qty_total,

        ask_qty_total=ask_qty_total,

        imbalance_l1=imbalance_l1,

        imbalance_l2=imbalance_l2,

        microprice=microprice,

        total_buy_qty=raw.get(
            "total_buy_qty",
            0
        ),

        total_sell_qty=raw.get(
            "total_sell_qty",
            0
        ),
    )