export function computeGammaLadder(rows) {
    return rows.map(r => {
        const ce_gex = r.ce_gamma * r.ce_oi;
        const pe_gex = -r.pe_gamma * r.pe_oi; // puts negative

        return {
            strike: r.strike,
            gex: ce_gex + pe_gex
        };
    });
}

export function computeNetGEX(gammaLadder) {
    return gammaLadder.reduce((sum, r) => sum + r.gex, 0);
}
export function computeGammaFlip(gammaLadder) {
    for (let i = 1; i < gammaLadder.length; i++) {
        const prev = gammaLadder[i - 1];
        const curr = gammaLadder[i];

        if (prev.gex < 0 && curr.gex > 0) {
            return curr.strike;
        }
    }
    return null;
}
export function computeVegaLadder(rows) {
    return rows.map(r => {
        const ce_v = r.ce_vega * r.ce_oi;
        const pe_v = r.pe_vega * r.pe_oi;

        return {
            strike: r.strike,
            vega: ce_v + pe_v
        };
    });
}
export function computeVegaSkew(rows) {
    return rows.map(r => {
        const net_oi = r.ce_oi - r.pe_oi
        const v_skew = ((r.ce_vega + r.pe_vega)/2 ) * net_oi

        return {
            strike: r.strike,
            vega: v_skew
        };
    });
}
export function computeGEXGradient(gammaLadder) {
    const gradient = [];

    for (let i = 1; i < gammaLadder.length; i++) {
        const prev = gammaLadder[i - 1];
        const curr = gammaLadder[i];

        const dGEX = curr.gex - prev.gex;
        const dS = curr.strike - prev.strike;

        gradient.push({
            strike: curr.strike,
            gradient: dGEX / dS
        });
    }

    return gradient;
}