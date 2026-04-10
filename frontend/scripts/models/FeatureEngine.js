// FeatureEngine.js

export class FeatureEngine {
    constructor() {
        this.prices = [];
        this.returns = [];

        this.alphaFast = 0.2;
        this.alphaSlow = 0.05;

        this.sigmaShort = 0;
        this.sigmaLong = 0;

        this.lastPrice = null;
    }

    update(tick) {
        const price = tick.ltp;
        if (!price) return null;

        if (this.lastPrice) {
            const ret = price - this.lastPrice;

            const varFast =
                this.alphaFast * ret * ret +
                (1 - this.alphaFast) * (this.sigmaShort ** 2);

            const varSlow =
                this.alphaSlow * ret * ret +
                (1 - this.alphaSlow) * (this.sigmaLong ** 2);

            this.sigmaShort = Math.sqrt(varFast);
            this.sigmaLong = Math.sqrt(varSlow);
        }

        this.lastPrice = price;

        this.prices.push(price);
        if (this.prices.length > 50) this.prices.shift();

        const vwap =
            this.prices.reduce((a, b) => a + b, 0) /
            this.prices.length;

        const prev =
            this.prices.length > 5
                ? this.prices[this.prices.length - 5]
                : price;

        return {
            price,
            vwap,
            sigmaEWMA: this.sigmaShort || 1,
            sigmaShort: this.sigmaShort || 1,
            sigmaLong: this.sigmaLong || 1,
            prevPrice: prev,
            absorptionSignal: 0
        };
    }
}