export let gexGradientChart = null;

export function initGEXGradientChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (gexGradientChart) {
        gexGradientChart.dispose();
    }

    gexGradientChart = echarts.init(el);

    const option = {
        backgroundColor: "#111",
        grid: {
            left: 50,
            right: 20,
            top: 10,
            bottom: 30
        },
        xAxis: {
            type: "value",
            name: "Gradient",
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },
        yAxis: {
            type: "value",
            name: "Strike",
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },
        series: [{
            type: "bar",
            data: []
        }]
    };

    gexGradientChart.setOption(option);
}
export function renderGEXGradientEChart(gexGradient, currentSpot) {

    if (!gexGradientChart || !gexGradient) return;

    const spot = currentSpot;

    // 🔹 Step 1: filter
    const range = currentSpot * 0.20; // 3%

        const filtered = gexGradient.filter(v =>
            !spot || Math.abs(v.strike - spot) <= range
        );


    // 🔹 Step 2: sort
    filtered.sort((a, b) => a.strike - b.strike);

    // 🔹 Step 3: x-axis (strikes)
    const strikes = filtered.map(g => g.strike);

    // ✅ Step 4: REPLACE gradients with styled data
    const data = filtered.map(g => ({
        value: g.gradient,
        itemStyle: {
            color: g.gradient > 0 ? "#00bfff" : "#ff0066"
        }
    }));

    // 🔹 Step 5: render
    gexGradientChart.setOption({
        xAxis: {
            type: "category",
            data: strikes
        },
        yAxis: {
            type: "value"
        },
        series: [{
            type: "line",
            data: data,
            smooth: true,
            areaStyle: { opacity: 0.2 },
            lineStyle: { width: 2 },

            markLine: {
                data: [{ yAxis: 0 }],
                lineStyle: {
                    color: "#FFD700"
                }
            },
        }],
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
                    const p = params[0];  // single series

                    const strike = p.axisValue;
                    const gradient = p.data.value;

                    return `
                        <b>Strike:</b> ${strike}<br/>
                        <b>Gradient:</b> ${gradient.toFixed(2)}
                    `;
                }
            },
           grid: {
          left: 40,
          right: 20,
          top: 20,
          bottom: 80   // 👈 increase this
        },
        dataZoom: [{type: "inside"}, {type: "slider",height: 30,
    bottom: 10 } ]
    });
}