export let I1Chart = null;

export function initI1Chart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (I1Chart) I1Chart.dispose();

    I1Chart = echarts.init(el);

    I1Chart.setOption({
        backgroundColor: "#111",

        legend: {
            data: ["I1 Raw", "I1 Smoothed"],
            textStyle: { color: "#ccc" }
        },

        tooltip: { trigger: "axis" },

        xAxis: { type: "category", data: [] },

        yAxis: {
            type: "value",
            scale: true
        },

        series: [
            {
                name: "I1 Raw",
                type: "line",
                data: [],
                smooth: false,
                showSymbol: false,
                lineStyle: { width: 1, opacity: 0.4 } // 👈 faint
            },
            {
                name: "I1 Smoothed",
                type: "line",
                data: [],
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2 } // 👈 dominant
            }
        ],

        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}

function smoothEMA(data, alpha = 0.2) {
    const result = [];
    let prev = data[0];

    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (val == null || !isFinite(val)) {
            result.push(null);
            continue;
        }

        prev = alpha * val + (1 - alpha) * prev;
        result.push(prev);
    }

    return result;
}

export function updateI1Chart(I1Buffer) {

    if (!I1Chart || I1Chart.isDisposed?.()) return;

    const len = I1Buffer.data.length;
    if (len < 10) return;

    const raw = [];
    const x = [];

    for (let i = 0; i < len; i++) {
        const val = I1Buffer.data[i];

        if (val == null || !isFinite(val)) {
            raw.push(null);
        } else {
            raw.push(val);
        }

        x.push(i); // 🔥 always push index (no mismatch)
    }

    // 🔥 Smooth entire series (aligned)
    const smoothed = smoothEMA(raw, 0.2);

    I1Chart.setOption({
        xAxis: { data: x },

        series: [
            {
                name: "I1 Raw",
                data: raw
            },
            {
                name: "I1 Smoothed",
                data: smoothed,

                markLine: {
                    silent: true,
                    lineStyle: { color: "#888", type: "dashed" },
                    data: [
                        { yAxis: 0 },
                        { yAxis: 0.1 },
                        { yAxis: -0.1 }
                    ]
                }
            }
        ],

        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            borderColor: "#555",
            textStyle: { color: "#fff" },

            formatter: function (params) {
                let out = `<b>Index:</b> ${params[0]?.dataIndex}<br/>`;

                params.forEach(p => {
                    if (p.data != null && isFinite(p.data)) {
                        out += `<b>${p.seriesName}:</b> ${p.data.toFixed(4)}<br/>`;
                    }
                });

                return out;
            }
        }
    });
}