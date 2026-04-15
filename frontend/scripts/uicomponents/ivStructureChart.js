export let ivChart = null;
// ✅ GLOBAL DATA BUFFERS
export let ivData = []
export let hvData = []
export let skewData = []
export let curvatureData = []
export let callSkewData = []
export let putSkewData = []
export function initIVStructureChart(panel) {
    const container = document.getElementById(panel);

    if (!container) return

    ivChart = echarts.init(container)

    const option = {
        backgroundColor: "#0e1117",

        tooltip: {
            trigger: "axis"
        },

        legend: {
            data: ["ATM IV", "HV" ,"Skew", "Curvature", "Call Skew", "Put Skew"],
            textStyle: { color: "#DDD" },
            top: 0
        },

        xAxis: {
            type: "time",
            axisLabel: { color: "#AAA" }
        },

        yAxis: [
            {
                type: "value",
                name: "IV-HV",
                position: "left",
                axisLabel: { color: "#FFD700" }
            },

            {
                type: "value",
                name: "Skew/Curvature",
                position: "right",
                axisLabel: { color: "#00FFFF" }
            }
        ],

        series: [
            { name: "ATM IV", type: "line", yAxisIndex: 0, data: [] },
            { name: "HV", type: "line", yAxisIndex: 0, data: [] },
            { name: "Skew", type: "line", yAxisIndex: 1, data: [] },
            { name: "Curvature", type: "line", yAxisIndex: 1, data: [] },
            { name: "Call Skew", type: "line", yAxisIndex: 1, data: [] },
            { name: "Put Skew", type: "line", yAxisIndex: 1, data: [] }
        ]
    }

    ivChart.setOption(option)
}


export function updateIVStructureChart(features) {
    if (!ivChart || !features) return

    const t = features.timestamp

    // =========================
    // 🔥 NORMALIZATION
    // =========================
    const safe = (v, scale = 1) =>
    isFinite(v) ? v / scale : NaN

    const atm_iv_norm = safe(features.atm_iv, 20)
    const hv_norm = safe(features.hv, 20)
    const skew_norm = safe(features.skew, 1)
    const curvature_norm = safe(features.curvature, 10)
    const call_skew_norm = safe(features.call_skew, 100)
    const put_skew_norm = safe(features.put_skew, 100)
    // =========================
    // STORE: [time, normalized, original]
    // =========================
    const safeOriginal = (v) => isFinite(v) ? v : null
    ivData.push([t, atm_iv_norm, features.atm_iv])
    hvData.push([t, hv_norm, safeOriginal(features.hv)])
    skewData.push([t, skew_norm, features.skew])
    curvatureData.push([t, curvature_norm, features.curvature])
    callSkewData.push([t, call_skew_norm, features.call_skew])
    putSkewData.push([t, put_skew_norm, features.put_skew])

    // =========================
    // FIXED WINDOW SIZE
    // =========================
    const MAX_POINTS = 1000

    if (ivData.length > MAX_POINTS) {
        ivData.shift()
        hvData.shift()
        skewData.shift()
        curvatureData.shift()
        callSkewData.shift()
        putSkewData.shift()
    }
    console.log(t.length, ivData.length);

    // =========================
    // UPDATE CHART
    // =========================
    ivChart.setOption({
        yAxis: {
            min: -2,
            max: 2
        },
        series: [
            {
                name: "ATM IV",
                data: ivData
            },
            {
                name: "HV",
                data: hvData
            },
            {
                name: "Skew",
                data: skewData
            },
            {
                name: "Curvature",
                data: curvatureData
            },
            {
                name: "Call Skew",
                data: callSkewData
            },
            {
                name: "Put Skew",
                data: putSkewData
            }
        ],
          tooltip: {
            trigger: "axis",
            formatter: function (params) {
            if (!params || params.length === 0) return "";

            const timeVal = params[0]?.value?.[0];
            const time = timeVal ? new Date(timeVal) : null;

            let text = `${time ? time.toLocaleTimeString() : "N/A"}<br/><br/>`;

            params.forEach(p => {
                const original = p?.data?.[2];

                // ✅ HARD GUARD (bulletproof)
                if (typeof original !== "number" || !isFinite(original)) {
                    text += `${p.seriesName}: N/A<br/>`;
                } else {
                    text += `${p.seriesName}: ${original.toFixed(2)}<br/>`;
                }
            });

    return text;
}
        },
         dataZoom: [
            { type: 'inside' },
            { type: 'slider'}
        ],
    })
}

export function resetIVStructureChart() {
    console.log("🧹 Resetting IV Structure Chart...");

    // 1. Clear data arrays (CRITICAL)
    ivData.length = 0;
    hvData.length = 0;
    skewData.length = 0;
    curvatureData.length = 0;
    callSkewData.length = 0;
    putSkewData.length = 0;

    // 2. Reset chart safely
    if (!ivChart) return;

    if (ivChart.isDisposed?.()) return;

    // 🔥 Option A (RECOMMENDED): clear series only
    ivChart.setOption({
        series: [
            { name: "ATM IV", data: [] },
            { name: "HV", data: [] },
            { name: "Skew", data: [] },
            { name: "Curvature", data: [] },
            { name: "Call Skew", data: [] },
            { name: "Put Skew", data: [] }
        ]
    });

    // 🔥 Optional: reset zoom
    ivChart.dispatchAction({
        type: "dataZoom",
        start: 0,
        end: 100
    });
}

export function plotIVChart(containerId, ivPayload) {

    const { data, spot } = ivPayload

    if (!Array.isArray(data) || data.length === 0) {
        console.warn("No IV data")
        return
    }

    const chart = echarts.init(document.getElementById(containerId))

    const strikes = data.map(d => d.strike)
    const ivValues = data.map(d => d.iv)

    const option = {
        grid: { left: 50, right: 20, top: 20, bottom: 70 },

        tooltip: {
            trigger: 'axis',
            formatter: p => {
                const d = p[0]
                return `Strike: ${d.axisValue}<br>IV: ${d.data.toFixed(2)}`
            }
        },

        xAxis: {
            type: 'category',
            data: strikes,
            name: 'Strike'
        },

        yAxis: {
            type: 'value',
            name: 'IV'
        },

        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 10 }
        ],

        series: [
            {
                name: 'IV (OTM)',
                type: 'line',
                data: ivValues,
                smooth: true,
                showSymbol: false,

                // 🔥 Highlight ATM (spot)
                markLine: {
                    symbol: 'none',
                    data: [
                        { xAxis: spot }
                    ],
                    label: {
                        formatter: 'Spot'
                    }
                }
            }
        ]
    }

    chart.setOption(option)
}

export function plotIVStructure(containerId, ivData, spot) {

    if (!Array.isArray(ivData) || ivData.length < 3) {
        console.warn("Not enough IV data")
        return
    }

    const chart = echarts.init(document.getElementById(containerId))
    function computeIVStructure(ivData) {

    const gradient = []
    const curvature = []

    for (let i = 0; i < ivData.length; i++) {

        // Edge handling
        if (i === 0 || i === ivData.length - 1) {
            gradient.push(null)
            curvature.push(null)
            continue
        }

        const prev = ivData[i - 1]
        const curr = ivData[i]
        const next = ivData[i + 1]

        const dK = next.strike - prev.strike

        // 🔹 First derivative (central diff)
        const grad = (next.iv - prev.iv) / dK

        // 🔹 Second derivative (curvature)
        const curv =
            (next.iv - 2 * curr.iv + prev.iv) /
            Math.pow(next.strike - curr.strike, 2)

        gradient.push(grad)
        curvature.push(curv)
    }

    return { gradient, curvature }
}

    const { gradient, curvature } = computeIVStructure(ivData)

    const strikes = ivData.map(d => d.strike)

    const option = {
        grid: { left: 60, right: 60, top: 20, bottom: 70 },

        tooltip: { trigger: 'axis' },

        legend: {
            data: ['IV Gradient', 'IV Curvature']
        },

        xAxis: {
            type: 'category',
            data: strikes,
            name: 'Strike'
        },

        yAxis: [
            {
                type: 'value',
                name: '∂IV/∂K',
                position: 'left'
            },
            {
                type: 'value',
                name: '∂²IV/∂K²',
                position: 'right'
            }
        ],

        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],

        series: [
            {
                name: 'IV Gradient',
                type: 'line',
                data: gradient,
                smooth: true,
                yAxisIndex: 0
            },
            {
                name: 'IV Curvature',
                type: 'line',
                data: curvature,
                smooth: true,
                yAxisIndex: 1
            },
            {
                // 🔥 optional: mark spot
                type: 'line',
                markLine: {
                    symbol: 'none',
                    data: [{ xAxis: spot }],
                    label: { formatter: 'Spot' }
                }
            }
        ]
    }

    chart.setOption(option)
}