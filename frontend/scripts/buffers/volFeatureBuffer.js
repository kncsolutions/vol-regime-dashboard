export const volFeatureBuffer = {
    size: 1000,
    index: 0,
    filled: false,

    // =========================
    // TIME
    // =========================
    timestamp: new Array(1000),

    // =========================
    // CORE VOL FEATURES
    // =========================
    atm_iv: new Array(1000),

    // 🔥 NEW (quadratic model)
    skew: new Array(1000),           // b (tilt)
    curvature: new Array(1000),      // a (smile strength)
    skew_angle: new Array(1000),     // geometric interpretation

    // =========================
    // LEGACY (keep for comparison / debugging)
    // =========================
    call_skew: new Array(1000),
    put_skew: new Array(1000),

    // =========================
    // REALIZED VOL
    // =========================
    hv: new Array(1000),

    // =========================
    // PRICE
    // =========================
    ltp: new Array(1000),

    // =========================
    // 🔥 OPTIONAL (HIGH VALUE ADDITIONS)
    // =========================

    // skew velocity (Δskew)
    skew_change: new Array(1000),

    // curvature change (vol-of-vol proxy)
    curvature_change: new Array(1000),

    // IV change
    iv_change: new Array(1000)
};

export function resetVolFeatureBuffer() {
    volFeatureBuffer.index = 0;
    volFeatureBuffer.filled = false;

    const keys = Object.keys(volFeatureBuffer);

    keys.forEach(key => {
        if (Array.isArray(volFeatureBuffer[key])) {
            volFeatureBuffer[key].fill(null); // or 0 if preferred
        }
    });
}

export function updateVolFeatureBuffer(buffer, features) {

    // =========================
    // NOT FULL → NORMAL APPEND
    // =========================
    if (!buffer.filled) {
        const i = buffer.index

        buffer.timestamp[i] = features.timestamp
        buffer.atm_iv[i] = features.atm_iv

        buffer.skew[i] = features.skew
        buffer.curvature[i] = features.curvature
        buffer.skew_angle[i] = features.skew_angle

        buffer.call_skew[i] = features.call_skew
        buffer.put_skew[i] = features.put_skew

        buffer.hv[i] = features.hv
        buffer.ltp[i] = features.ltp

        // derivatives (safe init)
        buffer.skew_change[i] = 0
        buffer.curvature_change[i] = 0
        buffer.iv_change[i] = 0

        buffer.index++

        if (buffer.index >= buffer.size) {
            buffer.index = buffer.size - 1
            buffer.filled = true
        }

        return
    }

    // =========================
    // FULL → SHIFT LEFT (FIFO)
    // =========================
    const last = buffer.size - 1

    for (let i = 0; i < last; i++) {
        buffer.timestamp[i] = buffer.timestamp[i + 1]

        buffer.atm_iv[i] = buffer.atm_iv[i + 1]

        buffer.skew[i] = buffer.skew[i + 1]
        buffer.curvature[i] = buffer.curvature[i + 1]
        buffer.skew_angle[i] = buffer.skew_angle[i + 1]

        buffer.call_skew[i] = buffer.call_skew[i + 1]
        buffer.put_skew[i] = buffer.put_skew[i + 1]

        buffer.hv[i] = buffer.hv[i + 1]
        buffer.ltp[i] = buffer.ltp[i + 1]

        buffer.skew_change[i] = buffer.skew_change[i + 1]
        buffer.curvature_change[i] = buffer.curvature_change[i + 1]
        buffer.iv_change[i] = buffer.iv_change[i + 1]
    }

    // =========================
    // INSERT NEW AT END
    // =========================
    buffer.timestamp[last] = features.timestamp
    buffer.atm_iv[last] = features.atm_iv

    buffer.skew[last] = features.skew
    buffer.curvature[last] = features.curvature
    buffer.skew_angle[last] = features.skew_angle

    buffer.call_skew[last] = features.call_skew
    buffer.put_skew[last] = features.put_skew

    buffer.hv[last] = features.hv
    buffer.ltp[last] = features.ltp

    // =========================
    // DERIVATIVES (IMPORTANT)
    // =========================
    const prev = last - 1

    buffer.skew_change[last] =
        features.skew - buffer.skew[prev]

    buffer.curvature_change[last] =
        features.curvature - buffer.curvature[prev]

    buffer.iv_change[last] =
        features.atm_iv - buffer.atm_iv[prev]
}