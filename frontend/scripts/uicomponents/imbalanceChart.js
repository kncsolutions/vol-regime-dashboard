export let imbalanceChart = null;

/**
 * ----------------------------------------
 * INIT
 * ----------------------------------------
 */
export function initImbalanceChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (imbalanceChart) imbalanceChart.dispose();

    imbalanceChart = echarts.init(el);

    imbalanceChart.setOption({
        backgroundColor: "#111",

        tooltip: { trigger: "axis" },

        grid: [
            { left: "5%", right: "30%", top: "5%", bottom: "10%" },
            { left: "75%", right: "5%", top: "5%", bottom: "10%" }
        ],

        xAxis: [
            { type: "category", data: [], boundaryGap: false },
            { type: "value", name: "Freq" }
        ],

        yAxis: [
            { type: "value", min: -1, max: 1 }, // imbalance range
            { type: "category", data: [], inverse: true }
        ],

        legend: {
            top: 5,
            data: ["Imbalance", "Profile"]
        },

        series: [
            {
                name: "Imbalance",
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
            { type: "slider", height: 25, bottom: 20 }
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
export function updateImbalanceChart(marketBuffer) {
    if (!imbalanceChart || imbalanceChart.isDisposed?.() || !imbalanceChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 30) return;

    const x = [];
    const data = [];

    for (let i = 0; i < len; i++) {
        const v = marketBuffer.imbalance[i];

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
    imbalanceChart.setOption({

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
                min: -1,
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
                    <b>Imbalance:</b> ${p.data?.toFixed(4)}
                `;
            }
        },

        series: [
            {
                name: "Imbalance",
                type: "line",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: data,
                smooth: true,
                showSymbol: false,
                lineStyle: { color: "#00ffaa", width: 1.5 },

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
                itemStyle: { color: "#666" }
            }
        ],

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 20 }
        ]
    });
}