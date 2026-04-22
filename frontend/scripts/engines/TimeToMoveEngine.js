// ======================================
// ⏱️ TimeToMoveEngine
// ======================================

export class TimeToMoveEngine {

    constructor({
        minVelocity = 1e-6,
        maxHorizon = 1000,     // cap (in bars / seconds depending on data)
        emaAlpha = 0.2
    } = {}) {

        this.minVelocity = minVelocity;
        this.maxHorizon = maxHorizon;
        this.emaAlpha = emaAlpha;

        this.velocityEMA = null;
    }

    // -------------------------
    // Smooth velocity (EMA)
    // -------------------------
    smoothVelocity(v) {
        if (!isFinite(v)) return 0;

        if (this.velocityEMA == null) {
            this.velocityEMA = v;
        } else {
            this.velocityEMA =
                this.emaAlpha * v +
                (1 - this.emaAlpha) * this.velocityEMA;
        }

        return this.velocityEMA;
    }

    // -------------------------
    // Core Compute
    // -------------------------
    compute({
        expectedMove,
        dS,
        I1,
        liquidity,
        regime,     // optional
        trap        // optional
    }) {

        if (!isFinite(expectedMove) || !isFinite(dS)) {
            return null;
        }

        // -------------------------
        // 1. Base velocity
        // -------------------------
        let baseVelocity = Math.abs(dS);

        // avoid dead division
        if (baseVelocity < this.minVelocity) {
            return {
                timeToMove: null,
                velocity: 0,
                regimeAdjusted: false
            };
        }

        // -------------------------
        // 2. Adjust velocity
        // -------------------------
        let velocity =
            baseVelocity *
            (1 + (I1 || 0)) *
            (liquidity || 1);

        // -------------------------
        // 3. Smooth it
        // -------------------------
        velocity = this.smoothVelocity(velocity);

        if (velocity < this.minVelocity) {
            return {
                timeToMove: null,
                velocity,
                regimeAdjusted: false
            };
        }

        // -------------------------
        // 4. Raw time
        // -------------------------
        let timeToMove =
            Math.abs(expectedMove) / velocity;

        let regimeAdjusted = false;

        // -------------------------
        // 5. Regime Adjustments
        // -------------------------
        if (regime) {

            // Short Gamma → fast moves
            if (regime === "ShortGamma") {
                timeToMove *= 0.6;
                regimeAdjusted = true;
            }

            // Long Gamma → slower, mean-reverting
            if (regime === "LongGamma") {
                timeToMove *= 1.5;
                regimeAdjusted = true;
            }
        }

        // Trap condition
        if (trap) {
            timeToMove *= 2.0;
            regimeAdjusted = true;
        }

        // -------------------------
        // 6. Clamp
        // -------------------------
        if (timeToMove > this.maxHorizon) {
            timeToMove = this.maxHorizon;
        }

        // -------------------------
        // 7. Classification (useful for policy)
        // -------------------------
        let speedClass = "normal";

        if (timeToMove < 20) speedClass = "fast";
        else if (timeToMove > 200) speedClass = "slow";

        return {
            timeToMove,
            velocity,
            speedClass,
            regimeAdjusted
        };
    }
}