from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import websockets
import json
import os

app = FastAPI()

# -----------------------------
# 🔐 Load config
# -----------------------------
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "dhanconfig.json")

with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)

DHAN_TOKEN = CONFIG["auth"]["token"]
DHAN_CLIENT_ID = CONFIG["auth"]["client_id"]

# -----------------------------
# 🌐 State
# -----------------------------
clients = set()

# per-client subscriptions
client_subscriptions = {}  # {ws: securityId}

# queue for dhan subscription updates
subscription_queue = asyncio.Queue()


# -----------------------------
# 🔌 Client WebSocket Endpoint
# -----------------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    client_subscriptions[ws] = None

    print("✅ Client connected:", len(clients))


    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)

            msg_type = data.get("type")
            security_id = str(data.get("securityId"))
            security_name = str(data.get("securityName"))

            # 🔁 SWITCH (replace previous)
            if msg_type == "switch":

                old_sid = client_subscriptions.get(ws)

                client_subscriptions[ws] = security_id

                await subscription_queue.put({
                    "action": "switch",
                    "old": old_sid,
                    "new": security_id,
                    "securityName": security_name
                })

                print(f"🔄 Client switched {old_sid} → {security_id}")


            # ➕ SUBSCRIBE (additive, optional)
            elif msg_type == "subscribe":
                client_subscriptions[ws] = security_id

                await subscription_queue.put({
                    "action": "subscribe",
                    "securityId": security_id,
                    "securityName": security_name
                })

                print(f"📡 Client subscribed → {security_id}")
                print(f"📡 Client subscribed Security Name → {security_name}")

    except WebSocketDisconnect:
        clients.discard(ws)
        client_subscriptions.pop(ws, None)
        print("❌ Client disconnected:", len(clients))


# -----------------------------
# 📡 Broadcast (filtered)
# -----------------------------
async def broadcast(data):
    dead = []

    sid = str(data.get("securityId"))

    print(f"\n📤 BROADCAST CALLED | SID: {sid}")
    print(f"👥 Total clients: {len(clients)}")

    for client in clients:
        try:
            sub = client_subscriptions.get(client)

            print(f"➡️ Client: {id(client)} | Subscribed SID: {sub}")

            # 🎯 send only relevant ticks
            if sub == sid:
                print(f"✅ Sending to client {id(client)}")

                await client.send_json(data)

            else:
                print(f"⛔ Skipped client {id(client)} (sid mismatch)")

        except Exception as e:
            print(f"❌ Error sending to client {id(client)}:", e)
            dead.append(client)

    for d in dead:
        print(f"🧹 Removing dead client {id(d)}")
        clients.discard(d)
        client_subscriptions.pop(d, None)


# -----------------------------
# 🔥 Dhan WebSocket Feed
# -----------------------------

import struct

def get_response_code(msg: bytes):
    return msg[0]   # ✅ first byte only
def decode_packet(msg: bytes):
    return {
        "ltp": struct.unpack_from("<f", msg, 9)[0],
        "ltq": struct.unpack_from("<h", msg, 13)[0],
        "ltt": struct.unpack_from("<i", msg, 15)[0],
        "atp": struct.unpack_from("<f", msg, 19)[0],
        "volume": struct.unpack_from("<i", msg, 23)[0],
        "total_sell_qty": struct.unpack_from("<i", msg, 27)[0],
        "total_buy_qty": struct.unpack_from("<i", msg, 31)[0],
        "oi": struct.unpack_from("<i", msg, 35)[0],
        "oi_high": struct.unpack_from("<i", msg, 39)[0],
        "oi_low": struct.unpack_from("<i", msg, 43)[0],
        "open": struct.unpack_from("<f", msg, 47)[0],
        "close": struct.unpack_from("<f", msg, 51)[0],
        "high": struct.unpack_from("<f", msg, 55)[0],
        "low": struct.unpack_from("<f", msg, 59)[0],
    }
import struct

def decode_depth(msg: bytes):
    depth = []
    offset = 62   # 🔥 FIXED

    for i in range(5):
        if offset + 20 > len(msg):
            break

        level = {
            "bid_qty": struct.unpack_from("<i", msg, offset)[0],
            "ask_qty": struct.unpack_from("<i", msg, offset + 4)[0],
            "bid_orders": struct.unpack_from("<h", msg, offset + 8)[0],
            "ask_orders": struct.unpack_from("<h", msg, offset + 10)[0],
            "bid_price": struct.unpack_from("<f", msg, offset + 12)[0],
            "ask_price": struct.unpack_from("<f", msg, offset + 16)[0],
        }

        depth.append(level)
        offset += 20

    return depth
def decode_full_packet(msg: bytes):
    return {
        "securityId": struct.unpack_from("<i", msg, 4)[0],
        "ltp": struct.unpack_from("<f", msg, 8)[0],
        "ltq": struct.unpack_from("<h", msg, 12)[0],
        "ltt": struct.unpack_from("<i", msg, 14)[0],
        "atp": struct.unpack_from("<f", msg, 18)[0],
        "volume": struct.unpack_from("<i", msg, 22)[0],
        "total_sell_qty": struct.unpack_from("<i", msg, 26)[0],
        "total_buy_qty": struct.unpack_from("<i", msg, 30)[0],
        "oi": struct.unpack_from("<i", msg, 34)[0],
        "oi_high": struct.unpack_from("<i", msg, 38)[0],
        "oi_low": struct.unpack_from("<i", msg, 42)[0],
        "open": struct.unpack_from("<f", msg, 46)[0],
        "close": struct.unpack_from("<f", msg, 50)[0],
        "high": struct.unpack_from("<f", msg, 54)[0],
        "low": struct.unpack_from("<f", msg, 58)[0],
    }

def decode_compact_packet(msg: bytes):
    return {
        "securityId": struct.unpack_from("<i", msg, 4)[0],
        "ltp": struct.unpack_from("<f", msg, 8)[0],
        "timestamp": struct.unpack_from("<i", msg, 12)[0],
    }
async def dhan_feed():
    uri = f"wss://api-feed.dhan.co?version=2&clientId={DHAN_CLIENT_ID.strip()}&token={DHAN_TOKEN.strip()}&authType=2"

    while True:  # 🔁 reconnect loop
        try:
            async with websockets.connect(uri) as ws:
                print("🚀 Connected to Dhan")

                subscribed = set()

                while True:  # 🔁 main loop

                    # 🔄 1. Handle subscriptions
                    try:
                        sub = subscription_queue.get_nowait()

                        action = sub.get("action")

                        # -------------------------
                        # 🔁 SWITCH (unsubscribe old, subscribe new)
                        # -------------------------
                        if action == "switch":

                            old_sid = sub.get("old")
                            new_sid = sub.get("new")
                            sname = sub.get("securityName")

                            print(f"\n🔁 SWITCH REQUEST: {old_sid} → {new_sid}")

                            # 🔴 UNSUBSCRIBE OLD
                            if old_sid and old_sid in subscribed:
                                await ws.send(json.dumps({
                                    "RequestCode": 22,
                                    "InstrumentCount": 1,
                                    "InstrumentList": [{
                                        "ExchangeSegment": "NSE_EQ",
                                        "SecurityId": str(old_sid)
                                    }]
                                }))

                                subscribed.remove(old_sid)
                                print(f"❌ Unsubscribed: {old_sid}")

                            # 🟢 SUBSCRIBE NEW
                            if new_sid not in subscribed:

                                if sname in ["NIFTY", "BANKNIFTY"]:
                                    print('Index')
                                    exchange_segment = "NSE_FNO"

                                else:
                                    print('Stock')
                                    exchange_segment = "NSE_EQ"

                                await ws.send(json.dumps({
                                    "RequestCode": 21,
                                    "InstrumentCount": 1,
                                    "InstrumentList": [{
                                        "ExchangeSegment": exchange_segment,
                                        "SecurityId": str(new_sid)
                                    }]
                                }))

                                subscribed.add(new_sid)
                                print(f"✅ Subscribed: {new_sid}")

                    except asyncio.QueueEmpty:
                        pass

                    except Exception as e:
                        print("❌ Subscription error:", e)


                    # 📥 2. Receive ticks
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=0.01)

                        if isinstance(msg, bytes):
                            size = len(msg)

                            # 🔹 COMPACT PACKET
                            if size == 16:
                                data = decode_compact_packet(msg)
                                print("📊 COMPACT:", data)
                                await broadcast(data)

                            # 🔹 FULL PACKET
                            elif size >= 160:
                                data = decode_full_packet(msg)
                                data["depth"] = decode_depth(msg)

                                print("\n📘 MARKET DEPTH:")
                                for i, d in enumerate(data["depth"]):
                                    print(
                                        f"L{i+1} BID {d['bid_price']} ({d['bid_qty']}) | "
                                        f"ASK {d['ask_price']} ({d['ask_qty']})"
                                    )

                                from datetime import datetime
                                data["ltt_readable"] = data["ltt"]

                                import pprint
                                pp = pprint.PrettyPrinter(indent=2)

                                print("\n📊 FULL PACKET:")
                                pp.pprint(data)

                                await broadcast(data)

                            else:
                                print("💓 Control packet")

                    except asyncio.TimeoutError:
                        # Normal — no tick received
                        pass
                    except websockets.ConnectionClosed:
                        print("⚠️ WebSocket disconnected")
                        break
                    except Exception as e:
                        print("❌ Receive error:", e)

        except Exception as e:
            print("🔥 Connection error:", e)

        # ⏳ backoff before reconnect
        await asyncio.sleep(1)


# -----------------------------
# 🚀 Startup
# -----------------------------
@app.on_event("startup")
async def startup():
    print('DHAN Server Startup'+ DHAN_TOKEN)
    asyncio.create_task(dhan_feed())