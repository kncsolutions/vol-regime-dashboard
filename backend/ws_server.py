from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import websockets
import json
import os

app = FastAPI()

clients = set()

# 🔐 Load config
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "dhanconfig.json")

with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)

DHAN_TOKEN = CONFIG["auth"]["token"]
DHAN_CLIENT_ID = CONFIG["auth"]["client_id"]


# -----------------------------
# 🔌 Client WebSocket Endpoint
# -----------------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    print("Client connected:", len(clients))

    try:
        while True:
            await ws.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        clients.discard(ws)
        print("Client disconnected:", len(clients))


# -----------------------------
# 📡 Broadcast
# -----------------------------
async def broadcast(data):
    dead = []

    for client in clients:
        try:
            await client.send_json(data)
        except:
            dead.append(client)

    for d in dead:
        clients.discard(d)


# -----------------------------
# 🔥 Dhan WebSocket Feed
# -----------------------------
async def dhan_feed():
    uri = "wss://api-feed.dhan.co"

    while True:
        try:
            async with websockets.connect(uri) as ws:

                print("Connected to Dhan")

                await ws.send(json.dumps({
                    "action": "authenticate",
                    "params": {
                        "clientId": DHAN_CLIENT_ID,
                        "accessToken": DHAN_TOKEN
                    }
                }))

                await ws.send(json.dumps({
                    "action": "subscribe",
                    "params": {
                        "mode": "ltp",
                        "instruments": [
                            {
                                "exchangeSegment": "NSE_EQ",
                                "securityId": "1333"
                            }
                        ]
                    }
                }))

                while True:
                    msg = await ws.recv()

                    try:
                        data = json.loads(msg)
                    except:
                        continue

                    # 🔍 Filter valid ticks
                    if isinstance(data, dict) and "ltp" in data:
                        await broadcast({
                            "ltp": data.get("ltp"),
                            "timestamp": data.get("timestamp"),
                            "securityId": data.get("securityId")
                        })

        except Exception as e:
            print("Reconnect due to error:", e)
            await asyncio.sleep(2)


# -----------------------------
# 🚀 Startup
# -----------------------------
@app.on_event("startup")
async def startup():
    asyncio.create_task(dhan_feed())