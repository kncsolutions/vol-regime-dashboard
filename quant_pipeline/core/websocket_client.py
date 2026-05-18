import asyncio
import json
import websockets
import pandas as pd
from quant_pipeline.config.paths import STOCKS_CSV

class TickStream:

    def __init__(self):

        self.ws = None

        self.latest_ticks = {}

        self.market_buffers = {}

        self.subscribed = set()

    # -------------------------------------------------
    # LOAD STOCK CONFIG
    # -------------------------------------------------
    def load_stocks(self):

        df = pd.read_csv(STOCKS_CSV)

        return df.to_dict(orient="records")

    # -------------------------------------------------
    # CONNECT
    # -------------------------------------------------
    async def connect(self):

        self.ws = await websockets.connect(
            "ws://localhost:8001/ws"
        )

        print("✅ Connected to websocket server")

    # -------------------------------------------------
    # SUBSCRIBE
    # -------------------------------------------------
    async def subscribe(self, security_id, symbol):

        if security_id in self.subscribed:
            return

        payload = {
            "type": "subscribe",
            "securityId": str(security_id),
            "securityName": symbol
        }

        await self.ws.send(json.dumps(payload))

        self.subscribed.add(security_id)

        print(f"📡 Subscribed → {symbol} ({security_id})")

    # -------------------------------------------------
    # BULK SUBSCRIBE
    # -------------------------------------------------
    async def subscribe_from_csv(self):

        stocks = self.load_stocks()

        for stock in stocks:

            sid = stock["security_id"]
            symbol = stock["symbol"]

            # -----------------------------------------
            # INDEX MAPPING
            # -----------------------------------------
            if symbol == "NIFTY":
                sid = 66071

            elif symbol == "BANKNIFTY":
                sid = 66068

            await self.subscribe(sid, symbol)

            await asyncio.sleep(0.1)

    # -------------------------------------------------
    # MARKET BUFFER
    # -------------------------------------------------
    def update_market_buffer(self, tick):

        sid = str(tick["securityId"])

        if sid not in self.market_buffers:
            self.market_buffers[sid] = []

        self.market_buffers[sid].append(tick)

        # rolling buffer
        self.market_buffers[sid] = \
            self.market_buffers[sid][-500:]

    # -------------------------------------------------
    # HANDLE TICK
    # -------------------------------------------------
    async def handle_tick(self, tick):

        sid = str(tick["securityId"])

        self.latest_ticks[sid] = tick
        # print(tick)

        self.update_market_buffer(tick)

        # lightweight realtime metrics only
        ltp = tick.get("ltp")
        # -------------------------------------------------
        # DEBUG
        # -------------------------------------------------

        ltp = tick.get("ltp")

        volume = tick.get("volume")

        print(
            f"📈 TICK | SID={sid} "
            f"LTP={ltp} "
            f"VOL={volume}"
        )

        print(f"📈 {sid} LTP: {ltp}")

    # -------------------------------------------------
    # RECEIVE LOOP
    # -------------------------------------------------
    async def receive_loop(self):

        while True:

            try:

                message = await self.ws.recv()

                # print("📦 RAW MESSAGE:", message)

                data = json.loads(message)

                await self.handle_tick(data)

            except Exception as e:

                print("❌ Tick error:", e)

                await asyncio.sleep(1)

    # -------------------------------------------------
    # START
    # -------------------------------------------------
    async def start(self):

        await self.connect()

        await self.subscribe_from_csv()

        await self.receive_loop()