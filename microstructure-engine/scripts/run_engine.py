import asyncio

from market_engine.core.registry import (
    SymbolRegistry
)

from market_engine.ingestion.stream_manager import (
    StreamManager
)


async def main():

    registry = SymbolRegistry()

    stream = StreamManager(registry)

    await stream.start()


if __name__ == "__main__":

    asyncio.run(main())