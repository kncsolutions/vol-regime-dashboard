export class GammaEncoder {

    encode(state) {

        return [
            this.encodeG1(state.G1),
            this.encodeG2(state.G2),
            this.encodeG3(state.G3),
            this.encodeG4(state.G4),
            ...this.encodeG5(state.G5)
        ];
    }

    encodeG1(val) {
        return val === "Long" ? 1 :
               val === "Short" ? -1 : 0;
    }

    encodeG2(val) {
        return val === "Strong" ? 1 : 0;
    }

    encodeG3(val) {
        return val === "Expanding" ? 1 :
               val === "Compressing" ? -1 : 0;
    }

    encodeG4(val) {
        return val === "PositiveFeedback" ? 1 : -1;
    }

    encodeG5(arr = []) {

        const structure = {
            Mixed: 0,
            Pinning: 0,
            Trap: 0,
            Drift: 0
        };

        arr.forEach(k => {
            if (structure.hasOwnProperty(k)) {
                structure[k] = 1;
            }
        });

        return [
            structure.Mixed,
            structure.Pinning,
            structure.Trap,
            structure.Drift
        ];
    }
}