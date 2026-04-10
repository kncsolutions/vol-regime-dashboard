export let rrpChart = null;
export function initRRPChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (rrpChart) rrpChart.dispose();

    rrpChart = echarts.init(el);

    rrpChart.setOption({
        backgroundColor: "#111",

        grid: {
            left: 40,
            right: 20,
            top: 20,
            bottom: 80   // ✅ REQUIRED
        },

        tooltip: { trigger: "axis" },

        xAxis: {
            type: "category",
            data: []
        },

        yAxis: {
            type: "value",
            min: 0,
            max: 1
        },

        series: [{
            name: "RRP",
            type: "line",
            data: [],
            smooth: true
        }],

        dataZoom: [
            {
                type: 'inside'
            },
            {
                type: 'slider',
                height: 25,
                bottom: 10   // inside grid now
            }
        ]
    });
}

export function renderRRP(series) {
    if (!rrpChart) return;
    if (rrpChart.isDisposed?.()) return;
    if (!rrpChart._model) return;

    if (!Array.isArray(series) || series.length === 0) return;

    const x = [];
    const y = [];

    for (let i = 0; i < series.length; i++) {
        const t = series[i]?.time;
        const v = series[i]?.value;

        // 🔥 HARD FILTER
        if (!isFinite(v) || v == null) continue;

        x.push(i);        // OR use time (see below)
        y.push(v);
    }

    // 🚨 MUST MATCH
    if (x.length === 0 || x.length !== y.length) return;

    rrpChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",
            min: 0,
            max: 1
        },
        // ✅ TOOLTIP (UPGRADED)
        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: "cross"
            },
            backgroundColor: "#222",
            borderColor: "#555",
            textStyle: {
                color: "#fff"
            },
            formatter: function (params) {
                const p = params[0];

                const value = p.data;
                const idx = p.dataIndex;

                return `
                    <b>Index:</b> ${idx}<br/>
                    <b>RRP:</b> ${value.toFixed(4)}
                `;
            }
        },
        series: [{
            name: "RRP",
            type: "line",
            data: y,
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}