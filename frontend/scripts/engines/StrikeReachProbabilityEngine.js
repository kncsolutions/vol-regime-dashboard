export class StrikeReachProbabilityEngine {

    constructor({
        tradingDays = 252,
        secondsPerDay = 23400   // ~6.5h market
    } = {}) {
        this.tradingDays = tradingDays;
        this.secondsPerDay = secondsPerDay;
    }

    // -------------------------
    // Normal CDF approximation
    // -------------------------
    normalCDF(x) {
        return 0.5 * (1 + Math.erf(x / Math.sqrt(2)));
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

        if (!S || !K || !timeToMove || !iv) return null;

        // -------------------------
        // 1. Drift
        // -------------------------
        const mu = expectedMove / timeToMove;

        // -------------------------
        // 2. Volatility scaling
        // -------------------------
        const sigmaT = this.convertIVToUnit(
            iv,
            timeToMove,
            unit
        );

        if (sigmaT === 0) return null;

        // -------------------------
        // 3. Z-score
        // -------------------------
        const Z =
            (K - S - mu * timeToMove) / sigmaT;

        // -------------------------
        // 4. Probability
        // -------------------------
        const prob = 1 - this.normalCDF(Z);

        // clamp
        const probability =
            Math.max(0, Math.min(1, prob));

        return {
            probability,
            Z,
            drift: mu,
            sigmaT
        };
    }
}