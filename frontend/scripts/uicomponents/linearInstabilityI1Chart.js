export let I1Chart = null;

/**
 * INIT
 */
export function initI1Chart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (I1Chart) I1Chart.dispose();

    I1Chart = echarts.init(el);

    I1Chart.setOption({
        backgroundColor: "#111",

        grid: [
            { left: "5%", right: "30%", top: "5%", bottom: "12%" },   // main
            { left: "75%", right: "5%", top: "5%", bottom: "12%" }    // histogram
        ],

        tooltip: { trigger: "axis" },

        xAxis: [
            { type: "category", gridIndex: 0, data: [], boundaryGap: false },
            { type: "value", gridIndex: 1, name: "Freq" }
        ],

        yAxis: [
            { type: "value", gridIndex: 0, scale: true },
            { type: "category", gridIndex: 1, data: [], inverse: false }
        ],

        legend: {
            top : 10,
            data: ["I1 Raw", "I1 Smoothed", "Profile"],
            textStyle: { color: "#ccc" }
        },

        series: []
    });
}

/**
 * EMA
 */
function smoothEMA(data, alpha = 0.2) {
    const out = [];
    let prev = null;

    for (let v of data) {
        if (v == null || !isFinite(v)) {
            out.push(null);
            continue;
        }

        prev = prev == null ? v : alpha * v + (1 - alpha) * prev;
        out.push(prev);
    }

    return out;
}

/**
 * VPOC
 */
function computeVPOC(arr, bins = 40) {
    const clean = arr.filter(v => v != null && isFinite(v));
    if (clean.length < 5) return null;

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    if (min === max) return clean[0];

    const step = (max - min) / bins;
    const hist = new Array(bins).fill(0);

    for (let v of clean) {
        const idx = Math.min(bins - 1, Math.floor((v - min) / step));
        hist[idx]++;
    }

    let pocIndex = hist.indexOf(Math.max(...hist));
    return min + pocIndex * step;
}

/**
 * PROFILE
 */
function buildProfile(arr, bins = 40) {
    const clean = arr.filter(v => v != null && isFinite(v));
    if (clean.length < 5) return null;

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
 * UPDATE
 */
export function updateI1Chart(I1Buffer) {
    if (!I1Chart || I1Chart.isDisposed?.() || !I1Chart._model) return;

    const len = I1Buffer.data.length;
    if (len < 10) return;

    const raw = [];
    const x = [];

    for (let i = 0; i < len; i++) {
        const v = I1Buffer.data[i];
        raw.push(v != null && isFinite(v) ? v : null);
        x.push(i);
    }

    const smoothed = smoothEMA(raw, 0.2);

    // 🔥 window ≤200
    const windowData = smoothed.slice(-200);

    const vpoc = computeVPOC(windowData);
    const profile = buildProfile(windowData, 40);

    if (!profile) return;

    const { hist, prices } = profile;

    I1Chart.setOption({

        xAxis: [
            { gridIndex: 0, data: x },
            { gridIndex: 1 }
        ],

        yAxis: [
            { gridIndex: 0 },
            {
                gridIndex: 1,
                data: prices.map(p => p.toFixed(3)),
                inverse: false
            }
        ],

        series: [
            {
                name: "I1 Raw",
                type: "line",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: raw,
                showSymbol: false,
                lineStyle: { opacity: 0.4 }
            },
            {
                name: "I1 Smoothed",
                type: "line",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: smoothed,
                showSymbol: false,

                markLine: {
                    silent: true,
                    data: [
                        { yAxis: 0 },
                        { yAxis: 0.1 },
                        { yAxis: -0.1 },

                        ...(vpoc != null ? [
                            { yAxis: vpoc, name: "VPOC" }
                        ] : [])
                    ]
                }
            },
            {
                name: "Profile",
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: hist,
                barWidth: "70%",
                itemStyle: { opacity: 0.5 }
            }
        ]
    });
}