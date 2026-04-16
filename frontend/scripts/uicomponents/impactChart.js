let impactChart = null;

/**
 * ============================================================
 * Impact Chart (Microstructure State Visualization)
 * ============================================================
 *
 * Purpose:
 * --------
 * Visualize real-time microstructure dynamics combining:
 *
 *   1. Impact (k)
 *   2. Instability (I1)
 *   3. Fragility
 *   4. Regime classification
 *
 * This chart represents:
 *
 *   Market Flow → Price Response → Stability → Regime
 *
 * ------------------------------------------------------------
 * Key Variables:
 *
 * (1) Impact (k):
 *     k ≈ ΔP / OFI
 *
 *     Measures how much price moves per unit order flow.
 *
 * (2) Instability (I1):
 *     Captures variance / structural instability of price.
 *
 * (3) Impact-adjusted instability:
 *     kI1 = k × I1
 *
 *     High values → unstable + reactive market (explosive)
 *
 * (4) Fragility:
 *     Fragility = (1 - Liquidity) × |k|
 *
 *     Measures probability of market failure / sharp move
 *
 * (5) Regime:
 *     Discrete classification from RegimeEngine:
 *
 *       TOXIC        → fragile + high impact
 *       TREND_UP     → directional upward flow
 *       TREND_DOWN   → directional downward flow
 *       MEAN_REVERT  → stable + liquid
 *
 * ------------------------------------------------------------
 * This chart answers:
 *
 *   "Is the market stable, trending, or about to break?"
 */
export function initImpactChart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    if (impactChart) impactChart.dispose();

    impactChart = echarts.init(el);

    impactChart.setOption({
        backgroundColor: "#111",

        tooltip: { trigger: "axis" },

        legend: {
            data: ["Impact (k)", "k EMA", "k × I1", "Fragility", "Regime"],
            textStyle: { color: "#ccc" }
        },

        xAxis: {
            type: "category",
            data: [],
            axisLine: { lineStyle: { color: "#888" } }
        },

        /**
         * Y-axis:
         * Shared scale for all continuous signals
         *
         * Note:
         *  - k, kI1, fragility are not directly comparable
         *  - but visual alignment helps detect co-movement
         */
        yAxis: [
            {
                type: "value",
                name: "Impact Space",
                axisLine: { lineStyle: { color: "#888" } },
                splitLine: { lineStyle: { color: "#222" } }
            }
        ],

        series: [
            /**
             * (1) Raw Impact
             * ----------------------------------------
             * k_t ≈ ΔP / OFI
             *
             * No smoothing → captures instantaneous response
             */
            {
                name: "Impact (k)",
                type: "line",
                data: [],
                smooth: false,
                showSymbol: false
            },

            /**
             * (2) Smoothed Impact
             * ----------------------------------------
             * k̃_t = α·k_t + (1 - α)·k̃_{t-1}
             *
             * Reduces noise → reveals structural shifts
             */
            {
                name: "k EMA",
                type: "line",
                data: [],
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2 }
            },

            /**
             * (3) Impact-adjusted Instability
             * ----------------------------------------
             * kI1_t = k_t × I1_t
             *
             * Interpretation:
             *  - high → explosive regime
             *  - low → absorbed flow
             */
            {
                name: "k × I1",
                type: "line",
                data: [],
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2, type: "dashed" }
            },

            /**
             * (4) Fragility
             * ----------------------------------------
             * Fragility_t = (1 - L_t) × |k_t|
             *
             * Combines:
             *  - lack of liquidity
             *  - high impact
             *
             * High → market likely to break
             */
            {
                name: "Fragility",
                type: "line",
                data: [],
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2 }
            },

            /**
             * (5) Regime (categorical → numeric encoding)
             * ----------------------------------------
             *
             * Mapping:
             *   TOXIC       → -1
             *   TREND_UP    →  0.5
             *   TREND_DOWN  → -0.5
             *   MEAN_REVERT →  1
             *
             * Used for visualization only
             */
            {
                name: "Regime",
                type: "bar",
                data: [],
                opacity: 0.2
            }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}

/* ============================================================
   Internal Buffers (Rolling Time Series)
   ============================================================ */

const kBuffer = [];            // k_t
const kEmaBuffer = [];         // k̃_t
const kI1Buffer = [];          // k × I1
const fragilityBuffer = [];    // fragility_t
const regimeBuffer = [];       // encoded regime
const timeBuffer = [];         // timestamps

let kEma = 0;

/**
 * Update Impact Chart
 * ------------------------------------------------------------
 * Called on each websocket tick
 *
 * Inputs:
 *   k         → impact coefficient
 *   I1        → instability metric
 *   fragility → (1 - liquidity) × |k|
 *   regime    → string label (TOXIC / TREND / MEAN_REVERT)
 */
export function updateImpactChart(k, I1, fragility, regime, timestamp = Date.now()) {
    if (!impactChart || impactChart.isDisposed?.()) return;
    if (k == null || isNaN(k)) return;

    /**
     * --------------------------------------------------------
     * 1. EMA smoothing
     *
     *   k̃_t = α·k_t + (1 - α)·k̃_{t-1}
     */
    const alpha = 0.1;
    kEma = alpha * k + (1 - alpha) * kEma;

    /**
     * --------------------------------------------------------
     * 2. Impact-adjusted instability
     *
     *   kI1_t = k_t × I1_t
     */
    const kI1 = (I1 != null && !isNaN(I1)) ? k * I1 : 0;

    /**
     * --------------------------------------------------------
     * 3. Regime encoding
     *
     * Convert categorical → numeric for plotting
     */
    const regimeMap = {
        TOXIC: -1,
        TREND_UP: 0.5,
        TREND_DOWN: -0.5,
        MEAN_REVERT: 1
    };

    const regimeValue = regimeMap[regime] ?? 0;

    /**
     * --------------------------------------------------------
     * 4. Push data into buffers
     */
    kBuffer.push(k);
    kEmaBuffer.push(kEma);
    kI1Buffer.push(kI1);
    fragilityBuffer.push(fragility);
    regimeBuffer.push(regimeValue);

    timeBuffer.push(new Date(timestamp).toLocaleTimeString());

    /**
     * --------------------------------------------------------
     * 5. Rolling window maintenance
     */
    const MAX = 300;
    if (kBuffer.length > MAX) {
        kBuffer.shift();
        kEmaBuffer.shift();
        kI1Buffer.shift();
        fragilityBuffer.shift();
        regimeBuffer.shift();
        timeBuffer.shift();
    }

    /**
     * --------------------------------------------------------
     * 6. Update chart
     */
    impactChart.setOption({
        xAxis: { data: timeBuffer },
        series: [
            { data: kBuffer },
            { data: kEmaBuffer },
            { data: kI1Buffer },
            { data: fragilityBuffer },
            { data: regimeBuffer }
        ]
    });
}

/**
 * Reset Impact Chart
 * ------------------------------------------------------------
 * Clears all buffers on:
 *   - symbol change
 *   - timeframe reset
 */
export function resetImpactChart() {
    kBuffer.length = 0;
    kEmaBuffer.length = 0;
    kI1Buffer.length = 0;
    fragilityBuffer.length = 0;
    regimeBuffer.length = 0;
    timeBuffer.length = 0;

    kEma = 0;

    if (impactChart) {
        impactChart.setOption({
            xAxis: { data: [] },
            series: [
                { data: [] },
                { data: [] },
                { data: [] },
                { data: [] },
                { data: [] }
            ]
        });
    }
}