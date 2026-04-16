export class ImpactEngine {
    constructor({ windowSize = 50, alpha = 0.2 } = {}) {
        this.prev = null;

        // Buffers for regression:
        // x → OFI (order flow imbalance)
        // y → ΔP (mid price change)
        this.ofiBuffer = [];
        this.dpBuffer = [];

        this.windowSize = windowSize;

        // EMA smoothing parameter for k
        this.alpha = alpha;

        // Final impact coefficient
        this.k = 0;
    }

    update(packet) {
        const level1 = packet.depth?.[0];
        if (!level1) return null;

        const bid = level1.bid_price;
        const ask = level1.ask_price;
        const bidQty = level1.bid_qty || 0;
        const askQty = level1.ask_qty || 0;

        if (!bid || !ask) return null;

        // --------------------------------------------------
        // 1. MID PRICE
        // --------------------------------------------------
        // Mid price approximation:
        //     P_t = (bid_t + ask_t) / 2
        const mid = (bid + ask) / 2;

        let ofi = 0;

        if (this.prev) {
            const p = this.prev;

            // --------------------------------------------------
            // 2. ORDER FLOW IMBALANCE (OFI)
            // --------------------------------------------------
            // OFI measures signed liquidity pressure:
            //
            // For bid:
            //   if bid unchanged → Δq_bid
            //   if bid increases → +q_bid
            //   if bid decreases → -q_prev_bid
            //
            // For ask:
            //   if ask unchanged → -Δq_ask
            //   if ask decreases → -q_ask  (aggressive buying)
            //   if ask increases → +q_prev_ask (liquidity added)
            //
            // Final:
            //     OFI_t = ΔBidContribution − ΔAskContribution

            // ----- BID SIDE -----
            if (bid === p.bid) {
                ofi += (bidQty - p.bidQty);
            } else if (bid > p.bid) {
                ofi += bidQty;
            } else {
                ofi -= p.bidQty;
            }

            // ----- ASK SIDE -----
            if (ask === p.ask) {
                ofi -= (askQty - p.askQty);
            } else if (ask < p.ask) {
                ofi -= askQty;
            } else {
                ofi += p.askQty;
            }
        }

        // --------------------------------------------------
        // 3. NORMALIZATION
        // --------------------------------------------------
        // Normalize OFI by available liquidity:
        //
        //     OFI_norm = OFI / (q_bid + q_ask)
        //
        // This removes scale dependency across regimes
        const norm = bidQty + askQty + 1;
        ofi = ofi / norm;

        // --------------------------------------------------
        // 4. PRICE CHANGE
        // --------------------------------------------------
        // ΔP = P_t − P_{t-1}
        const dP = this.prev ? (mid - this.prev.mid) : 0;

        // --------------------------------------------------
        // 5. STORE FOR REGRESSION
        // --------------------------------------------------
        // We estimate impact coefficient k using:
        //
        //     k = (Σ OFI * ΔP) / (Σ OFI²)
        //
        // This is equivalent to OLS regression:
        //     ΔP = k * OFI + ε
        this.ofiBuffer.push(ofi);
        this.dpBuffer.push(dP);

        // Maintain rolling window
        if (this.ofiBuffer.length > this.windowSize) {
            this.ofiBuffer.shift();
            this.dpBuffer.shift();
        }

        let kRaw = 0;

        // --------------------------------------------------
        // 6. COMPUTE IMPACT COEFFICIENT (k)
        // --------------------------------------------------
        if (this.ofiBuffer.length > 10) {
            let sumXY = 0; // Σ (OFI * ΔP)
            let sumXX = 0; // Σ (OFI²)

            for (let i = 0; i < this.ofiBuffer.length; i++) {
                const x = this.ofiBuffer[i];
                const y = this.dpBuffer[i];

                sumXY += x * y;
                sumXX += x * x;
            }

            // Avoid division by zero
            if (sumXX > 1e-8) {
                kRaw = sumXY / sumXX;
            }
        }

        // --------------------------------------------------
        // 7. SMOOTHING (EMA)
        // --------------------------------------------------
        // Apply exponential smoothing:
        //
        //     k_t = α * k_raw + (1 - α) * k_{t-1}
        //
        // This stabilizes noisy microstructure estimates
        this.k = this.alpha * kRaw + (1 - this.alpha) * this.k;

        // --------------------------------------------------
        // 8. STORE STATE
        // --------------------------------------------------
        this.prev = { bid, ask, bidQty, askQty, mid };

        return {
            mid,   // mid price
            ofi,   // normalized order flow imbalance
            k: this.k  // impact coefficient
        };
    }

    reset() {
        this.prev = null;
        this.ofiBuffer = [];
        this.dpBuffer = [];
        this.k = 0;
    }
}