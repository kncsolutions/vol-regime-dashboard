export let lbaChart = null;
export function initLBAChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (lbaChart) lbaChart.dispose();

    lbaChart = echarts.init(el);

    lbaChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },

        legend: { data: ["LTP", "Bid", "Ask"] },

        xAxis: { type: "category", data: [] },
        yAxis: { type: "value", scale: true },

        series: [
            { name: "LTP", type: "line", data: [], smooth: true },
            { name: "Bid", type: "line", data: [], smooth: true },
            { name: "Ask", type: "line", data: [], smooth: true }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}
export function updateLBAChart(marketBuffer) {
    if (!lbaChart) return;
    if (lbaChart.isDisposed?.()) return;
    if (!lbaChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 10) return;

    const x = [];
    const ltp = [];
    const bid = [];
    const ask = [];

    for (let i = 0; i < len; i++) {
        const l = marketBuffer.ltp[i];
        const b = marketBuffer.bid[i];
        const a = marketBuffer.ask[i];

        // 🔥 HARD FILTER (ALL SERIES MUST BE VALID TOGETHER)
        if (
            l == null || b == null || a == null ||
            !isFinite(l) || !isFinite(b) || !isFinite(a)
        ) continue;

        x.push(i);
        ltp.push(l);
        bid.push(b);
        ask.push(a);
    }

    // 🚨 CRITICAL: ALL SERIES MUST MATCH LENGTH
    if (
        x.length === 0 ||
        x.length !== ltp.length ||
        x.length !== bid.length ||
        x.length !== ask.length
    ) return;

    lbaChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",
            scale: true
        },
         // ✅ LEGEND
        legend: {
            data: ["LTP", "Best Bid", "Best Ask"],
            top: 10,
            textStyle: {
                color: "#DDD"
            }
        },
         // ✅ TOOLTIP (VERY IMPORTANT)
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
                let output = "";

                params.forEach(p => {
                    const name = p.seriesName;
                    const value = p.data;

                    output += `<b>${name}:</b> ${value?.toFixed?.(2) ?? value}<br/>`;
                });

                return output;
            }
        },
        series: [
            { name: "LTP", type: "line", data: ltp },
            { name: "Bid", type: "line", data: bid },
            { name: "Ask", type: "line", data: ask }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}