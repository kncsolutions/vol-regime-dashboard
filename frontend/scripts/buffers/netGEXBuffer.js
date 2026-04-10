/**
 * ============================================================
 * 📦 Net GEX Buffer Module
 * ============================================================
 *
 * Description:
 * High-performance in-memory buffer for tracking Net Gamma Exposure
 * (GEX) and related structural metrics in real-time.
 *
 * This buffer is a central component in identifying gamma regimes,
 * dealer positioning, and market stability dynamics.
 *
 * Version: 1.0.0
 * License: MIT (see LICENSE file)
 *
 * Developed by: Pallav Nandi Chaudhuri
 * ============================================================
 */


// ============================================================
// 📦 NET GEX BUFFER (SINGLETON)
// ============================================================
// Stores time-series data for gamma exposure and derived signals.
//
// 🔥 Architecture Role:
// Option Chain → GEX Computation → Buffer → Models → Charts
//
// 🔥 Design Principles:
// - Fixed-size buffer (1000 points)
// - Shared singleton across modules
// - Optimized for real-time updates
// - Supports regime detection + structural analysis
//
// ⚠️ IMPORTANT:
// - Do NOT reinitialize after import
// - Always mutate or reset using provided utilities
//
export const netGEXBuffer = {

    // --------------------------------------------------
    // ⚙️ BUFFER CONFIGURATION
    // --------------------------------------------------
    size: 1000,        // Maximum number of data points stored
    index: 0,          // Write pointer (for circular or shift-based updates)
    filled: false,     // True once buffer reaches full capacity


    // --------------------------------------------------
    // ⏱️ TIME
    // --------------------------------------------------
    timestamp: new Array(1000),
    // Exchange timestamp or snapshot time


    // --------------------------------------------------
    // 📊 CORE GEX METRICS
    // --------------------------------------------------
    net_gex: new Array(1000),
    // Total net gamma exposure (call GEX - put GEX)

    call_gex: new Array(1000),
    // Aggregate call-side gamma exposure

    put_gex: new Array(1000),
    // Aggregate put-side gamma exposure


    // --------------------------------------------------
    // 🧠 STRUCTURAL LEVELS
    // --------------------------------------------------
    gamma_flip: new Array(1000),
    // Gamma flip level (price where net GEX = 0)

    spot: new Array(1000),
    // Underlying spot price

    spot_vs_flip: new Array(1000),
    // Distance of spot from gamma flip:
    // (spot - gamma_flip)


    // --------------------------------------------------
    // 📈 DERIVED SIGNALS
    // --------------------------------------------------
    regime: new Array(1000),
    // Gamma regime classification:
    // +1 → Long Gamma (mean-reverting)
    // -1 → Short Gamma (trend-amplifying)

    gex_change: new Array(1000),
    // Change in net GEX (ΔGEX)
    // Useful for detecting structural shifts
};



// ============================================================
// 🔄 RESET NET GEX BUFFER
// ============================================================
// Clears buffer contents without reallocating memory.
//
// 🔥 Why this is critical:
// - Prevents GC overhead (no new array creation)
// - Preserves object reference across modules
// - Enables fast reset on symbol/timeframe change
//
// 🔥 When to use:
// - Switching underlying symbol
// - Resetting session / strategy
// - Re-initializing analytics pipeline
//
// ⚠️ Behavior:
// - Mutates existing buffer (no new object created)
// - Safe to call multiple times (idempotent)
//
export function resetNetGEXBuffer() {

    // Reset pointer state
    netGEXBuffer.index = 0;
    netGEXBuffer.filled = false;

    // Efficiently clear all array fields
    Object.keys(netGEXBuffer).forEach(key => {

        // Only reset array-based properties
        if (Array.isArray(netGEXBuffer[key])) {

            // Fill with null to indicate absence of data
            // (explicitly cleaner than undefined for analytics pipelines)
            netGEXBuffer[key].fill(null);
        }
    });
}

export function updateNetGEXBuffer(buffer, data) {

    const size = buffer.size;

    // =========================
    // SHIFT LEFT (FIFO)
    // =========================
    for (let i = 0; i < size - 1; i++) {

        buffer.timestamp[i] = buffer.timestamp[i + 1];

        buffer.net_gex[i] = buffer.net_gex[i + 1];
        buffer.call_gex[i] = buffer.call_gex[i + 1];
        buffer.put_gex[i] = buffer.put_gex[i + 1];

        buffer.gamma_flip[i] = buffer.gamma_flip[i + 1];
        buffer.spot[i] = buffer.spot[i + 1];
        buffer.spot_vs_flip[i] = buffer.spot_vs_flip[i + 1];

        buffer.regime[i] = buffer.regime[i + 1];
        buffer.gex_change[i] = buffer.gex_change[i + 1];
    }

    // =========================
    // INSERT NEW VALUE
    // =========================
    const last = size - 1;

    buffer.timestamp[last] = data.timestamp || Date.now();

    buffer.net_gex[last] = data.net_gex;
    buffer.call_gex[last] = data.call_gex;
    buffer.put_gex[last] = data.put_gex;

    buffer.gamma_flip[last] = data.gamma_flip;
    buffer.spot[last] = data.spot;

    buffer.spot_vs_flip[last] =
        data.spot && data.gamma_flip
            ? data.spot - data.gamma_flip
            : null;

    // =========================
    // DERIVED FEATURES
    // =========================
    buffer.regime[last] =
        data.net_gex > 0 ? 1 : -1;

    const prev = last - 1;

    buffer.gex_change[last] =
        buffer.net_gex[last] - (buffer.net_gex[prev] || 0);

    // =========================
    // MARK FILLED
    // =========================
    buffer.filled = true;
}