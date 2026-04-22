// ======================================
// 📈 ExpectedMoveEngine
// ======================================

export class ExpectedMoveEngine {

    constructor({ lookback = 50 } = {}) {
        this.lookback = lookback;
    }

    // -------------------------
    // Utility: Sigmoid
    // -------------------------
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    // -------------------------
    // Short-term volatility from price buffer
    // -------------------------
    computeShortTermVol(prices) {
        if (!prices || prices.length < 2) return 0;

        let returns = [];

        for (let i = 1; i < prices.length; i++) {
            const r = Math.log(prices[i] / prices[i - 1]);
            if (isFinite(r)) returns.push(r);
        }

        if (returns.length < 2) return 0;

        const mean =
            returns.reduce((a, b) => a + b, 0) / returns.length;

        const variance =
            returns.reduce((sum, r) =>
                sum + Math.pow(r - mean, 2), 0
            ) / returns.length;

        return Math.sqrt(variance);
    }

    // -------------------------
    // Extract prices from buffer (circular-safe)
    // -------------------------
    getPricesFromBuffer(buffer, n) {

        if (!buffer) return [];

        const size = buffer.size;
        const i = buffer.index;
        const filled = buffer.filled;

        const available = filled ? size : i;
        const count = Math.min(n, available);

        const result = [];

        for (let j = 0; j < count; j++) {
            const idx = (i - 1 - j + size) % size;
            const price = buffer.ltp[idx];

            if (price === undefined) break;
            result.push(price);
        }

        return result.reverse();
    }

    // -------------------------
    // Core Compute
    // -------------------------
    compute({
        dS,
        I1,
        hv,              // long-term vol (from vol engine)
        marketBuffer,    // full buffer
        price            // current spot
    }) {

        if (!isFinite(dS) || !isFinite(I1) || !price) {
            return null;
        }

        // -------------------------
        // 1. Short-term vol
        // -------------------------
        const prices = this.getPricesFromBuffer(
            marketBuffer,
            this.lookback
        );

        const sigma_short = this.computeShortTermVol(prices);

        // -------------------------
        // 2. Long-term vol
        // -------------------------
        const sigma_long = hv || 0.01;

        const vol_ratio = sigma_long > 0
            ? sigma_short / sigma_long
            : 1;

        // -------------------------
        // 3. Lambda (instability amplifier)
        // -------------------------
        const lambda =
            0.8 + 1.5 * this.sigmoid(I1 * 10);

        // -------------------------
        // 4. Beta (vol weight)
        // -------------------------
        const beta =
            0.7 + 0.6 * vol_ratio;

        // -------------------------
        // 5. Convert vol → price units
        // -------------------------
        const sigma_short_price =
            sigma_short * price;

        // -------------------------
        // 6. Expected Move
        // -------------------------
        const expectedMove =
            dS * (1 + lambda * I1) +
            beta * sigma_short_price;

        // Optional directional decomposition
        const moveUp = Math.max(0, expectedMove);
        const moveDown = Math.min(0, expectedMove);

        return {
            expectedMove,
            moveUp,
            moveDown,
            lambda,
            beta,
            sigma_short,
            sigma_long
        };
    }
}