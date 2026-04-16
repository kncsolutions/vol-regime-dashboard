let positionChart = null;

/**
 * Position Sizing Chart
 * ============================================================
 * Visualizes the full transformation pipeline:
 *
 * 1. Raw Signal:
 *      s_t = k_t * I1_t * (1 - liquidity_t)
 *
 * 2. Normalized Signal:
 *      s_norm = tanh(EMA(s_t) * γ)
 *      → bounded in [-1, 1]
 *
 * 3. Position Units:
 *      units = (s_norm * riskBudget) / price
 *
 * 4. Risk Caps:
 *      maxUnits = ± (riskBudget / price)
 *
 * This chart shows:
 *  - microstructure signal (raw)
 *  - decision signal (normalized)
 *  - execution size (units)
 *  - risk boundaries (caps)
 */
export function initPositionSizingChart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    // Prevent memory leaks on re-init
    if (positionChart) positionChart.dispose();

    positionChart = echarts.init(el);

    positionChart.setOption({
        backgroundColor: "#111",

        tooltip: { trigger: "axis" },

        // Legend explains transformation layers
        legend: {
            data: [
                "Raw Signal",
                "Normalized",
                "Position Units",
                "Max Long",
                "Max Short"
            ],
            textStyle: { color: "#ccc" }
        },

        // Time axis (tick-by-tick evolution)
        xAxis: {
            type: "category",
            data: [],
            axisLine: { lineStyle: { color: "#888" } }
        },

        // Dual axis:
        // Left → signal space
        // Right → actual position size
        yAxis: [
            {
                type: "value",
                name: "Signal",
                position: "left",
                axisLine: { lineStyle: { color: "#888" } },
                splitLine: { lineStyle: { color: "#222" } }
            },
            {
                type: "value",
                name: "Units",
                position: "right",
                axisLine: { lineStyle: { color: "#888" } }
            }
        ],

        series: [
            /**
             * Raw microstructure signal
             * ----------------------------------------
             * s_t = k * I1 * (1 - liquidity)
             *
             * Interpretation:
             *  - k → price sensitivity
             *  - I1 → instability
             *  - (1 - liquidity) → fragility
             */
            {
                name: "Raw Signal",
                type: "line",
                data: [],
                showSymbol: false
            },

            /**
             * Normalized signal (decision layer)
             * ----------------------------------------
             * s_norm = tanh(EMA(s_t) * γ)
             *
             * Smooth + bounded → usable for trading
             */
            {
                name: "Normalized",
                type: "line",
                data: [],
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2 }
            },

            /**
             * Actual position size (execution layer)
             * ----------------------------------------
             * units = positionValue / price
             *
             * Reflects real exposure taken by system
             */
            {
                name: "Position Units",
                type: "line",
                yAxisIndex: 1,
                data: [],
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2 }
            },

            /**
             * Maximum long exposure (risk cap)
             * ----------------------------------------
             * + maxUnits
             */
            {
                name: "Max Long",
                type: "line",
                yAxisIndex: 1,
                data: [],
                lineStyle: { type: "dashed" },
                showSymbol: false
            },

            /**
             * Maximum short exposure (risk cap)
             * ----------------------------------------
             * - maxUnits
             */
            {
                name: "Max Short",
                type: "line",
                yAxisIndex: 1,
                data: [],
                lineStyle: { type: "dashed" },
                showSymbol: false
            }
        ],
            dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],    });
}

/* ============================================================
   Internal Rolling Buffers
   ============================================================ */

// Raw signal buffer
const rawBuffer = [];

// Normalized signal buffer
const normBuffer = [];

// Actual position units buffer
const unitsBuffer = [];

// Risk cap bands
const maxLongBuffer = [];
const maxShortBuffer = [];

// Time axis
const timeBuffer = [];

/**
 * Update Position Sizing Chart
 * ------------------------------------------------------------
 * Called on every tick after position is computed
 *
 * Input: position object from PositionSizingEngine
 * {
 *   raw,          → k * I1 * (1 - liquidity)
 *   normalized,   → bounded decision signal [-1,1]
 *   units         → actual position size
 * }
 */
export function updatePositionSizingChart(position, timestamp = Date.now()) {
    if (!positionChart || positionChart.isDisposed?.()) return;
    if (!position) return;

    const {
        raw,
        normalized,
        units
    } = position;

    /**
     * Risk cap estimation
     * --------------------------------------------------
     * Ideally:
     *   maxUnits = riskBudget / price
     *
     * Here approximated dynamically from observed units
     */
    const maxUnits = Math.max(Math.abs(units), 1);

    // Push data into buffers
    rawBuffer.push(raw);
    normBuffer.push(normalized);
    unitsBuffer.push(units);
    maxLongBuffer.push(maxUnits);
    maxShortBuffer.push(-maxUnits);

    timeBuffer.push(new Date(timestamp).toLocaleTimeString());

    /**
     * Maintain rolling window (fixed memory)
     */
    const MAX = 300;
    if (rawBuffer.length > MAX) {
        rawBuffer.shift();
        normBuffer.shift();
        unitsBuffer.shift();
        maxLongBuffer.shift();
        maxShortBuffer.shift();
        timeBuffer.shift();
    }

    /**
     * Update chart
     */
    positionChart.setOption({
        xAxis: { data: timeBuffer },
        series: [
            { data: rawBuffer },
            { data: normBuffer },
            { data: unitsBuffer },
            { data: maxLongBuffer },
            { data: maxShortBuffer }
        ]
    });
}

/**
 * Reset chart state
 * ------------------------------------------------------------
 * Called on:
 *  - stock change
 *  - timeframe switch
 */
export function resetPositionSizingChart() {
    rawBuffer.length = 0;
    normBuffer.length = 0;
    unitsBuffer.length = 0;
    maxLongBuffer.length = 0;
    maxShortBuffer.length = 0;
    timeBuffer.length = 0;

    if (positionChart) {
        positionChart.setOption({
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