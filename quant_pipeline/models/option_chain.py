from dataclasses import dataclass


@dataclass
class OptionChainRow:

    strike: float
    call_oi: int
    put_oi: int
    call_iv: float
    put_iv: float
