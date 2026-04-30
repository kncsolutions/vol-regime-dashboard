// snapshotModule.js

// ==============================
// 🔧 CORE: 1σ FILTERED MEAN
// ==============================
export function meanStd(values) {
    if (!values || values.length === 0) {
        return { mean: null, std: null };
    }

    const clean = values.filter(v => v != null && isFinite(v));
    if (clean.length === 0) return { mean: null, std: null };

    const mean =
        clean.reduce((a, b) => a + b, 0) / clean.length;

    const variance =
        clean.reduce((a, b) => a + (b - mean) ** 2, 0) / clean.length;

    const std = Math.sqrt(variance);

    return { mean, std };
}

export function oneSigmaFilteredMean(values) {
    if (!values || values.length === 0) return null;

    const { mean, std } = meanStd(values);
    if (mean == null || std == null) return null;

    const lower = mean - std;
    const upper = mean + std;

    let sum = 0;
    let count = 0;

    for (const v of values) {
        if (v == null || !isFinite(v)) continue;

        if (v >= lower && v <= upper) {
            sum += v;
            count++;
        }
    }

    return count > 0 ? sum / count : mean;
}

// ==============================
// 🔄 HELPERS
// ==============================
function extractLastN(arr, key = null, n = 200) {
    if (!arr || arr.length === 0) return [];

    const slice = arr.slice(-n);

    const values = [];

    for (const item of slice) {

        let val;

        if (key) {
            val = item?.[key];
        } else {
            val = item;   // ✅ direct number (I1/I2/I3)
        }

        if (val != null && isFinite(val)) {
            values.push(val);
        }
    }

    return values;
}

export function extractFlowLastN(marketBuffer, n = 200) {
    const size = marketBuffer.size;
    const i = marketBuffer.index;

    const values = [];

    for (let j = 0; j < n; j++) {
        const idx = (i - 1 - j + size) % size;
        const val = marketBuffer.imbalance[idx];

        if (val != null && isFinite(val)) {
            values.push(val);
        }
    }

    return values;
}

function getLastFromBufferArray(buffer, key) {
    const arr = buffer?.[key];

    if (!arr || !Array.isArray(arr)) return null;

    if (!buffer.filled) {
        const i = buffer.index - 1;
        return i >= 0 ? arr[i] : null;
    }

    return arr[buffer.size - 1];
}
function getLastNFromBufferArray(buffer, key, n = 200) {
    const arr = buffer?.[key];
    if (!arr || !Array.isArray(arr)) return [];

    const values = [];

    if (!buffer.filled) {
        const end = buffer.index;
        const start = Math.max(0, end - n);

        for (let i = start; i < end; i++) {
            const v = arr[i];
            if (v != null && isFinite(v)) {
                values.push(v);
            }
        }

        return values;
    }

    // FILLED → take last N from shifted buffer
    const size = buffer.size;
    const start = Math.max(0, size - n);

    for (let i = start; i < size; i++) {
        const v = arr[i];
        if (v != null && isFinite(v)) {
            values.push(v);
        }
    }

    return values;
}
function extractdSValues(arr, n = 200) {
    if (!arr || arr.length === 0) return [];

    return arr.slice(-n)
        .map(x => x?.adj)   // ✅ FIXED KEY
        .filter(v => v != null && isFinite(v));
}
function extractFlowFromdS(arr, n = 200) {
    if (!arr || arr.length === 0) return [];

    return arr.slice(-n)
        .map(x => x?.flow)
        .filter(v => v != null && isFinite(v));
}

export function extractValues(arr, options = {}) {
    const {
        key = null,     // for object arrays
        n = 200
    } = options;

    if (!arr || arr.length === 0) return [];

    const slice = arr.slice(-n);

    const values = [];

    for (const item of slice) {

        let val;

        // Case 1: direct number (I1Buffer)
        if (typeof item === "number") {
            val = item;
        }

        // Case 2: object with key (I2, I3, dS)
        else if (key) {
            val = item?.[key];
        }

        // Case 3: fallback (try common patterns)
        else {
            val = item?.value ?? item?.adj ?? null;
        }

        if (val != null && isFinite(val)) {
            values.push(val);
        }
    }

    return values;
}
export function getLatestGEX(buffer) {

    if (!buffer) return null;

    let idx;

    // If buffer not yet filled, use index - 1
    if (!buffer.filled) {
        idx = buffer.index - 1;
        if (idx < 0) return null;
    }
    // If filled (your current case), last element is latest
    else {
        idx = buffer.size - 1;
    }

    const callGEX = buffer.call_gex[idx];
    const putGEX  = buffer.put_gex[idx];
    const netGEX  = buffer.net_gex[idx];

    // Safety check
    if (
        callGEX == null || !isFinite(callGEX) ||
        putGEX == null  || !isFinite(putGEX)
    ) {
        return null;
    }

    return {
        callGEX,
        putGEX,
        netGEX
    };
}

export function getLatestSkew(buffer) {

    if (!buffer) return null;

    let idx;

    // Not filled yet
    if (!buffer.filled) {
        idx = buffer.index - 1;
        if (idx < 0) return null;
    }
    // Filled → last element
    else {
        idx = buffer.size - 1;
    }

    const callSkew = buffer.call_skew[idx];
    const putSkew  = buffer.put_skew[idx];

    // Safety check
    if (
        callSkew == null || !isFinite(callSkew) ||
        putSkew  == null || !isFinite(putSkew)
    ) {
        return null;
    }

    return {
        callSkew,
        putSkew
    };
}

export function getLatestMarketMicrostructure(buffer) {

    if (!buffer) return null;

    const last = buffer.size - 1;

    const imbalance  = buffer.imbalance[last];
    const microprice = buffer.microprice[last];

    // 🔥 compute spread from bid/ask
    const bid = buffer.bid[last];
    const ask = buffer.ask[last];

    const spread =
        (bid != null && ask != null && isFinite(bid) && isFinite(ask))
            ? (ask - bid)
            : null;

    // Safety check
    if (
        imbalance == null || !isFinite(imbalance) ||
        microprice == null || !isFinite(microprice)
    ) {
        return null;
    }

    return {
        imbalance,
        microprice,
        spread
    };
}

// ==============================
// 📸 SNAPSHOT BUILDER
// ==============================
export function buildSnapshot({
    I1Buffer,
    I2Buffer,
    I3Buffer,
    dSBuffer,
    volFeatureBuffer,
    marketBuffer,
    netGEXBuffer,
    marketState,
    currentSpot,
    currentGammaFlip,
    window = 200
}) {

    // ---- I signals
   // I1 → raw numbers
    const I1_vals = extractValues(I1Buffer.data);

    // I2 / I3 → objects
    const I2_vals = extractValues(I2Buffer.data, { key: "value" });
    const I3_vals = extractValues(I3Buffer.data, { key: "value" });

    const I1 = oneSigmaFilteredMean(I1_vals);
    const I2 = oneSigmaFilteredMean(I2_vals);
    const I3 = oneSigmaFilteredMean(I3_vals);

    const dS_vals = extractdSValues(dSBuffer.data, window);
    const flow_vals = extractFlowFromdS(dSBuffer.data, window);

    const dS = oneSigmaFilteredMean(dS_vals);
    const flow = oneSigmaFilteredMean(flow_vals);

    // ---- IV (FIXED)
    const iv_vals = getLastNFromBufferArray(volFeatureBuffer, "atm_iv", window);
    const IV = oneSigmaFilteredMean(iv_vals);

     // =========================
    // 🔥 GEX EXTRACTION
    // =========================
    const latestGEX = getLatestGEX(netGEXBuffer);

    const callGEX = latestGEX?.callGEX ?? null;
    const putGEX  = latestGEX?.putGEX ?? null;
    const netGEX  = latestGEX?.netGEX ?? marketState.netGEX ?? null;


    const latestSkew = getLatestSkew(volFeatureBuffer);

    const callSkew = latestSkew?.callSkew ?? null;
    const putSkew  = latestSkew?.putSkew ?? null;

    const micro = getLatestMarketMicrostructure(marketBuffer);

    const imbalance  = micro?.imbalance ?? null;
    const microprice = micro?.microprice ?? null;
    const spread     = micro?.spread ?? null;

    return {
        time: Date.now(),

        ltp: currentSpot ?? null,
        gammaFlip: currentGammaFlip ?? null,

         // 🔥 MICROSTRUCTURE
        imbalance,
        microprice,
        spread,

        flow,
        dS,

        IV,
        callSkew,
        putSkew,
        // 🔥 GEX STRUCTURE
        netGEX,
        callGEX,
        putGEX,

        I1,
        I2,
        I3
    };
}