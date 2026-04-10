export let flowChart = null;
export function initFlowChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (flowChart) flowChart.dispose();

    flowChart = echarts.init(el);

    flowChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },

        xAxis: { type: "category", data: [] },

        yAxis: {
            type: "value",

        },

        series: [{
            name: "Flow",
            type: "line",
            data: [],
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}
export function updateFlowChart(marketBuffer) {
    if (!flowChart) return;
    if (flowChart.isDisposed?.()) return;
    if (!flowChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 10) return;

    const x = [];
    const data = [];

    for (let i = 0; i < len; i++) {
        const v = marketBuffer.flow[i];

        // 🔥 HARD FILTER (CRITICAL)
        if (v == null || isNaN(v) || !isFinite(v)) continue;

        x.push(i);
        data.push(v);
    }

    // 🚨 MUST match lengths
    if (data.length === 0 || x.length !== data.length) return;

    flowChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",

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
                    <b>Flow:</b> ${value.toFixed(4)}
                `;
            }
        },
        series: [{
            name: "Flow",
            type: "line",
            data: data,
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}