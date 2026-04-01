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

            # 🔁 SWITCH (replace previous)
            if msg_type == "switch":
                client_subscriptions[ws] = security_id

                await subscription_queue.put({
                    "action": "subscribe",
                    "securityId": security_id
                })

                print(f"🔄 Client switched → {security_id}")

            # ➕ SUBSCRIBE (additive, optional)
            elif msg_type == "subscribe":
                client_subscriptions[ws] = security_id

                await subscription_queue.put({
                    "action": "subscribe",
                    "securityId": security_id
                })

                print(f"📡 Client subscribed → {security_id}")

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

    for client in clients:
        try:
            # 🎯 send only relevant ticks
            if client_subscriptions.get(client) == sid:
                await client.send_json(data)
        except:
            dead.append(client)

    for d in dead:
        clients.discard(d)
        client_subscriptions.pop(d, None)


# -----------------------------
# 🔥 Dhan WebSocket Feed
# -----------------------------
async def dhan_feed():
    uri = "wss://api-feed.dhan.co"

    while True:
        try:
            async with websockets.connect(uri) as ws:

                print("🚀 Connected to Dhan")

                # 🔐 Authenticate
                await ws.send(json.dumps({
                    "action": "authenticate",
                    "params": {
                        "clientId": DHAN_CLIENT_ID,
                        "accessToken": DHAN_TOKEN
                    }
                }))

                subscribed = set()

                while True:

                    # 🔄 Handle new subscriptions
                    try:
                        while True:
                            sub = subscription_queue.get_nowait()
                            sid = sub["securityId"]

                            if sid not in subscribed:
                                subscribed.add(sid)

                                await ws.send(json.dumps({
                                    "action": "subscribe",
                                    "params": {
                                        "mode": "ltp",
                                        "instruments": [{
                                            "exchangeSegment": "NSE_EQ",
                                            "securityId": sid
                                        }]
                                    }
                                }))

                                print("📡 Subscribed to:", sid)

                    except asyncio.QueueEmpty:
                        pass

                    # 📥 Receive tick
                    msg = await ws.recv()

                    try:
                        data = json.loads(msg)
                    except:
                        continue

                    # 🎯 Filter valid ticks
                    if isinstance(data, dict) and "ltp" in data:
                        await broadcast(data)

        except Exception as e:
            print("⚠️ Reconnect due to error:", e)
            await asyncio.sleep(2)


# -----------------------------
# 🚀 Startup
# -----------------------------
@app.on_event("startup")
async def startup():
    asyncio.create_task(dhan_feed())