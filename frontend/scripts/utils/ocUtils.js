import {computeGammaLadder, computeNetGEX, computeGammaFlip,computeGEXGradient,
computeVegaLadder, computeVegaSkew} from "../services/optionChainService.js";
let lastOptionRows = null;
let lastOCUpdateTs = null;
// -----------------------------
// SETTERS
// -----------------------------
export function setOptionRows(rows) {
    lastOptionRows = rows;
}

export function setOCUpdateTs(ts) {
    lastOCUpdateTs = ts;
}

// -----------------------------
// GETTERS
// -----------------------------
export function getOptionRows() {
    return lastOptionRows;
}

export function getOCUpdateTs() {
    return lastOCUpdateTs;
}
export function isValidOC(optionChain) {
    const oc = optionChain?.data?.data?.oc;

    return oc && Object.keys(oc).length > 0;
}

export function processOptionChain(optionChain) {

    // ----------------------------
    // 1. Extract + Validate
    // ----------------------------
    const oc = extractOC(optionChain);
//    console.log('oc', oc);

    if (!oc || Object.keys(oc).length === 0) {
        return { valid: false };
    }

    const rows = normalizeOC(oc);

    if (!rows || rows.length === 0) {
        return { valid: false };
    }

    // ----------------------------
    // 2. Core Calculations
    // ----------------------------
    const gammaLadder = computeGammaLadder(rows);
    const netGEX = computeNetGEX(gammaLadder);
    const vegaLadder = computeVegaLadder(rows);
    const vegaSkew = computeVegaSkew(rows);
    const gexGradient = computeGEXGradient(gammaLadder);

    // ----------------------------
    // 3. ADV (Notional Liquidity Proxy)
    // ----------------------------
    let rawADV = 0;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];

        const oi = (r.ce_oi || 0) + (r.pe_oi || 0);
        rawADV += oi * r.strike;
    }

    // normalize by number of strikes
    let adv = rawADV / rows.length;

    // safety floor (critical)
    adv = Math.max(adv, 1e6);

    // ----------------------------
    // 4. Data Quality Score (optional but powerful)
    // ----------------------------
    const confidence = Math.min(1, rows.length / 100);

    // ----------------------------
    // 5. Return Structured Result
    // ----------------------------
    return {
        valid: true,

        // core
        rows,
        gammaLadder,
        netGEX,
        gexGradient,
        vegaLadder,
        vegaSkew,

        // 🔥 critical for RRP
        adv,

        // 🔥 optional upgrade
        confidence
    };
}

function normalizeOC(oc) {
    const rows = [];

    Object.entries(oc).forEach(([strikeStr, value]) => {
        const strike = Number(strikeStr);

        const ce = value.ce || {};
        const pe = value.pe || {};

        rows.push({
            strike,

            // EXISTING
            ce_gamma: Number(ce.greeks?.gamma || 0),
            pe_gamma: Number(pe.greeks?.gamma || 0),

            ce_oi: Number(ce.oi || 0),
            pe_oi: Number(pe.oi || 0),

            // 🔥 ADD THIS
            ce_oi_change: Number(ce.oi_change || ce.change_in_oi || ce.oi - ce.previous_oi || 0),
            pe_oi_change: Number(pe.oi_change || pe.change_in_oi || pe.oi - pe.previous_oi || 0),

            ce_vega: Number(ce.greeks?.vega || 0),
            pe_vega: Number(pe.greeks?.vega || 0)
        });
    });

    rows.sort((a, b) => a.strike - b.strike);

    return rows;
}

export function extractOC(optionChain) {
    return optionChain?.data?.data?.oc || {};
}

export function extractAvailableStrikes(optionRows) {
    if (!optionRows) return [];

    return optionRows
        .map(r => r.strike)
        .filter(s => isFinite(s))
        .sort((a, b) => a - b);
}


export function findClosestStrike(strikes, target) {

    if (!strikes || strikes.length === 0) return null;

    let closest = strikes[0];
    let minDiff = Math.abs(target - closest);

    for (const s of strikes) {
        const diff = Math.abs(target - s);

        if (diff < minDiff) {
            minDiff = diff;
            closest = s;
        }
    }

    return closest;
}

export function getStrikeFromExpectedMove({
    spot,
    expectedMove,
    optionRows,
    direction = "call"
}) {

    if (!spot || !expectedMove || !optionRows) return null;

    const strikes = extractAvailableStrikes(optionRows);

    const target =
        direction === "call"
            ? spot + expectedMove
            : spot - expectedMove;

    const strike = findClosestStrike(strikes, target);

    return {
        strike,
        target,
        distance: Math.abs(strike - target)
    };
}