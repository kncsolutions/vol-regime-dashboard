export class I2Engine {
    constructor(alpha = 0.1) {
        this.prevI1 = null
        this.I1_ema = null
        this.prevI1_ema = null
        this.alpha = alpha
    }

    update(I1) {
        if (I1 == null) return null

        // EMA smoothing
        if (this.I1_ema == null) {
            this.I1_ema = I1
        } else {
            this.I1_ema = this.alpha * I1 + (1 - this.alpha) * this.I1_ema
        }

        // Compute I2 (difference of smoothed I1)
        let I2 = null
        if (this.prevI1_ema != null) {
            I2 = this.I1_ema - this.prevI1_ema
        }

        this.prevI1_ema = this.I1_ema
        this.prevI1 = I1

        return I2
    }
}