// GammaEngine.js

export class GammaEngine {

    constructor() {
        this.lastFlip = null;
    }

    // =========================
    // G1: Gamma Sign
    // =========================
    computeG1(netGEX, threshold = 1e6) {
        if (Math.abs(netGEX) < threshold) return "Neutral";
        return netGEX > 0 ? "Long" : "Short";
    }

    // =========================
    // G2: Intensity
    // =========================
    computeG2(netGEX, gexStd) {
        const z = Math.abs(netGEX) / (gexStd || 1);
        return z > 2 ? "Strong" : "Weak";
    }

    // =========================
    // G3: Dynamics
    // =========================
    computeG3(gexHistory) {
        if (!gexHistory || gexHistory.length < 20) return "Stable";

        const recent = gexHistory.slice(-10);
        const prev = gexHistory.slice(-20, -10);

        const meanRecent = this.mean(recent);
        const meanPrev = this.mean(prev);

        const diff = meanRecent - meanPrev;

        if (diff > 0) return "Expanding";
        if (diff < 0) return "Compressing";

        return "Stable";
    }

    // =========================
    // G4: Feedback
    // =========================
    computeG4(params = {}) {

            const {
                priceNow,
                pricePrev,
                imbalance,
                velocity,
                netGEX
            } = params;

            // 🔥 HARD GUARD
            if (
                priceNow == null ||
                pricePrev == null ||
                imbalance == null ||
                velocity == null ||
                netGEX == null
            ) {
                return "NegativeFeedback"; // safe fallback
            }

            let score = 0;

            const dP = priceNow - pricePrev;

            if (Math.sign(dP) === Math.sign(imbalance)) score += 1;
            else score -= 1;

            if (netGEX < 0) score += 1;
            else score -= 1;

            if (velocity > 0) score += 1;
            else score -= 1;

            return score > 0
                ? "PositiveFeedback"
                : "NegativeFeedback";
}
    // =========================
    // G5: Structure (Power Set)
    // =========================
    computeG5({ gammaLadder, gexGradient, spot, flip }) {

        const flags = [];

        if (this.detectMixed(gammaLadder)) flags.push("Mixed");
        if (this.detectPinning(gammaLadder, spot)) flags.push("Pinning");
        if (this.detectTrap(gexGradient)) flags.push("Trap");
        if (this.detectDrift(flip)) flags.push("Drift");

        return flags;
    }

    // =========================
    // MAIN ENTRY
    // =========================
    computeState({ result, marketState, spot, flip, beta }) {

        const G1 = this.computeG1(result.netGEX);
        const G2 = this.computeG2(result.netGEX, marketState.gexStd);
        const G3 = this.computeG3(marketState.gexHistory);
        const G4 = this.computeG4(beta);
        const G5 = this.computeG5({
            gammaLadder: result.gammaLadder,
            gexGradient: result.gexGradient,
            spot,
            flip
        });

        return { G1, G2, G3, G4, G5 };
    }

    // =========================
    // HELPERS
    // =========================

    mean(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    findClosestStrike(gammaLadder, spot) {
        return gammaLadder.reduce((prev, curr) =>
            Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot)
                ? curr
                : prev
        );
    }

    computeConvexity(gexGradient) {
        return gexGradient.reduce((sum, g) => sum + Math.abs(g.gradient), 0);
    }

    // =========================
    // STRUCTURE DETECTORS
    // =========================

    detectMixed(gammaLadder) {
        let hasPositive = false;
        let hasNegative = false;

        for (let g of gammaLadder) {
            if (g.gex > 0) hasPositive = true;
            if (g.gex < 0) hasNegative = true;
        }

        return hasPositive && hasNegative;
    }

    detectPinning(gammaLadder, spot) {
        if (!spot) return false;

        const closest = this.findClosestStrike(gammaLadder, spot);

        return (
            Math.abs(closest.strike - spot) / spot < 0.005 &&
            Math.abs(closest.gex) > 0
        );
    }

    detectTrap(gexGradient) {
        if (!gexGradient || gexGradient.length === 0) return false;

        const convexity = this.computeConvexity(gexGradient);

        return convexity > 1e6; // 🔧 tune this threshold
    }

    detectDrift(flip) {
        if (!flip) return false;

        if (this.lastFlip == null) {
            this.lastFlip = flip;
            return false;
        }

        const drift = Math.abs(flip - this.lastFlip);

        this.lastFlip = flip;

        return drift > 0;
    }
}