let liquidityChart = null;

/**
 * INIT
 */
export function initLiquidityChart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    if (liquidityChart) liquidityChart.dispose();

    liquidityChart = echarts.init(el);

    liquidityChart.setOption({
        backgroundColor: "#111",

        grid: [
            { left: "5%", right: "30%", top: "5%", bottom: "12%" },
            { left: "75%", right: "5%", top: "5%", bottom: "12%" }
        ],

        tooltip: { trigger: "axis" },

        legend: {
            top: 0,
            data: ["Liquidity", "Liquidity EMA", "Regime", "Regime Profile"],
            textStyle: { color: "#ccc" }
        },

        xAxis: [
            {
                type: "category",
                gridIndex: 0,
                data: [],
                axisLine: { lineStyle: { color: "#888" } }
            },
            {
                type: "value",
                gridIndex: 1,
                name: "Count"
            }
        ],

        yAxis: [
            {
                type: "value",
                gridIndex: 0,
                min: 0,
                max: 1,
                axisLine: { lineStyle: { color: "#888" } },
                splitLine: { lineStyle: { color: "#222" } }
            },
            {
                type: "category",
                gridIndex: 1,
                data: ["FRAGILE", "NORMAL", "DEEP"]
            }
        ],

        series: [
            { name: "Liquidity", type: "line", data: [], showSymbol: false },
            { name: "Liquidity EMA", type: "line", data: [], smooth: true, showSymbol: false },
            { name: "Regime", type: "bar", data: [], opacity: 0.2 },

            // 🔥 NEW PROFILE
            {
                name: "Regime Profile",
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: [],
                barWidth: "60%"
            }
        ],

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 30 }
        ]
    });
}

/**
 * BUFFERS
 */
const liquidityBuffer = [];
const liquidityEmaBuffer = [];
const regimeBuffer = [];        // numeric
const regimeLabelBuffer = [];   // 🔥 string
const timeBuffer = [];

let liquidityEma = 0;

/**
 * PROFILE BUILDER
 */
function buildRegimeProfile(arr) {
    const counts = {
        FRAGILE: 0,
        NORMAL: 0,
        DEEP: 0
    };

    for (let r of arr) {
        if (counts[r] != null) counts[r]++;
    }

    const labels = Object.keys(counts);
    const values = labels.map(k => counts[k]);

    let vpoc = null;
    let max = -1;

    for (let k of labels) {
        if (counts[k] > max) {
            max = counts[k];
            vpoc = k;
        }
    }

    return { labels, values, vpoc };
}

/**
 * UPDATE
 */
export function updateLiquidityChart(liquidity, timestamp = Date.now()) {
    if (!liquidityChart || liquidityChart.isDisposed?.()) return;
    if (liquidity == null || isNaN(liquidity)) return;

    /**
     * EMA
     */
    const alpha = 0.1;
    liquidityEma = alpha * liquidity + (1 - alpha) * liquidityEma;

    /**
     * Regime classification
     */
    let regime = 0;
    let regimeLabel = "NORMAL";

    if (liquidity < 0.3) {
        regime = -1;
        regimeLabel = "FRAGILE";
    } else if (liquidity > 0.7) {
        regime = 1;
        regimeLabel = "DEEP";
    }

    /**
     * Store
     */
    liquidityBuffer.push(liquidity);
    liquidityEmaBuffer.push(liquidityEma);
    regimeBuffer.push(regime);
    regimeLabelBuffer.push(regimeLabel);

    timeBuffer.push(new Date(timestamp).toLocaleTimeString());

    /**
     * Rolling window
     */
    const MAX = 300;
    if (liquidityBuffer.length > MAX) {
        liquidityBuffer.shift();
        liquidityEmaBuffer.shift();
        regimeBuffer.shift();
        regimeLabelBuffer.shift();
        timeBuffer.shift();
    }

    /**
     * 🔥 PROFILE (≤200)
     */
    const recent = regimeLabelBuffer.slice(-200);
    const profile = buildRegimeProfile(recent);

    /**
     * UPDATE
     */
    liquidityChart.setOption({
        xAxis: [
            { data: timeBuffer },
            {}
        ],

        series: [
            { data: liquidityBuffer },
            { data: liquidityEmaBuffer },
            { data: regimeBuffer },

            {
                name: "Regime Profile",
                data: profile.values,
                itemStyle: {
                    color: function (params) {
                        return profile.labels[params.dataIndex] === profile.vpoc
                            ? "#ff4444"
                            : "#888";
                    }
                }
            }
        ]
    });
}

/**
 * RESET
 */
export function resetLiquidityChart() {
    liquidityBuffer.length = 0;
    liquidityEmaBuffer.length = 0;
    regimeBuffer.length = 0;
    regimeLabelBuffer.length = 0;
    timeBuffer.length = 0;

    liquidityEma = 0;

    if (liquidityChart) {
        liquidityChart.setOption({
            xAxis: [{ data: [] }, {}],
            series: Array(4).fill({ data: [] })
        });
    }
}