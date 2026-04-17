// ============================================================
// Flow ↔ dS Classification Engine
// ============================================================
// This module defines:
// 1. Zone classification (TRAP / BREAKOUT / NEUTRAL)
// 2. G2 signal strength model
//
// Core idea:
// Compare directional agreement between:
//   - flow (order flow / OFI proxy)
//   - dS (price response / structural response)
//
// ============================================================


/**
 * ============================================================
 * classifyZone
 * ============================================================
 *
 * PURPOSE:
 * Classify microstructure regime based on alignment between:
 *   flow and dS signals
 *
 * ------------------------------------------------------------
 * DEFINITIONS:
 *
 * flow = signed order flow (OFI-like signal)
 *
 * dS_raw = raw structural response
 * dS_adj = adjusted / filtered structural response
 *
 * ------------------------------------------------------------
 * ALIGNMENT:
 *
 * aligned_raw:
 *   sign(flow) = sign(dS_raw)
 *
 * aligned_adj:
 *   sign(flow) = sign(dS_adj)
 *
 * ------------------------------------------------------------
 * STRENGTH:
 *
 * strong_adj:
 *   |dS_adj| > θ   (θ ≈ 0.5)
 *
 * ------------------------------------------------------------
 * CLASSIFICATION LOGIC:
 *
 * TRAP:
 *   aligned_raw = true
 *   aligned_adj = false
 *
 *   → initial move looked correct
 *   → adjusted signal rejects it
 *
 * BREAKOUT:
 *   aligned_adj = true
 *   AND |dS_adj| > θ
 *
 *   → strong directional agreement
 *
 * NEUTRAL:
 *   otherwise
 *
 * ============================================================
 */
export function classifyZone({ flow, dS }) {

    if (!dS) return "NONE";

    const aligned_raw =
        Math.sign(flow) === Math.sign(dS.dS_raw);

    const aligned_adj =
        Math.sign(flow) === Math.sign(dS.dS_adj);

    const strong_adj = Math.abs(dS.dS_adj) > 0.5;

    // 🔴 TRAP: false directional signal
    if (aligned_raw && !aligned_adj) {
        return "TRAP";
    }

    // 🟢 BREAKOUT: true directional expansion
    if (aligned_adj && strong_adj) {
        return "BREAKOUT";
    }

    return "NEUTRAL";
}


/**
 * ============================================================
 * computeG2
 * ============================================================
 *
 * PURPOSE:
 * Compute directional strength score + classification
 *
 * OUTPUT:
 *   state ∈ {STRONG, WEAK, TRAP}
 *   score ∈ (-1, 1)
 *   prob  ∈ (0, 1)
 *
 * ============================================================
 *
 * INPUT VARIABLES:
 *
 * flow = signed order flow
 * dS_adj = adjusted structural move
 * I1 = instability (feedback amplification)
 * k  = impact coefficient (liquidity sensitivity)
 *
 * ============================================================
 *
 * 1. ALIGNMENT
 *
 * aligned_adj:
 *   sign(flow) = sign(dS_adj)
 *
 * aligned_raw:
 *   sign(flow) = sign(dS_raw)
 *
 * ------------------------------------------------------------
 *
 * 2. STRENGTH COMPONENTS
 *
 * flowStrength:
 *   |flow|
 *
 * moveStrength:
 *   |dS_adj|
 *
 * ------------------------------------------------------------
 *
 * 3. SCORE FUNCTION
 *
 * raw score:
 *
 *   S = |flow| · |dS_adj| · (1 + I1) · (1 + k)
 *
 * Interpretation:
 *   - |flow| → participation strength
 *   - |dS_adj| → price response
 *   - I1 → instability amplification
 *   - k → market impact scaling
 *
 * ------------------------------------------------------------
 *
 * 4. NONLINEAR NORMALIZATION
 *
 * score = tanh(S)
 *
 *   → compress to (-1, 1)
 *   → prevents explosion
 *
 * ------------------------------------------------------------
 *
 * 5. PROBABILITY MODEL
 *
 * logistic:
 *
 *   P = 1 / (1 + exp(- flow · dS_adj · I1 · k))
 *
 * Interpretation:
 *   - positive alignment → P → 1
 *   - negative alignment → P → 0
 *
 * ------------------------------------------------------------
 *
 * 6. TRAP DETECTION
 *
 * trap:
 *   aligned_raw = true
 *   AND aligned_adj = false
 *
 * → initial move invalidated
 *
 * ------------------------------------------------------------
 *
 * 7. FINAL STATE CLASSIFICATION
 *
 * STRONG:
 *   aligned_adj = true
 *   AND |flow| > threshold
 *   AND |dS_adj| > 0.5
 *
 * WEAK:
 *   default case
 *
 * TRAP:
 *   overrides all if trap = true
 *
 * ============================================================
 */
export function computeG2({
    flow,
    dS,
    I1 = 0,
    k = 0,
    threshold = 0.1
}) {
    if (!dS || flow == null) {
        return { state: "NONE", score: 0, trap: false };
    }

    // =========================
    // 1. ALIGNMENT
    // =========================
    const aligned_adj =
        Math.sign(flow) === Math.sign(dS.dS_adj);

    const aligned_raw =
        Math.sign(flow) === Math.sign(dS.dS_raw);

    // =========================
    // 2. STRENGTH
    // =========================
    const flowStrength = Math.abs(flow);
    const moveStrength = Math.abs(dS.dS_adj);

    // =========================
    // 3. SCORE
    // =========================
    let score =
        flowStrength *
        moveStrength *
        (1 + I1) *
        (1 + k);

    // tanh normalization
    score = Math.tanh(score);

    // =========================
    // 4. PROBABILITY
    // =========================
    const prob =
        1 / (1 + Math.exp(-flow * dS.dS_adj * I1 * k));

    // =========================
    // 5. TRAP
    // =========================
    const trap =
        aligned_raw && !aligned_adj;

    // =========================
    // 6. STATE
    // =========================
    let state = "WEAK";

    if (aligned_adj && flowStrength > threshold && moveStrength > 0.5) {
        state = "STRONG";
    }

    if (!aligned_adj) {
        state = "WEAK";
    }

    if (trap) {
        state = "TRAP";
    }

    return {
        state,
        score,
        prob,
        trap,
        aligned: aligned_adj,
        flowStrength,
        moveStrength
    };
}