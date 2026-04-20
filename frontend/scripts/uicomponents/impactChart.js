let impactChart = null;

/**
 * INIT
 */
export function initImpactChart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    if (impactChart) impactChart.dispose();

    impactChart = echarts.init(el);

    impactChart.setOption({
        backgroundColor: "#111",

        grid: [
            { left: "5%", right: "30%", top: "5%", bottom: "12%" },
            { left: "75%", right: "5%", top: "5%", bottom: "12%" }
        ],

        tooltip: { trigger: "axis" },

        legend: {
            top:0,
            data: ["Impact (k)", "k EMA", "k × I1", "Fragility", "Regime", "Regime Profile"],
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
                name: "Impact Space",
                axisLine: { lineStyle: { color: "#888" } },
                splitLine: { lineStyle: { color: "#222" } }
            },
            {
                type: "category",
                gridIndex: 1,
                data: ["TOXIC", "TREND_UP", "TREND_DOWN", "MEAN_REVERT"]
            }
        ],

        series: [
            { name: "Impact (k)", type: "line", data: [], showSymbol: false },
            { name: "k EMA", type: "line", data: [], smooth: true, showSymbol: false },
            { name: "k × I1", type: "line", data: [], smooth: true, showSymbol: false },
            { name: "Fragility", type: "line", data: [], smooth: true, showSymbol: false },
            { name: "Regime", type: "bar", data: [], opacity: 0.2 },

            // 🔥 NEW PROFILE SERIES
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
const kBuffer = [];
const kEmaBuffer = [];
const kI1Buffer = [];
const fragilityBuffer = [];
const regimeBuffer = [];      // numeric (for plot)
const regimeLabelBuffer = []; // 🔥 string (for profile)
const timeBuffer = [];

let kEma = 0;

/**
 * PROFILE BUILDER (categorical)
 */
function buildRegimeProfile(arr) {
    const counts = {
        TOXIC: 0,
        TREND_UP: 0,
        TREND_DOWN: 0,
        MEAN_REVERT: 0
    };

    for (let r of arr) {
        if (counts[r] != null) counts[r]++;
    }

    const labels = Object.keys(counts);
    const values = labels.map(k => counts[k]);

    // 🔥 VPOC
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
export function updateImpactChart(k, I1, fragility, regime, timestamp = Date.now()) {
    if (!impactChart || impactChart.isDisposed?.()) return;
    if (k == null || isNaN(k)) return;

    /**
     * EMA
     */
    const alpha = 0.1;
    kEma = alpha * k + (1 - alpha) * kEma;

    const kI1 = (I1 != null && !isNaN(I1)) ? k * I1 : 0;

    /**
     * Regime encoding
     */
    const regimeMap = {
        TOXIC: -1,
        TREND_UP: 0.5,
        TREND_DOWN: -0.5,
        MEAN_REVERT: 1
    };

    const regimeValue = regimeMap[regime] ?? 0;

    /**
     * Push buffers
     */
    kBuffer.push(k);
    kEmaBuffer.push(kEma);
    kI1Buffer.push(kI1);
    fragilityBuffer.push(fragility);
    regimeBuffer.push(regimeValue);
    regimeLabelBuffer.push(regime); // 🔥 actual label

    timeBuffer.push(new Date(timestamp).toLocaleTimeString());

    /**
     * Rolling window
     */
    const MAX = 300;
    if (kBuffer.length > MAX) {
        kBuffer.shift();
        kEmaBuffer.shift();
        kI1Buffer.shift();
        fragilityBuffer.shift();
        regimeBuffer.shift();
        regimeLabelBuffer.shift();
        timeBuffer.shift();
    }

    /**
     * 🔥 PROFILE (last ≤200)
     */
    const recent = regimeLabelBuffer.slice(-200);
    const profile = buildRegimeProfile(recent);

    /**
     * UPDATE CHART
     */
    impactChart.setOption({
        xAxis: [
            { data: timeBuffer },
            {}
        ],

        series: [
            { data: kBuffer },
            { data: kEmaBuffer },
            { data: kI1Buffer },
            { data: fragilityBuffer },
            { data: regimeBuffer },

            // 🔥 PROFILE
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
export function resetImpactChart() {
    kBuffer.length = 0;
    kEmaBuffer.length = 0;
    kI1Buffer.length = 0;
    fragilityBuffer.length = 0;
    regimeBuffer.length = 0;
    regimeLabelBuffer.length = 0;
    timeBuffer.length = 0;

    kEma = 0;

    if (impactChart) {
        impactChart.setOption({
            xAxis: [{ data: [] }, {}],
            series: Array(6).fill({ data: [] })
        });
    }
}