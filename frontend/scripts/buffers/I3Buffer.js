export const I3Buffer = {
    data: [],
    max: 500
};

export function pushI3(I3, timestamp) {
    if (I3 == null || isNaN(I3)) return;

    I3Buffer.data.push({
        time: timestamp,
        value: I3
    });

    if (I3Buffer.data.length > I3Buffer.max) {
        I3Buffer.data.shift();
    }
}

/**
 * ----------------------------------------
 * RESET I3 BUFFER
 * ----------------------------------------
 */
export function resetI3BufferHard() {
    I3Buffer.data = [];
}