export const dSBuffer = {
    data: [],
    max: 500
};

export function pushdS(dS, flow, G2, zone, timestamp) {
    if (!dS) return;

    dSBuffer.data.push({
    time: timestamp,
    raw: dS.dS_raw,
    norm: dS.dS_norm,
    adj: dS.dS_adj,
    flow,
    G2,
    zone   // 🔥 store it
    });

    if (dSBuffer.data.length > dSBuffer.max) {
        dSBuffer.data.shift();
    }
}

export function resetdSBufferHard() {
    dSBuffer.data = [];
}