export let microChart = null;
export function initMicroChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (microChart) microChart.dispose();

    microChart = echarts.init(el);

    microChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },

        legend: { data: ["Microprice", "LTP"] },

        xAxis: { type: "category", data: [] },
        yAxis: { type: "value", scale: true },

        series: [
            { name: "Microprice", type: "line", data: [], smooth: true },
            { name: "LTP", type: "line", data: [], smooth: true }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
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
                `;
            }
        },

        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ]
    });
}