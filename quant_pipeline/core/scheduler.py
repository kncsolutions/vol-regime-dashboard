import asyncio

from quant_pipeline.core.option_chain_fetcher import OptionChainFetcher


class Scheduler:

    def __init__(self, tick_stream):

        self.tick_stream = tick_stream

        self.fetcher = OptionChainFetcher()

    async def periodic_job(self):

        while True:

            print("Running periodic analytics job")

            await asyncio.sleep(5)

    async def start(self):

        asyncio.create_task(self.periodic_job())

        while True:

            await asyncio.sleep(1)
