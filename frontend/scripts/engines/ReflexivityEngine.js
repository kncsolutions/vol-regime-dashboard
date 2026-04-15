export class ReflexivityEngine {
    constructor(config = {}) {

        this.window = config.window || 50;

        this.state = {
            regime: "INIT",

            I_series: [],
            P_series: [],

            beta_series: [],
            phi_series: [],

            lastUpdateTs: null
        };
    }

    //-----------------------------------
    // MAIN UPDATE (CALL THIS ONLY)
    //-----------------------------------
    update({ netGEX, spot, flow, timestamp }) {

        if (!spot || !netGEX) return null;

        const I = Math.abs(netGEX);
        const P = spot;

        // 🔒 Dedup
        const lastI = this.state.I_series.at(-1);
        const lastP = this.state.P_series.at(-1);

        if (lastI === I && lastP === P) return null;

        this._pushSeries(I, P);

        const beta = this._computeBeta();
        const phi  = this._computePhi(flow, netGEX);

        if (beta !== null) this.state.beta_series.push(beta);
        if (phi !== null)  this.state.phi_series.push(phi);

        const regime = this._computeRegime(beta, phi);

        this.state.regime = regime;
        this.state.lastUpdateTs = timestamp;

        return {
            beta,
            phi,
            regime,
            I,
            P
        };
    }

    //-----------------------------------
    // SERIES MGMT
    //-----------------------------------
    _pushSeries(I, P) {

        const s = this.state;

        s.I_series.push(I);
        s.P_series.push(P);

        if (s.I_series.length > this.window) {
            s.I_series.shift();
            s.P_series.shift();
        }
    }

    //-----------------------------------
    // BETA (Elasticity)
    //-----------------------------------
    _computeBeta() {

        const { I_series, P_series } = this.state;

        if (I_series.length < this.window) return null;

        const EPS = 1e-8;

        let logI = [];
        let logdP = [];

        for (let i = 0; i < I_series.length - 1; i++) {

            const I = Math.abs(I_series[i]);
            const dP = Math.abs(
                (P_series[i+1] - P_series[i]) / P_series[i]
            );

            if (I > 0 && dP > 1e-5) {
                logI.push(Math.log(I));
                logdP.push(Math.log(dP + EPS));
            }
        }

        if (logI.length < 10) return null;

        const meanX = avg(logI);
        const meanY = avg(logdP);

        let num = 0, den = 0;

        for (let i = 0; i < logI.length; i++) {
            const dx = logI[i] - meanX;
            const dy = logdP[i] - meanY;

            num += dx * dy;
            den += dx * dx;
        }

        if (den < 1e-6) return null;

        return clamp(num / den, -2, 2);
    }

    //-----------------------------------
    // PHI (Flow retention)
    //-----------------------------------
    _computePhi(flow, netGEX) {

        if (!flow) return 0;

        const imbalance = Math.abs(flow.imbalance || 0);
        const velocity  = Math.abs(flow.velocity || 0);

        const gammaEffect = Math.abs(netGEX);

        if (gammaEffect === 0) return 0;

        const phi = (imbalance * velocity) / gammaEffect;

        return clamp(phi, 0, 1);
    }

    //-----------------------------------
    // REGIME CLASSIFIER
    //-----------------------------------
    _computeRegime(beta, phi) {

        if (beta == null || phi == null) {
            return this.state.regime; // persist
        }

        if (beta > 1.5 && phi > 0.7) return "CRASH";

        if (beta > 1.2 && phi > 0.5) return "UNSTABLE";

        if (beta > 1.0 && phi > 0.3) return "REFLEXIVE";

        return "STABLE";
    }
}

//-----------------------------------
// UTILS
//-----------------------------------
function avg(arr) {
    return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}