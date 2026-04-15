// core/websocket/WebSocketManager.js

import { WebSocketClient } from "./webSocketClient.js";
import { EventBus } from "./EventBus.js";

export class WebSocketManager {

    constructor(url) {
        this.client = new WebSocketClient(url);

        this.currentSecurityId = null;
        this.currentSymbol = null;

        this._bindEvents();
    }

    _bindEvents() {

        this.client.on("open", () => {
            console.log("✅ WS Connected");

            if (this.currentSecurityId) {
                this.subscribe(this.currentSecurityId, this.currentSymbol);
            }

            EventBus.emit("ws:open");
        });

        this.client.on("message", (data) => {

            // 🔥 FILTER HERE (clean)
            if (!this._isRelevant(data)) return;

            // 🔥 EMIT CLEAN EVENTS
            EventBus.emit("tick", data);

        });

        this.client.on("close", () => {
            console.warn("⚠️ WS Closed");
            EventBus.emit("ws:close");
        });

        this.client.on("error", (err) => {
            console.error("WS Error:", err);
            EventBus.emit("ws:error", err);
        });
    }

    _isRelevant(data) {
        return String(data.securityId) === String(this.currentSecurityId);
    }

    connect() {
        this.client.connect();
    }

    disconnect() {
        this.client.close();
    }

    subscribe(securityId, symbol) {

        this.currentSecurityId = String(securityId);
        this.currentSymbol = symbol;

        this.client.send({
            type: "switch",
            securityId: this.currentSecurityId,
            securityName: symbol
        });

        EventBus.emit("ws:subscribed", {
            securityId,
            symbol
        });
    }

    switchSymbol(securityId, symbol) {
        this.subscribe(securityId, symbol);
    }
}