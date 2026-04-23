// I1Buffer.js

export const I1Buffer = {
    size: 500,
    data: [],
    timestamps: []
};

export function pushI1(value, ts) {
    I1Buffer.data.push(value);
    I1Buffer.timestamps.push(Date.now());

    if (I1Buffer.data.length > I1Buffer.size) {
        I1Buffer.data.shift();
        I1Buffer.timestamps.shift();
    }
}

export function resetI1BufferHard() {
    I1Buffer.data = [];
    I1Buffer.timestamps = [];
}