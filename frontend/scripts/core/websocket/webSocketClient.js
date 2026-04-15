// core/websocket/WebSocketClient.js

export class WebSocketClient {

    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectDelay = 2000;

        this.handlers = {
            open: () => {},
            message: () => {},
            close: () => {},
            error: () => {}
        };
    }

    connect() {
        if (this.ws) this.ws.close();

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.handlers.open();
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handlers.message(data);
        };

        this.ws.onclose = () => {
            this.handlers.close();
            setTimeout(() => this.connect(), this.reconnectDelay);
        };

        this.ws.onerror = (err) => {
            this.handlers.error(err);
        };
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    on(event, handler) {
        this.handlers[event] = handler;
    }
}