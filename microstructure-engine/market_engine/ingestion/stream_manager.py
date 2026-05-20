import asyncio
import json
import websockets
import yaml
import pandas as pd
import traceback

from market_engine.ingestion.packet_parser import (
    parse_dhan_packet
)

from market_engine.ingestion.symbol_router import (
    SymbolRouter
)

from market_engine.core.symbol_mapper import (
    SymbolMapper
)

from market_engine.storage.aggregator_registry import (
    AggregatorRegistry
)

from market_engine.storage.snapshot_buffer import (
    SnapshotBuffer
)

from market_engine.storage.parquet_writer import (
    ParquetWriter
)

from market_engine.online.inference_pipeline import (
    InferencePipeline
)

class StreamManager:

    def __init__(

        self,

        registry,

        config_path="configs/websocket.yaml",
        stocks_csv="configs/stocks.csv",
    ):

        self.registry = registry

        self.router = SymbolRouter(registry)

        self.ws = None

        self.subscribed = set()

        self.market_buffers = {}

        self.stocks_csv = stocks_csv

        with open(config_path, "r") as f:

            self.config = yaml.safe_load(f)

        self.url = self.config["websocket"]["url"]

        self.reconnect_delay = \
            self.config["websocket"]["reconnect_delay"]

        self.subscription_delay = \
            self.config["websocket"]["subscription_delay"]

        self.max_buffer_size = \
            self.config["websocket"]["max_buffer_size"]

        self.mapper = SymbolMapper(
            self.stocks_csv
        )
        self.aggregators = (
            AggregatorRegistry()
        )

        self.snapshot_buffer = (
            SnapshotBuffer()
        )

        self.writer = (
            ParquetWriter()
        )
        self.inference = (
            InferencePipeline()
        )

    # -------------------------------------------------
    # LOAD STOCKS
    # -------------------------------------------------

    def load_stocks(self):

        df = pd.read_csv(self.stocks_csv)

        return df.to_dict(orient="records")

    # -------------------------------------------------
    # CONNECT
    # -------------------------------------------------

    async def connect(self):

        self.ws = await websockets.connect(self.url)

        print("✅ Connected")

    # -------------------------------------------------
    # SUBSCRIBE
    # -------------------------------------------------

    async def subscribe(self, security_id, symbol):

        if security_id in self.subscribed:
            return

        payload = {

            "type": "subscribe",

            "securityId": str(security_id),

            "securityName": symbol,
        }

        await self.ws.send(json.dumps(payload))

        self.subscribed.add(security_id)

        print(f"📡 {symbol} subscribed")

    # -------------------------------------------------
    # BULK SUBSCRIBE
    # -------------------------------------------------

    async def subscribe_all(self):

        stocks = self.load_stocks()

        for stock in stocks:

            sid = stock["security_id"]

            symbol = stock["symbol"]

            await self.subscribe(sid, symbol)

            await asyncio.sleep(
                self.subscription_delay
            )

    # -------------------------------------------------
    # BUFFER
    # -------------------------------------------------

    def update_market_buffer(self, packet):

        sid = packet.security_id

        if sid not in self.market_buffers:

            self.market_buffers[sid] = []

        self.market_buffers[sid].append(packet)

        self.market_buffers[sid] = \
            self.market_buffers[sid][-self.max_buffer_size:]

    # -------------------------------------------------
    # HANDLE PACKET
    # -------------------------------------------------

    async def handle_packet(self, raw):

        packet = parse_dhan_packet(

            raw,

            self.mapper
        )

        self.update_market_buffer(packet)

        state = self.router.process(packet)
        # ---------------------------------------------
        # ONLINE INFERENCE
        # ---------------------------------------------

        state = self.inference.process(
            state
        )
        print("\n")

        print("=" * 70)

        print(f"{state.symbol}")

        print("=" * 70)

        print(
            f"LTP: {state.ltp}"
        )

        print(
            f"Cluster: {state.cluster}"
        )

        print(
            f"Entropy: {state.entropy:.4f}"
        )

        print(
            f"Confidence: "
            f"{state.confidence:.4f}"
        )

        print(
            f"Expected Return: "
            f"{state.expected_return:.6f}"
        )

        print(
            f"Forecast Score: "
            f"{state.forecast_score:.6f}"
        )

        print(
            f"Signal: "
            f"{state.signal}"
        )

        print(
            f"Next State Probs: "
            f"{state.next_state_probs}"
        )
        print(
            f"Dwell Time: "
            f"{state.dwell_time}"
        )

        print(
            f"Transitions: "
            f"{state.transition_count}"
        )

        print(
            f"Entropy Trend: "
            f"{state.entropy_trend:.6f}"
        )

        print(
            f"Metastable: "
            f"{state.metastable}"
        )

        print(
            f"Unstable: "
            f"{state.unstable}"
        )

        print(
            f"Trapping Score: "
            f"{state.trapping_score:.4f}"
        )
        print(
            f"Semantic Signal: "
            f"{state.semantic_signal}"
        )

        aggregator = self.aggregators.get(
            state.symbol
        )

        aggregator.update(state)
        if aggregator.should_flush():
            snapshot = aggregator.snapshot(

                symbol=state.symbol,

                timestamp=state.time,
            )

            self.snapshot_buffer.append(

                state.symbol,

                snapshot
            )

            aggregator.mark_flushed()
            buffer = self.snapshot_buffer.get(
                state.symbol
            )

            if len(buffer) >= 10:
                self.writer.write(

                    state.symbol,

                    buffer
                )

                self.snapshot_buffer.clear(
                    state.symbol
                )

        print(

            f"{state.symbol} | "

            f"LTP={state.ltp:.2f} | "

            f"SPREAD={state.spread:.3f} | "

            f"IMB_L1={state.imbalance_l1:.3f} | "

            f"IMB_L2={state.imbalance_l2:.3f} | "

            f"FLOW={state.flow:.2f} | "

            f"HV={state.HV:.5f}"
        )
        print('state snapshot-----')
        print(state.snapshot())

    # -------------------------------------------------
    # RECEIVE LOOP
    # -------------------------------------------------

    async def receive_loop(self):

        while True:

            try:

                message = await self.ws.recv()

                data = json.loads(message)

                # print("\n================ RAW SOCKET =================")
                # print(json.dumps(data, indent=2))
                # print("=============================================\n")

                await self.handle_packet(data)




            except Exception as e:

                print("\n")

                print("=" * 70)

                print("❌ PIPELINE ERROR")

                print("=" * 70)

                traceback.print_exc()

                print("\n")

                await asyncio.sleep(

                    self.reconnect_delay

                )

    # -------------------------------------------------
    # START
    # -------------------------------------------------

    async def start(self):

        await self.connect()

        await self.subscribe_all()

        await self.receive_loop()