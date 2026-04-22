export class StrikeScoringEngine {

    constructor({
        minSpread = 0.5,
        maxSpread = 20,
        liquidityWeight = 0.8,
        probWeight = 1.2,
        distanceWeight = 0.6
    } = {}) {
        this.minSpread = minSpread;
        this.maxSpread = maxSpread;
        this.liquidityWeight = liquidityWeight;
        this.probWeight = probWeight;
        this.distanceWeight = distanceWeight;
    }

    // -------------------------
    // Liquidity (log-normalized)
    // -------------------------
    computeLiquidity(row, type = "ce") {

        const leg = row[type];
        if (!leg) return 0;

        const oi = leg.oi || 0;
        const vol = leg.volume || 0;

        return Math.log(1 + oi + vol);
    }

    // -------------------------
    // Spread (clamped)
    // -------------------------
    computeSpread(row, type = "ce") {

        const leg = row[type];
        if (!leg) return Infinity;

        const bid = leg.bid_price || 0;
        const ask = leg.ask_price || 0;

        let spread = ask - bid;

        if (!isFinite(spread) || spread <= 0) {
            spread = this.minSpread;
        }

        return Math.min(spread, this.maxSpread);
    }

    // -------------------------
    // Distance penalty (moneyness)
    // -------------------------
    computeDistanceFactor(strike, spot) {

        if (!spot) return 1;

        const distance = Math.abs(strike - spot);

        // normalize by spot
        const rel = distance / spot;

        // exponential decay
        return Math.exp(-5 * rel);
    }

    // -------------------------
    // Score single strike
    // -------------------------
    scoreStrike({
        row,
        reachProbability,
        spot,
        type = "ce"
    }) {

        if (!row || reachProbability == null) return null;

        const prob = Math.max(0.01, Math.min(0.99, reachProbability));

        const liquidity = this.computeLiquidity(row, type);
        const spread = this.computeSpread(row, type);

        if (!isFinite(spread) || spread <= 0 || spread > this.maxSpread) {
            return null;
        }

        const distanceFactor =
            this.computeDistanceFactor(row.strike, spot);

        // 🔥 Improved scoring
        const score =
            Math.pow(prob, this.probWeight) *
            Math.pow(liquidity, this.liquidityWeight) *
            Math.pow(distanceFactor, this.distanceWeight) /
            spread;

        return {
            strike: row.strike,
            score,
            liquidity,
            spread,
            reachProbability: prob,
            distanceFactor
        };
    }

    // -------------------------
    // Rank strikes
    // -------------------------
    rankStrikes({
        optionRows,
        reachProbMap,
        spot,
        type = "ce"
    }) {

        if (!optionRows || optionRows.length === 0) return [];

        const results = [];

        for (const row of optionRows) {

            const prob = reachProbMap[row.strike];

            if (prob == null) continue;

            const scored = this.scoreStrike({
                row,
                reachProbability: prob,
                spot,
                type
            });

            if (scored) results.push(scored);
        }

        results.sort((a, b) => b.score - a.score);

        return results;
    }
}