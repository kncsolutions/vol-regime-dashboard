export class DecisionPolicy {
    constructor({
        baseSpread = 1,
        baseSize = 1,
        maxSpreadMult = 3,
        minSizeMult = 0.2
    } = {}) {

        /**
         * Base execution parameters
         *
         * baseSpread → reference spread (ticks / bps)
         * baseSize   → reference order size
         */
        this.baseSpread = baseSpread;
        this.baseSize = baseSize;

        /**
         * Risk constraints
         *
         * maxSpreadMult → cap on spread widening
         * minSizeMult   → minimum quoting size
         */
        this.maxSpreadMult = maxSpreadMult;
        this.minSizeMult = minSizeMult;
    }

    update({
        k,
        I1,
        liquidity,
        regimeProbs,
        direction,
        confidence = 1
    }) {

        /**
         * --------------------------------------------------
         * INPUT VALIDATION
         * --------------------------------------------------
         */
        if (
            !isFinite(k) ||
            !isFinite(I1) ||
            !isFinite(liquidity) ||
            !regimeProbs
        ) return null;

        const {
            TOXIC = 0,
            TREND = 0,
            MEAN_REVERT = 0
        } = regimeProbs;

        /**
         * --------------------------------------------------
         * 1. IMPACT RISK
         * --------------------------------------------------
         *
         * R = w₁|k| + w₂|I₁| + w₃ P(TOXIC)
         *
         * where:
         * - k     → market impact coefficient
         * - I₁    → instability / reflexivity
         * - TOXIC → adverse selection probability
         *
         * Interpretation:
         * - High k → price sensitive to trades
         * - High I₁ → unstable / reflexive market
         * - High TOXIC → informed flow risk
         *
         * Final:
         * R ∈ [0,1] (clipped)
         */
        const rawImpact =
            0.5 * Math.abs(k) +
            0.3 * Math.abs(I1) +
            0.2 * TOXIC;

        const impactRisk = Math.min(1, rawImpact);


        /**
         * --------------------------------------------------
         * 2. SPREAD MULTIPLIER
         * --------------------------------------------------
         *
         * s = 1
         *   + a₁ R
         *   + a₂ P(TOXIC)
         *   - a₃ P(MEAN_REVERT)
         *   - a₄ liquidity
         *
         * Interpretation:
         * - widen in high impact / toxic regimes
         * - tighten in mean-reverting / liquid markets
         */
        let spreadMultiplier =
            1 +
            2 * impactRisk +
            1.5 * TOXIC -
            0.5 * MEAN_REVERT -
            0.5 * liquidity;

        /**
         * Apply bounds:
         * 0.5 ≤ spreadMultiplier ≤ maxSpreadMult
         */
        spreadMultiplier = Math.min(
            this.maxSpreadMult,
            Math.max(0.5, spreadMultiplier)
        );

        /**
         * --------------------------------------------------
         * 3. SIZE MULTIPLIER
         * --------------------------------------------------
         *
         * q = 1
         *   - b₁ P(TOXIC)
         *   - b₂ R
         *   + b₃ P(MEAN_REVERT)
         *
         * Interpretation:
         * - reduce size in toxic / high-risk regimes
         * - increase size in stable mean-reversion
         */
        let sizeMultiplier =
            1 -
            0.7 * TOXIC -
            0.3 * impactRisk +
            0.4 * MEAN_REVERT;

        /**
         * Confidence penalty:
         *
         * If regime uncertainty is high (low confidence),
         * reduce exposure
         */
        if (confidence < 0.4) {
            sizeMultiplier *= 0.7;
        }

        /**
         * Apply lower bound
         */
        sizeMultiplier = Math.max(
            this.minSizeMult,
            sizeMultiplier
        );

        /**
         * --------------------------------------------------
         * 4. AGGRESSION (CROSS VS PASSIVE)
         * --------------------------------------------------
         *
         * A = P(TREND) × (1 - P(TOXIC)) × |direction| × f(liquidity)
         *
         * where:
         * f(L) = 0.5 + 0.5L
         *
         * Interpretation:
         * - aggressive when:
         *   → strong trend
         *   → low toxicity
         *   → strong directional signal
         *   → sufficient liquidity
         */
        const aggression =
            TREND *
            (1 - TOXIC) *
            Math.abs(direction) *
            (0.5 + 0.5 * liquidity);

        /**
         * Crossing condition:
         *
         * Cross only if:
         * - strong aggression
         * - acceptable impact risk
         */
        const shouldCross =
            aggression > 0.6 && impactRisk < 0.7;

        /**
         * --------------------------------------------------
         * 5. SKEW (DIRECTIONAL QUOTE SHIFT)
         * --------------------------------------------------
         *
         * skew = tanh(direction) ×
         *        (w₁ P(TREND) + w₂ P(MEAN_REVERT)) ×
         *        (1 - P(TOXIC))
         *
         * Interpretation:
         * - shifts quotes toward directional alpha
         * - suppressed in toxic environments
         * - stabilized via tanh()
         */
        const skew =
            Math.tanh(direction) *
            (TREND * 0.7 + MEAN_REVERT * 0.3) *
            (1 - TOXIC);

        /**
         * --------------------------------------------------
         * 6. QUOTING DECISION
         * --------------------------------------------------
         *
         * Quote only if:
         * - toxicity not extreme
         * - minimum liquidity available
         */
        const shouldQuote =
            TOXIC < 0.8 && liquidity > 0.1;

        /**
         * --------------------------------------------------
         * 7. FINAL OUTPUT (POLICY ACTION)
         * --------------------------------------------------
         *
         * These values define:
         *
         * spread = baseSpread × spreadMultiplier
         * size   = baseSize × sizeMultiplier
         *
         * and execution behavior:
         * - aggression → crossing intensity
         * - skew       → directional bias
         */
        return {
            spreadMultiplier,
            sizeMultiplier,
            aggression,
            skew,
            shouldQuote,
            shouldCross,
            impactRisk
        };
    }
}