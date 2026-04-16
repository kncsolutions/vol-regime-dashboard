export class PositionSizingEngine {
    constructor({
        alpha = 0.1,        // EMA smoothing
        gamma = 50,         // normalization strength
        maxPosition = 1.0,  // max exposure (e.g. 1 = full size)
        riskPerTrade = 0.02 // 2% capital risk
    } = {}) {
        this.alpha = alpha;
        this.gamma = gamma;
        this.maxPosition = maxPosition;
        this.riskPerTrade = riskPerTrade;

        this.ema = 0;
    }

    update({ k, I1, liquidity, capital = 1_000_000, price = 1 }) {

        if (
            k == null || isNaN(k) ||
            I1 == null || isNaN(I1) ||
            liquidity == null || isNaN(liquidity)
        ) {
            return null;
        }

        /**
         * ----------------------------------------
         * 1. RAW SIGNAL
         * ----------------------------------------
         * size_raw = k * I1 * (1 - liquidity)
         */
        const raw = k * I1 * (1 - liquidity);

        /**
         * ----------------------------------------
         * 2. SMOOTHING (EMA)
         */
        this.ema = this.alpha * raw + (1 - this.alpha) * this.ema;

        /**
         * ----------------------------------------
         * 3. NORMALIZATION
         * ----------------------------------------
         * squash into [-1, 1]
         */
        const normalized = Math.tanh(this.ema * this.gamma);

        /**
         * ----------------------------------------
         * 4. RISK BUDGET
         * ----------------------------------------
         * capital * riskPerTrade = max capital to risk
         */
        const riskBudget = capital * this.riskPerTrade;

        /**
         * ----------------------------------------
         * 5. POSITION SIZE (in units)
         * ----------------------------------------
         */
        const positionValue = normalized * riskBudget;

        const units = positionValue / price;

        /**
         * ----------------------------------------
         * 6. HARD CAP (safety)
         */
        const cappedUnits = Math.max(
            -this.maxPosition * riskBudget / price,
            Math.min(units, this.maxPosition * riskBudget / price)
        );

        return {
            raw,
            ema: this.ema,
            normalized,
            positionValue,
            units: cappedUnits
        };
    }

    reset() {
        this.ema = 0;
    }
}