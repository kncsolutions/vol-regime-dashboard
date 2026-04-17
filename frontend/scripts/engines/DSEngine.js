// ============================================================
// dS Engine (Microstructure Response Model)
// ============================================================
//
// PURPOSE:
// Transform microprice into a structured signal capturing:
//
//   1. Smoothed state (EMA)
//   2. First derivative (velocity)
//   3. Second derivative (acceleration)
//   4. Volatility-normalized move
//   5. Reflexivity-adjusted signal
//
// This models:
//
//   flow → price response → amplified by instability (I1) & impact (k)
//
// ============================================================

export class DSEngine {
    constructor() {

        /**
         * ============================================================
         * STATE VARIABLES
         * ============================================================
         *
         * S_ema:
         *   Smoothed microprice
         *
         * prev_S_ema:
         *   Previous smoothed value
         *
         * velocity:
         *   First derivative of S (dS/dt)
         *
         * acceleration:
         *   Second derivative (d²S/dt²)
         *
         * vol:
         *   Exponential volatility estimator
         */
        this.S_ema = null
        this.prev_S_ema = null

        this.velocity = 0
        this.acceleration = 0

        this.vol = 1
    }

    /**
     * ============================================================
     * UPDATE FUNCTION
     * ============================================================
     *
     * INPUT:
     *   microprice = weighted mid-price
     *   I1 = instability (feedback amplification)
     *   k = market impact coefficient
     *   liquidity = depth / resilience proxy
     *
     * OUTPUT:
     *   dS_raw, dS_norm, dS_adj
     *
     * ============================================================
     */
    update({ microprice, I1, k, liquidity }) {

        if (!microprice) return null

        // ============================================================
        // 1. ADAPTIVE EMA SMOOTHING
        // ============================================================
        /**
         * EMA:
         *
         *   S_t = α · x_t + (1 - α) · S_{t-1}
         *
         * where:
         *   x_t = microprice
         *   α = adaptive smoothing factor
         *
         * Interpretation:
         *   - higher α → faster reaction
         *   - lower α → more smoothing
         */
        const alpha = this.getAdaptiveAlpha(I1, liquidity)

        this.S_ema =
            this.S_ema == null
                ? microprice
                : alpha * microprice + (1 - alpha) * this.S_ema

        // ============================================================
        // 2. FIRST DERIVATIVE (VELOCITY)
        // ============================================================
        /**
         * dS (velocity):
         *
         *   dS_t = S_t - S_{t-1}
         *
         * Interpretation:
         *   instantaneous price change
         */
        let dS = 0
        if (this.prev_S_ema != null) {
            dS = this.S_ema - this.prev_S_ema
        }

        // ============================================================
        // 3. SECOND DERIVATIVE (ACCELERATION)
        // ============================================================
        /**
         * acceleration:
         *
         *   a_t = dS_t - dS_{t-1}
         *
         * Interpretation:
         *   change in momentum
         *   → detects convexity / regime shifts
         */
        const prevVel = this.velocity
        this.velocity = dS
        this.acceleration = this.velocity - prevVel

        // ============================================================
        // 4. VOLATILITY NORMALIZATION
        // ============================================================
        /**
         * Exponential volatility estimator:
         *
         *   vol_t = λ · vol_{t-1} + (1 - λ) · |dS_t|
         *
         * where:
         *   λ = 0.9
         *
         * Normalized signal:
         *
         *   dS_norm = dS / vol
         *
         * Interpretation:
         *   removes scale → comparable across regimes
         */
        this.vol = 0.9 * this.vol + 0.1 * Math.abs(dS)

        const dS_norm = this.vol > 0 ? dS / this.vol : 0

        // ============================================================
        // 5. REFLEXIVITY ADJUSTMENT
        // ============================================================
        /**
         * Reflexive amplification:
         *
         *   dS_adj = dS_norm · (1 + k) · (1 + I1)
         *
         * where:
         *   k  = impact coefficient
         *   I1 = instability (feedback loop strength)
         *
         * Interpretation:
         *   - high k → price reacts more to flow
         *   - high I1 → feedback loop amplification
         *
         * Combined effect:
         *   captures endogenous market dynamics
         */
        const dS_adj = dS_norm * (1 + k) * (1 + I1)

        // ============================================================
        // UPDATE STATE
        // ============================================================
        this.prev_S_ema = this.S_ema

        return {
            dS_raw: dS,
            dS_norm,
            dS_adj,
            velocity: this.velocity,
            acceleration: this.acceleration
        }
    }

    /**
     * ============================================================
     * ADAPTIVE SMOOTHING FUNCTION
     * ============================================================
     *
     * α = f(I1, liquidity)
     *
     * Rules:
     *
     * 1. Base:
     *   α = 0.2
     *
     * 2. High instability:
     *   if I1 > 0.5 → α ↑ (faster reaction)
     *
     * 3. Low liquidity:
     *   liquidity ↓ → α ↓ (more smoothing)
     *
     * Final constraint:
     *
     *   α ∈ [0.05, 0.5]
     *
     * ============================================================
     */
    getAdaptiveAlpha(I1, liquidity) {

        let alpha = 0.2

        if (I1 > 0.5) alpha = 0.4
        if (liquidity < 0.3) alpha *= 0.5

        return Math.min(0.5, Math.max(0.05, alpha))
    }
}