export class I3Engine {
    constructor(alpha = 0.1) {
        this.I1_ema = null
        this.prevI1_ema = null
        this.prev2I1_ema = null
        this.alpha = alpha
    }

    update(I1) {
        if (I1 == null) return null

        // Smooth I1
        if (this.I1_ema == null) {
            this.I1_ema = I1
        } else {
            this.I1_ema = this.alpha * I1 + (1 - this.alpha) * this.I1_ema
        }

        let I3 = null

        if (this.prevI1_ema != null && this.prev2I1_ema != null) {
            I3 =
                this.I1_ema
                - 2 * this.prevI1_ema
                + this.prev2I1_ema
        }

        // shift memory
        this.prev2I1_ema = this.prevI1_ema
        this.prevI1_ema = this.I1_ema

        return I3
    }
}