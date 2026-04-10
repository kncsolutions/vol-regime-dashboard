export let alphaChart = null;
export function initAlphaChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (alphaChart) alphaChart.dispose();

    alphaChart = echarts.init(el);

    alphaChart.setOption({
        backgroundColor: "#111",
        grid: { left: 40, right: 20, top: 20, bottom: 30 },

        tooltip: { trigger: "axis" },

        xAxis: {
            type: "category",
            data: []
        },

        yAxis: {
            type: "value"
        },

        series: [{
            name: "Alpha",
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

export function updateAlphaChart(marketBuffer) {
    if (!alphaChart) return;

    // 🔥 CRITICAL FIX
    if (alphaChart.isDisposed?.()) return;

    // 🔥 ADD THIS (VERY IMPORTANT)
    if (!alphaChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 20) return;

    const x = Array.from({ length: len }, (_, i) => i);
    function computeAlphaSeries() {
            const size = marketBuffer.size;
            const len = marketBuffer.filled ? size : marketBuffer.index;

            const alpha = [];

            for (let i = 0; i < len; i++) {

                const micro = marketBuffer.microprice[i];
                const prev = i > 10 ? marketBuffer.microprice[i - 10] : micro;

                const trend = micro - prev;
                const imbalance = marketBuffer.imbalance[i] || 0;

                // 🔥 SCALE IT
                const signal = (0.6 * trend + 0.4 * imbalance) * 1000;

                alpha.push(signal);
            }

            return alpha;
    }
    const alphaSeries = computeAlphaSeries();

    alphaChart.setOption({
        xAxis: { type: "category", data: x },
        yAxis: { type: "value" },
        series: [{
            name: "Alpha",
            type: "line",
            data: alphaSeries,
            smooth: true
        }],
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
                    <b>Alpha:</b> ${value.toFixed(4)}
                `;
            }
        },
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}