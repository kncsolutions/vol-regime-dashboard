export let microChart = null;

export function initMicroChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (microChart) microChart.dispose();

    microChart = echarts.init(el);

    microChart.setOption({
        backgroundColor: "#111",

        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" }
        },

        legend: {
            top: 5,
            data: [
                "Microprice", "LTP",
                "Micro +1σ", "Micro -1σ",
                "LTP +1σ", "LTP -1σ"
            ]
        },

        xAxis: {
            type: "category",
            data: []
        },

        yAxis: {
            type: "value",
            scale: true
        },

        series: [
            // 🔵 Core price
            {
                name: "Microprice",
                type: "line",
                data: [],
                smooth: true
            },
            {
                name: "LTP",
                type: "line",
                data: [],
                smooth: true
            },

            // 🔵 Micro bands
            {
                name: "Micro +1σ",
                type: "line",
                data: [],
                lineStyle: { type: "dashed", opacity: 0.6 },
                symbol: "none"
            },
            {
                name: "Micro -1σ",
                type: "line",
                data: [],
                lineStyle: { type: "dashed", opacity: 0.6 },
                symbol: "none"
            },

            // 🟠 LTP bands
            {
                name: "LTP +1σ",
                type: "line",
                data: [],
                lineStyle: { type: "dotted", opacity: 0.6 },
                symbol: "none"
            },
            {
                name: "LTP -1σ",
                type: "line",
                data: [],
                lineStyle: { type: "dotted", opacity: 0.6 },
                symbol: "none"
            }
        ],

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 30 }
        ]
    });
}


export function updateMicroChart(marketBuffer) {
    if (!microChart || microChart.isDisposed?.()) return;
    if (!microChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 10) return;

    const x = [];
    const micro = [];
    const ltp = [];

    for (let i = 0; i < len; i++) {
        const m = marketBuffer.microprice[i];
        const l = marketBuffer.ltp[i];

        // 🔥 STRICT VALIDATION
        if (
            m == null || l == null ||
            !isFinite(m) || !isFinite(l)
        ) continue;

        x.push(i);
        micro.push(m);
        ltp.push(l);
    }

    // 🚨 HARD CHECK (CRITICAL)
    if (
        x.length === 0 ||
        x.length !== micro.length ||
        x.length !== ltp.length
    ) return;

    const microStats = computeStats(micro, 200);
    const ltpStats   = computeStats(ltp, 200);

    let microUpper = [], microLower = [];
    let ltpUpper = [], ltpLower = [];

    if (microStats) {
        const u = microStats.mean + microStats.sd;
        const l = microStats.mean - microStats.sd;

        microUpper = micro.map(() => u);
        microLower = micro.map(() => l);
    }

    if (ltpStats) {
        const u = ltpStats.mean + ltpStats.sd;
        const l = ltpStats.mean - ltpStats.sd;

        ltpUpper = ltp.map(() => u);
        ltpLower = ltp.map(() => l);
    }

    microChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",
            scale: true   // 🔥 THIS is the key
        },
        series: [
            {
                name: "Microprice",
                type: "line",
                data: micro,
                smooth: true
            },
            {
                name: "LTP",
                type: "line",
                data: ltp,
                smooth: true
            },
             // 🔵 Microprice 1SD bands
            {
                name: "Micro +1σ",
                type: "line",
                data: microUpper,
                lineStyle: { type: "dashed", opacity: 0.6 },
                symbol: "none"
            },
            {
                name: "Micro -1σ",
                type: "line",
                data: microLower,
                lineStyle: { type: "dashed", opacity: 0.6 },
                symbol: "none"
            },

            // 🟠 LTP 1SD bands
            {
                name: "LTP +1σ",
                type: "line",
                data: ltpUpper,
                lineStyle: { type: "dotted", opacity: 0.6 },
                symbol: "none"
            },
            {
                name: "LTP -1σ",
                type: "line",
                data: ltpLower,
                lineStyle: { type: "dotted", opacity: 0.6 },
                symbol: "none"
            }
        ],

        // ✅ FIXED TOOLTIP (IMPORTANT)
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            borderColor: "#555",
            textStyle: { color: "#fff" },
            formatter: function (params) {

                let microVal = null;
                let ltpVal = null;

                params.forEach(p => {
                    if (p.seriesName === "Microprice") microVal = p.data;
                    if (p.seriesName === "LTP") ltpVal = p.data;
                });

                return `
                    <b>Index:</b> ${params[0].dataIndex}<br/>
                    <b>Micro:</b> ${microVal?.toFixed(2)}<br/>
                    <b>LTP:</b> ${ltpVal?.toFixed(2)}
                    <b>Micro μ:</b> ${microStats?.mean.toFixed(2)} |
                    <b>σ:</b> ${microStats?.sd.toFixed(2)}<br/>
                    <b>LTP μ:</b> ${ltpStats?.mean.toFixed(2)} |
                    <b>σ:</b> ${ltpStats?.sd.toFixed(2)}
                `;
            }
        },

        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ]
    });
}

function computeStats(arr, window = 200) {
    const len = arr.length;
    if (len < 2) return null;

    const start = Math.max(0, len - window);
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let i = start; i < len; i++) {
        const v = arr[i];
        if (v == null || !isFinite(v)) continue;

        sum += v;
        sumSq += v * v;
        count++;
    }

    if (count < 2) return null;

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    const sd = Math.sqrt(Math.max(variance, 0));

    return { mean, sd };
}