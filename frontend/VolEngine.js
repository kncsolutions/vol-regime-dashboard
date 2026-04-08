export class VolEngine {

    constructor(config = {}) {

        this.window = config.window || 50
        this.minPoints = config.minPoints || 20

        // thresholds
        this.ivHvThreshold = config.ivHvThreshold || 0.02

        this.lowVolThreshold = config.lowVolThreshold || 0.15
        this.highVolThreshold = config.highVolThreshold || 0.35
    }

    // =========================
    // MAIN ENTRY
    // =========================
    computeState({ volFeatureBuffer }) {

        if (!volFeatureBuffer) return null

        const size = volFeatureBuffer.size
        const i = volFeatureBuffer.index
        const available = volFeatureBuffer.filled ? size : i

        if (available < this.minPoints) return null

        const latest = (i - 1 + size) % size

        const iv = volFeatureBuffer.atm_iv[latest]
        const hv = volFeatureBuffer.hv[latest]
        const callSkew = volFeatureBuffer.call_skew[latest]
        const putSkew = volFeatureBuffer.put_skew[latest]

        if (!iv || !hv) return null

        // =========================
        // SERIES
        // =========================
        const ivSeries = this._getSeries(volFeatureBuffer.atm_iv, available, size, i)
        const hvSeries = this._getSeries(volFeatureBuffer.hv, available, size, i)
        const callSkewSeries = this._getSeries(volFeatureBuffer.call_skew, available, size, i)
        const putSkewSeries = this._getSeries(volFeatureBuffer.put_skew, available, size, i)

        // =========================
        // DIRECTIONS (V1–V4)
        // =========================
        const V1 = this._direction(ivSeries)        // ATM IV
        const V2 = this._direction(putSkewSeries)   // Put skew
        const V3 = this._direction(callSkewSeries)  // Call skew
        const V4 = this._direction(hvSeries)        // HV

        // =========================
        // IV RICHNESS (V5)
        // =========================
        const spread = iv - hv

        const V5 = spread > this.ivHvThreshold
            ? "IV_RICH"
            : spread < -this.ivHvThreshold
                ? "IV_CHEAP"
                : "FAIR"

        // =========================
        // VOL LEVEL (V6)
        // =========================
        const V6 = this._volBucket(iv)

        // =========================
        // FINAL STATE
        // =========================
        const state = {
            V1, V2, V3, V4, V5, V6
        }

        return {
            iv,
            hv,
            callSkew,
            putSkew,
            spread,

            state,

            // 🔥 Encoded compact form (useful for ML / logs)
            stateKey: this._encodeState(state)
        }
    }

    // =========================
    // FACTOR BUILDERS
    // =========================

    _direction(series, lookback = 5) {

        if (!series || series.length < lookback + 1) return "FLAT"

        const latest = series[series.length - 1]
        const past = series[series.length - 1 - lookback]

        if (!latest || !past) return "FLAT"

        const diff = latest - past

        if (diff > 0) return "UP"
        if (diff < 0) return "DOWN"

        return "FLAT"
    }

    _volBucket(iv) {

        if (iv < this.lowVolThreshold) return "LOW_VOL"
        if (iv > this.highVolThreshold) return "HIGH_VOL"
        return "MID_VOL"
    }

    // =========================
    // HELPERS
    // =========================

    _getSeries(arr, available, size, index) {

        const result = []
        const count = Math.min(this.window, available)

        for (let j = 0; j < count; j++) {
            const idx = (index - 1 - j + size) % size
            const val = arr[idx]

            if (val == null || !isFinite(val)) continue

            result.push(val)
        }

        return result.reverse()
    }

    _encodeState(state) {
        return [
            state.V1,
            state.V2,
            state.V3,
            state.V4,
            state.V5,
            state.V6
        ].join("|")
    }
}