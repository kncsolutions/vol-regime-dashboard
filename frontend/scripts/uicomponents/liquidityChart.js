let liquidityChart = null;

/**
 * ============================================================
 * Liquidity Chart
 * ============================================================
 *
 * Purpose:
 * --------
 * Visualize real-time market liquidity and its regime dynamics.
 *
 * The chart displays three layers:
 *
 * 1. Raw Liquidity:
 *      L_t ∈ [0,1]
 *      → computed from LiquidityEngine
 *
 * 2. Smoothed Liquidity (EMA):
 *      L̃_t = α·L_t + (1 - α)·L̃_{t-1}
 *
 *      → reduces microstructure noise
 *      → reveals regime trends
 *
 * 3. Regime Classification:
 *      R_t ∈ {-1, 0, 1}
 *
 *      R_t =
 *          -1  if L_t < 0.3   → Fragile market
 *           0  if 0.3 ≤ L_t ≤ 0.7 → Normal
 *           1  if L_t > 0.7   → Deep liquidity
 *
 * Interpretation:
 * ---------------
 *   L → 1 → deep, stable, high capacity
 *   L → 0 → thin, fragile, high risk
 *
 * This chart helps answer:
 *   "Can the market absorb flow without moving price?"
 */
export function initLiquidityChart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    // Prevent memory leaks on re-init
    if (liquidityChart) liquidityChart.dispose();

    liquidityChart = echarts.init(el);

    liquidityChart.setOption({
        backgroundColor: "#111",

        tooltip: {
            trigger: "axis"
        },

        // Legend shows transformation layers
        legend: {
            data: ["Liquidity", "Liquidity EMA", "Regime"],
            textStyle: { color: "#ccc" }
        },

        // Time axis
        xAxis: {
            type: "category",
            data: [],
            axisLine: { lineStyle: { color: "#888" } }
        },

        /**
         * Y-axis:
         * Liquidity is normalized:
         *   0 ≤ L ≤ 1
         */
        yAxis: {
            type: "value",
            min: 0,
            max: 1,
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },

        series: [
            /**
             * Raw Liquidity
             * ----------------------------------------
             * Direct output from LiquidityEngine:
             *
             *   L_t = f(depth, spread, k, I1)
             *
             * No smoothing → high-frequency microstructure signal
             */
            {
                name: "Liquidity",
                type: "line",
                data: [],
                smooth: false,
                showSymbol: false
            },

            /**
             * EMA Smoothed Liquidity
             * ----------------------------------------
             *   L̃_t = α·L_t + (1 - α)·L̃_{t-1}
             *
             * Provides:
             *   - regime stability
             *   - trend detection
             */
            {
                name: "Liquidity EMA",
                type: "line",
                data: [],
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2 }
            },

            /**
             * Regime (Discrete State)
             * ----------------------------------------
             * Encodes market condition:
             *
             *   -1 → Fragile (L < 0.3)
             *    0 → Normal  (0.3–0.7)
             *    1 → Deep    (L > 0.7)
             *
             * Plotted as bar for visual separation
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
   Internal Rolling Buffers
   ============================================================ */

// Raw liquidity values
const liquidityBuffer = [];

// EMA-smoothed liquidity
const liquidityEmaBuffer = [];

// Regime states (-1, 0, 1)
const regimeBuffer = [];

// Time axis
const timeBuffer = [];

// EMA state
let liquidityEma = 0;

/**
 * Update Liquidity Chart
 * ------------------------------------------------------------
 * Called on every tick
 *
 * Input:
 *   liquidity → L_t ∈ [0,1]
 */
export function updateLiquidityChart(liquidity, timestamp = Date.now()) {
    if (!liquidityChart || liquidityChart.isDisposed?.()) return;

    if (liquidity == null || isNaN(liquidity)) return;

    /**
     * --------------------------------------------------------
     * 1. EMA Smoothing
     * --------------------------------------------------------
     *
     *   L̃_t = α·L_t + (1 - α)·L̃_{t-1}
     *
     * α controls responsiveness vs stability
     */
    const alpha = 0.1;
    liquidityEma = alpha * liquidity + (1 - alpha) * liquidityEma;

    /**
     * --------------------------------------------------------
     * 2. Regime Classification
     * --------------------------------------------------------
     *
     * Piecewise definition:
     *
     *   R_t =
     *      -1  if L < 0.3  (Fragile / low liquidity)
     *       0  if 0.3–0.7  (Normal)
     *       1  if L > 0.7  (Deep / high liquidity)
     */
    let regime = 0;
    if (liquidity < 0.3) regime = -1;
    else if (liquidity > 0.7) regime = 1;
    else regime = 0;

    /**
     * --------------------------------------------------------
     * 3. Store values
     * --------------------------------------------------------
     */
    liquidityBuffer.push(liquidity);
    liquidityEmaBuffer.push(liquidityEma);
    regimeBuffer.push(regime);

    timeBuffer.push(new Date(timestamp).toLocaleTimeString());

    /**
     * --------------------------------------------------------
     * 4. Maintain rolling window
     * --------------------------------------------------------
     */
    const MAX = 300;
    if (liquidityBuffer.length > MAX) {
        liquidityBuffer.shift();
        liquidityEmaBuffer.shift();
        regimeBuffer.shift();
        timeBuffer.shift();
    }

    /**
     * --------------------------------------------------------
     * 5. Update chart
     * --------------------------------------------------------
     */
    liquidityChart.setOption({
        xAxis: { data: timeBuffer },
        series: [
            { data: liquidityBuffer },
            { data: liquidityEmaBuffer },
            { data: regimeBuffer }
        ]
    });
}

/**
 * Reset Liquidity Chart
 * ------------------------------------------------------------
 * Called on:
 *   - stock change
 *   - timeframe change
 */
export function resetLiquidityChart() {
    liquidityBuffer.length = 0;
    liquidityEmaBuffer.length = 0;
    regimeBuffer.length = 0;
    timeBuffer.length = 0;

    liquidityEma = 0;

    if (liquidityChart) {
        liquidityChart.setOption({
            xAxis: { data: [] },
            series: [
                { data: [] },
                { data: [] },
                { data: [] }
            ]
        });
    }
}