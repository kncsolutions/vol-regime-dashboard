export function getGammaRegime(spot, flip) {
    return spot > flip ? "LONG" : "SHORT";
}