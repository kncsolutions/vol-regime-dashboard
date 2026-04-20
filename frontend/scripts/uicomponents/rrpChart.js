export let rrpChart = null;

/**
 * ----------------------------------------
 * INIT
 * ----------------------------------------
 */
export function initRRPChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (rrpChart) rrpChart.dispose();

    rrpChart = echarts.init(el);

    rrpChart.setOption({
        backgroundColor: "#111",

        grid: [
            { left: "5%", right: "30%", top: "5%", bottom: "12%" },
            { left: "75%", right: "5%", top: "5%", bottom: "12%" }
        ],

        tooltip: { trigger: "axis" },

        xAxis: [
            { type: "category", data: [], boundaryGap: false },
            { type: "value", name: "Freq" }
        ],

        yAxis: [
            { type: "value", min: 0, max: 1 },
            { type: "category", data: [], inverse: true }
        ],

        legend: {
            top: 10,
            data: ["RRP", "Profile"]
        },

        series: [
            {
                name: "RRP",
                type: "line",
                data: [],
                smooth: true,
                showSymbol: false
            },
            {
                name: "Profile",
                type: "bar",
                data: []
            }
        ],

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 10 }
        ]
    });
}

/**
 * ----------------------------------------
 * VALUE AREA CALCULATION
 * ----------------------------------------
 */
function computeValueArea(arr, bins = 50, valueAreaPercent = 0.7) {
    const clean = arr.filter(v => v != null && isFinite(v));
    if (clean.length < 20) return null;

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    if (min === max) return null;

    const step = (max - min) / bins;
    const hist = new Array(bins).fill(0);

    for (let v of clean) {
        const idx = Math.min(bins - 1, Math.floor((v - min) / step));
        hist[idx]++;
    }

    const total = clean.length;

    let pocIndex = 0;
    let maxCount = 0;

    for (let i = 0; i < bins; i++) {
        if (hist[i] > maxCount) {
            maxCount = hist[i];
            pocIndex = i;
        }
    }

    let left = pocIndex;
    let right = pocIndex;
    let accumulated = hist[pocIndex];

    while (accumulated / total < valueAreaPercent) {
        const leftVal = left > 0 ? hist[left - 1] : -1;
        const rightVal = right < bins - 1 ? hist[right + 1] : -1;

        if (rightVal > leftVal) {
            right++;
            accumulated += rightVal;
        } else {
            left--;
            accumulated += leftVal;
        }

        if (left <= 0 && right >= bins - 1) break;
    }

    return {
        poc: min + pocIndex * step,
        vah: min + right * step,
        val: min + left * step
    };
}

/**
 * ----------------------------------------
 * PROFILE BUILDER
 * ----------------------------------------
 */
function buildProfile(arr, bins = 40) {
    const clean = arr.filter(v => v != null && isFinite(v));
    if (clean.length < 20) return null;

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    if (min === max) return null;

    const step = (max - min) / bins;

    const hist = new Array(bins).fill(0);
    const prices = [];

    for (let i = 0; i < bins; i++) {
        prices.push(min + i * step);
    }

    for (let v of clean) {
        const idx = Math.min(bins - 1, Math.floor((v - min) / step));
        hist[idx]++;
    }

    return { hist, prices };
}

/**
 * ----------------------------------------
 * UPDATE
 * ----------------------------------------
 */
export function renderRRP(series) {
    if (!rrpChart || rrpChart.isDisposed?.() || !rrpChart._model) return;
    if (!Array.isArray(series) || series.length < 30) return;

    const x = [];
    const data = [];

    for (let i = 0; i < series.length; i++) {
        const v = series[i]?.value;
        if (v == null || !isFinite(v)) continue;

        x.push(i);
        data.push(v);
    }

    if (data.length < 30 || x.length !== data.length) return;

    /**
     * 🔥 Rolling window
     */
    const WINDOW = 300;
    const windowData = data.slice(-WINDOW);

    const profile = buildProfile(windowData, 40);
    if (!profile) return;

    const { hist, prices } = profile;
    const levels = computeValueArea(windowData);

    /**
     * ----------------------------------------
     * UPDATE CHART
     * ----------------------------------------
     */
    rrpChart.setOption({

        xAxis: [
            {
                type: "category",
                gridIndex: 0,
                data: x,
                boundaryGap: false
            },
            {
                type: "value",
                gridIndex: 1,
                name: "Freq"
            }
        ],

        yAxis: [
            {
                type: "value",
                gridIndex: 0,
                min: 0,
                max: 1
            },
            {
                type: "category",
                gridIndex: 1,
                data: prices.map(p => p.toFixed(3)),
                inverse: false
            }
        ],

        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            borderColor: "#555",
            textStyle: { color: "#fff" },
            formatter: function (params) {
                const p = params[0];
                return `
                    <b>Index:</b> ${p.dataIndex}<br/>
                    <b>RRP:</b> ${p.data?.toFixed(4)}
                `;
            }
        },

        series: [
            {
                name: "RRP",
                type: "line",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: data,
                smooth: true,
                showSymbol: false,
                lineStyle: { color: "#ffaa00", width: 1.5 },

                markLine: levels ? {
                    symbol: "none",
                    label: { color: "#fff" },
                    lineStyle: { width: 1.2 },
                    data: [
                        { yAxis: levels.poc, name: "POC" },
                        { yAxis: levels.vah, name: "VAH" },
                        { yAxis: levels.val, name: "VAL" }
                    ]
                } : undefined
            },
            {
                name: "Profile",
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: hist,
                barWidth: "70%",
                itemStyle: { color: "#555" }
            }
        ],

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 10 }
        ]
    });
}