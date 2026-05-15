from dataclasses import dataclass


@dataclass
class Tick:

    security_id: str
    ltp: float
    volume: int
    timestamp: int
