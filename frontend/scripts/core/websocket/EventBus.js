// core/websocket/EventBus.js
export const EventBus = (() => {

    const events = new Map();

    function on(event, handler) {
        if (!events.has(event)) {
            events.set(event, new Set());
        }
        events.get(event).add(handler);
    }

    function off(event, handler) {
        if (events.has(event)) {
            events.get(event).delete(handler);
        }
    }

    function emit(event, payload) {
        if (!events.has(event)) return;

        for (const handler of events.get(event)) {
            try {
                handler(payload);
            } catch (e) {
                console.error("EventBus error:", e);
            }
        }
    }

    return { on, off, emit };

})();