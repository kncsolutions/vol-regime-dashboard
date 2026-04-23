function erf(x) {
    // constants
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p  = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}
// -------------------------
// Normal CDF approximation
// -------------------------
function normalCDF(x) {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

export class StrikeReachProbabilityEngine {

    constructor({
        tradingDays = 252,
        secondsPerDay = 23400   // ~6.5h market
    } = {}) {
        this.tradingDays = tradingDays;
        this.secondsPerDay = secondsPerDay;
    }



    // -------------------------
    // Convert IV → per unit
    // -------------------------
    convertIVToUnit(iv, timeToMove, unit = "seconds") {

        if (!iv || !timeToMove) return 0;

        let T_year;

        if (unit === "seconds") {
            const totalSecondsYear =
                this.tradingDays * this.secondsPerDay;
            T_year = timeToMove / totalSecondsYear;
        } else {
            // fallback (bars or minutes)
            T_year = timeToMove / (this.tradingDays * 390);
        }

        return iv * Math.sqrt(T_year);
    }

    // -------------------------
    // Core Compute
    // -------------------------
   compute({
    S,
    K,
    expectedMove,
    timeToMove,
    iv,
    unit = "seconds"
}) {

    // -------------------------
    // 0. Hard guards (only for absolute invalids)
    // -------------------------
    if (!S || !K) return null;

    // -------------------------
    // 1. Safe inputs (NO pipeline breaks)
    // -------------------------
    const safeIV   = (iv != null && isFinite(iv)) ? iv : (this.lastIV ?? 0.12);
    const safeTime = (timeToMove != null && isFinite(timeToMove))
        ? Math.max(1, timeToMove)
        : (this.lastTime ?? 60);

    const safeMove = (expectedMove != null && isFinite(expectedMove))
        ? expectedMove
        : 0;

    // persist state
    this.lastIV = safeIV;
    this.lastTime = safeTime;

    // -------------------------
    // 2. Volatility scaling (log space)
    // -------------------------
    let sigmaT = this.convertIVToUnit(
        safeIV,
        safeTime,
        unit
    );

    // sigma floor to prevent collapse
    const MIN_SIGMA_T = 0.005;
    sigmaT = Math.max(sigmaT, MIN_SIGMA_T);

    // -------------------------
    // 3. Drift (DISABLED by default)
    // -------------------------
    // Drift in log space — but safer to keep 0 initially
    let mu = 0;

    // Optional (enable later if needed)
    // mu = Math.log(1 + safeMove / S) / safeTime;

    // -------------------------
    // 4. Log-moneyness (CRITICAL FIX)
    // -------------------------
    const logMoneyness = Math.log(K / S);

    // -------------------------
    // 5. Z-score (dimensionally correct)
    // -------------------------
    let Z = (logMoneyness - mu * safeTime) / sigmaT;

    // guard against explosions
    if (!isFinite(Z)) {
        console.warn("Z unstable", {
            S,
            K,
            safeIV,
            safeTime,
            sigmaT,
            logMoneyness
        });
        Z = 0;
    }

    // -------------------------
    // 6. Terminal probability
    // -------------------------
    const terminalProb = 1 - normalCDF(Z);

    // -------------------------
    // 7. Touch probability (better for reach)
    // -------------------------
    const touchProb = Math.min(1, 2 * terminalProb);

    // -------------------------
    // 8. Clamp + return
    // -------------------------
    const probability = Math.max(0.001, Math.min(0.999, touchProb));

    return {
        probability,
        Z,
        sigmaT,
        drift: mu,
        inputs: {
            iv: safeIV,
            time: safeTime
        }
    };
}
}