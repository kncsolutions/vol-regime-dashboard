// RRPModel.js

export class RRPModel {
    constructor(params = {}) {
        this.alpha = params.alpha ?? 1.2;
        this.beta  = params.beta  ?? 0.8;
        this.gamma = params.gamma ?? 1.0;
        this.delta = params.delta ?? 0.7;
        this.eta   = params.eta   ?? 0.5;

        this.emaRRP = null;
        this.emaAlpha = 2 / 11;
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    clip(x, min = -3, max = 3) {
        return Math.max(min, Math.min(max, x));
    }

    compute(f) {
        let D = this.clip((f.price - f.vwap) / f.sigmaEWMA);
        let G = this.clip((f.netGEX / (f.adv * f.price)) / f.gexStd);
        let M = this.clip((f.price - f.prevPrice) / f.sigmaShort);
        let V = this.clip((f.sigmaShort / f.sigmaLong) - 1);
        let R = f.absorptionSignal || 0;

        let Z =
            this.alpha * Math.tanh(D) +
            this.beta  * Math.tanh(G) -
            this.gamma * Math.tanh(M) -
            this.delta * Math.tanh(V) +
            this.eta   * R;

        let rrp = this.sigmoid(Z);

        if (f.netGEX < 0) return null;

        if (this.emaRRP === null) this.emaRRP = rrp;
        else this.emaRRP =
            this.emaAlpha * rrp +
            (1 - this.emaAlpha) * this.emaRRP;

        return { final: this.emaRRP };
    }
}