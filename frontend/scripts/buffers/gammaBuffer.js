 export const gammaBuffer = {
    size: 30,
    index: 0,
    filled: false,

    states: new Array(30),   // raw states
    vectors: new Array(30),   // encoded vectors (for ML later)
    timestamps: new Array(30)
};

export function updateGammaBuffer(timestamp, state, vector = null) {

    const i = gammaBuffer.index;

    gammaBuffer.states[i] = state;
    gammaBuffer.vectors[i] = vector;
    gammaBuffer.timestamps[i] = timestamp;

    gammaBuffer.index = (i + 1) % gammaBuffer.size;

    if (gammaBuffer.index === 0) {
        gammaBuffer.filled = true;
    }
}

export function resetGammaBuffer() {
    gammaBuffer.index = 0;
    gammaBuffer.filled = false;

    gammaBuffer.states.fill(null);
    gammaBuffer.vectors.fill(null);
    gammaBuffer.timestamps.fill(null);
}