export class LiquidityEngine {

    /**
     * ============================================================
     * Liquidity Engine
     * ============================================================
     *
     * Objective:
     * ---------
     * Compute a normalized liquidity score ∈ [0, 1] representing
     * how easily the market can absorb order flow without moving price.
     *
     * Liquidity is modeled as a combination of:
     *   - Depth       → available volume at best bid/ask
     *   - Spread      → transaction cost / tightness
     *   - Impact (k)  → price sensitivity to flow
     *   - Stability   → market instability (I1)
     *
     * ------------------------------------------------------------
     * Final Liquidity Score:
     *
     *   L = w1·DepthScore
     *     + w2·SpreadScore
     *     + w3·(1 - |k|_norm)
     *     + w4·(1 - |I1|_norm)
     *
     * where:
     *   w1 = 0.3, w2 = 0.2, w3 = 0.3, w4 = 0.2
     *
     * Output:
     *   L ∈ [0,1]
     *
     * Interpretation:
     *   L → 1  → deep, stable, low impact (high liquidity)
     *   L → 0  → fragile, thin, high impact (low liquidity)
     */

    constructor() {

        /**
         * Rolling maxima used for adaptive normalization:
         *
         * Instead of fixed thresholds, we track recent maxima:
         *
         *   X_max(t) = max(0.99 * X_max(t-1), X_t)
         *
         * This provides:
         *   - decay (forget old extremes)
         *   - adaptability to regime changes
         */

        this.depthMax = 1;   // max observed depth
        this.spreadMax = 1;  // max observed spread
        this.kMax = 1e-4;    // max |impact|
        this.i1Max = 1;      // max |instability|
    }

    update({ bid, ask, bidQty, askQty, k, I1 }) {

        /**
         * --------------------------------------------------------
         * 1. BASIC MARKET VARIABLES
         * --------------------------------------------------------
         */

        // Mid price:
        //   P = (bid + ask) / 2
        const mid = (bid + ask) / 2;

        // Depth:
        //   D = bidQty + askQty
        const depth = bidQty + askQty;

        // Spread:
        //   S = ask - bid
        const spread = ask - bid;

        /**
         * --------------------------------------------------------
         * 2. ADAPTIVE NORMALIZATION
         * --------------------------------------------------------
         *
         * Maintain exponentially decaying maxima:
         *
         *   X_max ← max(0.99 * X_max, X_current)
         *
         * This ensures:
         *   - stability across regimes
         *   - no hard-coded thresholds
         */

        this.depthMax = Math.max(this.depthMax * 0.99, depth);
        this.spreadMax = Math.max(this.spreadMax * 0.99, spread);
        this.kMax = Math.max(this.kMax * 0.99, Math.abs(k));
        this.i1Max = Math.max(this.i1Max * 0.99, Math.abs(I1));

        /**
         * --------------------------------------------------------
         * 3. COMPONENT SCORES
         * --------------------------------------------------------
         */

        /**
         * (a) Depth Score
         * ----------------------------------------
         *   DepthScore = D / D_max
         *
         * Higher depth → more liquidity
         */
        const depthScore = depth / (this.depthMax + 1e-6);

        /**
         * (b) Spread Score
         * ----------------------------------------
         * Normalize spread relative to price:
         *
         *   SpreadScore = 1 - (S / (P * S_max))
         *
         * Smaller spread → higher score
         */
        const spreadScore =
            1 - (spread / (mid * this.spreadMax + 1e-6));

        /**
         * (c) Impact Score
         * ----------------------------------------
         * k = price response to OFI
         *
         *   ImpactScore = 1 - |k| / k_max
         *
         * Higher k → more price sensitivity → lower liquidity
         */
        const impactScore =
            1 - (Math.abs(k) / (this.kMax + 1e-6));

        /**
         * (d) Stability Score
         * ----------------------------------------
         * I1 = instability metric
         *
         *   StabilityScore = 1 - |I1| / I1_max
         *
         * Higher instability → lower liquidity
         */
        const stabilityScore =
            1 - (Math.abs(I1) / (this.i1Max + 1e-6));

        /**
         * --------------------------------------------------------
         * 4. FINAL LIQUIDITY SCORE
         * --------------------------------------------------------
         *
         * Weighted combination:
         *
         *   L = 0.3·DepthScore
         *     + 0.2·SpreadScore
         *     + 0.3·ImpactScore
         *     + 0.2·StabilityScore
         *
         * Then clamp:
         *   L ∈ [0, 1]
         */

        let liquidity =
            0.3 * depthScore +
            0.2 * spreadScore +
            0.3 * impactScore +
            0.2 * stabilityScore;

        liquidity = Math.max(0, Math.min(1, liquidity));

        /**
         * --------------------------------------------------------
         * 5. OUTPUT
         * --------------------------------------------------------
         */
        return {
            liquidity,        // overall liquidity score
            depthScore,       // depth contribution
            spreadScore,      // spread contribution
            impactScore,      // impact contribution
            stabilityScore    // stability contribution
        };
    }
}