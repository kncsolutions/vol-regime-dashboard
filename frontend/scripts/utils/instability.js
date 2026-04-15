export function computeI1(buffer, window = 50) {
    const size = buffer.size;
    const end = buffer.index;

    if (!buffer.flow || !buffer.returns) return 0;
    if (!buffer.filled && end < window) return 0;

    let sumFlow = 0;
    let sumRet = 0;
    let count = 0;

    // --- MEAN ---
    for (let k = 0; k < window; k++) {
        const idx = (end - 1 - k + size) % size;

        const f = buffer.flow[idx];
        const r = buffer.returns[idx];

        if (!isFinite(f) || !isFinite(r)) continue;

        sumFlow += f;
        sumRet += r;
        count++;
    }

    if (count === 0) return 0;

    const meanFlow = sumFlow / count;
    const meanRet = sumRet / count;

    // --- VARIANCE ---
    let varFlow = 0;
    let varRet = 0;

    for (let k = 0; k < window; k++) {
        const idx = (end - 1 - k + size) % size;

        const f = buffer.flow[idx];
        const r = buffer.returns[idx];

        if (!isFinite(f) || !isFinite(r)) continue;

        varFlow += (f - meanFlow) ** 2;
        varRet += (r - meanRet) ** 2;
    }

    varFlow /= count;
    varRet /= count;

    const stdFlow = Math.sqrt(varFlow);
    const stdRet = Math.sqrt(varRet);

    if (stdFlow === 0 || stdRet === 0) return 0;

    // --- CURRENT ---
    const latestIdx = (end - 1 + size) % size;

    const currFlow = buffer.flow[latestIdx];
    const currRet = buffer.returns[latestIdx];

    if (!isFinite(currFlow) || !isFinite(currRet)) return 0;

    const zFlow = (currFlow - meanFlow) / stdFlow;
    const zRet = (currRet - meanRet) / stdRet;

    // 🔥 FINAL SIGNAL (USE THIS)
    return zFlow - zRet;
}