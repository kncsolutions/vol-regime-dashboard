export class RegimeEngine {
    constructor({
        fragilityThreshold = 0.02,
        trendThreshold = 0.01,
        stabilityThreshold = 0.6,
        smoothAlpha = 0.2,
        inertia = 0.8
    } = {}) {

        this.fragilityThreshold = fragilityThreshold;
        this.trendThreshold = trendThreshold;
        this.stabilityThreshold = stabilityThreshold;

        this.prevRegime = "NEUTRAL";

        /**
         * 🔥 Smooth SCORES (not probabilities)
         */
        this.prevScores = {
            toxic: 0,
            trend: 0,
            mean: 0
        };

        this.smoothedFragility = 0;
        this.alpha = smoothAlpha;
        this.inertia = inertia;
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    update({ k, I1, liquidity, ofi = 0 }) {

        /**
         * --------------------------------------------------
         * 1. INPUT VALIDATION
         * --------------------------------------------------
         */
        if (
            !isFinite(k) ||
            !isFinite(I1) ||
            !isFinite(liquidity)
        ) return null;

        /**
         * --------------------------------------------------
         * 2. CORE METRICS
         * --------------------------------------------------
         */

        /**
         * Fragility:
         * F = (1 - L) * |k|
         */
        const fragility = (1 - liquidity) * Math.abs(k);

        /**
         * Trend Strength:
         * T = |k| * (0.5 + 0.5(1 - |I1|))
         */
        const trendStrength =
            Math.abs(k) * (0.5 + 0.5 * (1 - Math.abs(I1)));

        /**
         * Stability:
         * S = L * (1 - |k|)
         */
        const stability =
            liquidity * (1 - Math.abs(k));

        /**
         * --------------------------------------------------
         * 3. SMOOTH FRAGILITY (EMA)
         * --------------------------------------------------
         */
        this.smoothedFragility =
            this.alpha * fragility +
            (1 - this.alpha) * this.smoothedFragility;

        /**
         * --------------------------------------------------
         * 4. RAW SCORES
         * --------------------------------------------------
         */

        const toxicRaw =
            this.sigmoid(5 * (this.smoothedFragility - this.fragilityThreshold)) *
            this.sigmoid(5 * (Math.abs(I1) - 0.5));

        const trendRaw =
            this.sigmoid(5 * (trendStrength - this.trendThreshold)) *
            this.sigmoid(5 * (liquidity - 0.3));

        const meanRaw =
            this.sigmoid(5 * (stability - this.stabilityThreshold));

        /**
         * --------------------------------------------------
         * 5. SCORE SMOOTHING (KEY FIX)
         * --------------------------------------------------
         *
         * S_t = λ S_{t-1} + (1 - λ) S_raw
         */
        const toxicScore =
            this.inertia * this.prevScores.toxic +
            (1 - this.inertia) * toxicRaw;

        const trendScore =
            this.inertia * this.prevScores.trend +
            (1 - this.inertia) * trendRaw;

        const meanScore =
            this.inertia * this.prevScores.mean +
            (1 - this.inertia) * meanRaw;

        this.prevScores = {
            toxic: toxicScore,
            trend: trendScore,
            mean: meanScore
        };

        /**
         * --------------------------------------------------
         * 6. NORMALIZATION (ONLY ONCE)
         * --------------------------------------------------
         *
         * P(r) = S(r) / Σ S
         */
        const sum = toxicScore + trendScore + meanScore + 1e-12;

        const probs = {
            TOXIC: toxicScore / sum,
            TREND: trendScore / sum,
            MEAN_REVERT: meanScore / sum
        };

        /**
         * --------------------------------------------------
         * 7. DIRECTION
         * --------------------------------------------------
         *
         * D = tanh(3 × OFI)
         */
        const direction = Math.tanh(3 * ofi);

        /**
         * --------------------------------------------------
         * 8. CONFIDENCE
         * --------------------------------------------------
         *
         * C = max(P)
         */
        const confidence = Math.max(
            probs.TOXIC,
            probs.TREND,
            probs.MEAN_REVERT
        );

        /**
         * --------------------------------------------------
         * 9. HARD LABEL (UI)
         * --------------------------------------------------
         */
        let regime = "NEUTRAL";

        if (probs.TOXIC > 0.5) {
            regime = "TOXIC";
        } else if (probs.TREND > 0.5) {
            regime = direction >= 0 ? "TREND_UP" : "TREND_DOWN";
        } else if (probs.MEAN_REVERT > 0.5) {
            regime = "MEAN_REVERT";
        }

        if (regime === "NEUTRAL") {
            regime = this.prevRegime;
        }

        this.prevRegime = regime;

        /**
         * --------------------------------------------------
         * 10. OUTPUT
         * --------------------------------------------------
         */
        return {
            regime,
            probs,
            direction,
            confidence,
            fragility,
            trendStrength,
            stability
        };
    }

    reset() {
        this.prevRegime = "NEUTRAL";

        this.prevScores = {
            toxic: 0,
            trend: 0,
            mean: 0
        };

        this.smoothedFragility = 0;
    }
}