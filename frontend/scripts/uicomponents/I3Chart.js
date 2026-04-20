export let I3Chart = null;

/**
 * ----------------------------------------
 * INIT
 * ----------------------------------------
 */
export function initI3Chart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    if (I3Chart) I3Chart.dispose();

    I3Chart = echarts.init(el);

    I3Chart.setOption({
        backgroundColor: "#111",

        grid: [
            { left: "5%", right: "30%", top: "5%", bottom: "12%" },
            { left: "75%", right: "5%", top: "5%", bottom: "12%" }
        ],

        tooltip: { trigger: "axis" },

        legend: {
            top: 10,
            data: ["I3", "Profile"],
            textStyle: { color: "#ccc" }
        },

        xAxis: [
            {
                type: "category",
                gridIndex: 0,
                data: [],
                boundaryGap: false,
                axisLabel: { color: "#aaa" }
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
                axisLabel: { color: "#aaa" }
            },
            {
                type: "category",
                gridIndex: 1,
                data: [],
                inverse: false
            }
        ],

        series: [],

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 30 }
        ]
    });
}

/**
 * ----------------------------------------
 * VPOC
 * ----------------------------------------
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
 * ----------------------------------------
 * PROFILE
 * ----------------------------------------
 */
function buildProfile(arr, bins = 40) {
    const clean = arr.filter(v => v != null && isFinite(v));
    if (clean.length < 5) return null;

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    if (min === max) return null;

    const step = (max - min) / bins;

    const hist = new Array(bins).fill(0);
    const values = [];

    for (let i = 0; i < bins; i++) {
        values.push(min + i * step);
    }

    for (let v of clean) {
        const idx = Math.min(bins - 1, Math.floor((v - min) / step));
        hist[idx]++;
    }

    return { hist, values };
}

/**
 * ----------------------------------------
 * UPDATE
 * ----------------------------------------
 */
export function updateI3Chart(buffer) {
    if (!I3Chart || I3Chart.isDisposed?.() || !I3Chart._model) return;
    if (!buffer?.data || buffer.data.length < 10) return;

    const x = [];
    const y = [];

    for (let i = 0; i < buffer.data.length; i++) {
        const t = buffer.data[i]?.time;
        const v = buffer.data[i]?.value;

        if (v == null || !isFinite(v)) continue;

        x.push(t ?? i);
        y.push(v);
    }

    if (y.length < 10) return;

    /**
     * 🔥 Rolling window ≤200
     */
    const windowData = y.slice(-200);

    /**
     * 🔥 Compute VPOC + profile
     */
    const vpoc = computeVPOC(windowData);
    const profile = buildProfile(windowData, 40);
    if (!profile) return;

    const { hist, values } = profile;

    /**
     * ----------------------------------------
     * UPDATE
     * ----------------------------------------
     */
    I3Chart.setOption({

        xAxis: [
            { gridIndex: 0, data: x },
            { gridIndex: 1 }
        ],

        yAxis: [
            { gridIndex: 0 },
            {
                gridIndex: 1,
                data: values.map(v => v.toFixed(4))
            }
        ],

        series: [
            {
                name: "I3",
                type: "line",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: y,
                smooth: true,
                showSymbol: false,

                markLine: {
                    silent: true,
                    lineStyle: { type: "dashed" },
                    label: { color: "#fff" },
                    data: [
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