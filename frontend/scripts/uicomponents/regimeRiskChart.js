export let regimeRiskChart = null;

export function initRegimeRiskChart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    if (regimeRiskChart) regimeRiskChart.dispose();

    regimeRiskChart = echarts.init(el);

    regimeRiskChart.setOption({
        backgroundColor: "#111",

        tooltip: { trigger: "axis" },

        legend: {
            top:0,
            data: ["TOXIC", "TREND", "MEAN_REVERT", "Impact Risk"],
            textStyle: { color: "#ccc" }
        },

        xAxis: {
            type: "category",
            data: [],
            axisLine: { lineStyle: { color: "#555" } }
        },

        yAxis: {
            type: "value",
            min: 0,
            max: 1,
            axisLine: { lineStyle: { color: "#555" } },
            splitLine: { lineStyle: { color: "#222" } }
        },

        series: [
            {
                name: "TOXIC",
                type: "line",
                smooth: true,
                data: [],
                lineStyle: { color: "#ff4d4f", width: 2 },
                markLine: {
                    symbol: "none",
                    label: { color: "#aaa" },
                    lineStyle: { color: "#888", type: "dashed" },
                    data: [
                        { yAxis: 0.7, name: "Danger" },
                        { yAxis: 0.4, name: "Safe" }
                    ]
                }
            },
            {
                name: "TREND",
                type: "line",
                smooth: true,
                data: [],
                lineStyle: { color: "#00ff9c", width: 2 }
            },
            {
                name: "MEAN_REVERT",
                type: "line",
                smooth: true,
                data: [],
                lineStyle: { color: "#3399ff", width: 2 }
            },
            {
                name: "Impact Risk",
                type: "line",
                smooth: true,
                data: [],
                lineStyle: { color: "#ffaa00", width: 3 },
                emphasis: { focus: "series" }
            }
        ],

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 30 }
        ]
    });
}

export function updateRegimeRiskChart(probs, impactRisk, timestamp) {
    if (!regimeRiskChart || regimeRiskChart.isDisposed?.()) return;
    if (!probs) return;

    const option = regimeRiskChart.getOption();

    const time = new Date(timestamp).toLocaleTimeString();

    option.xAxis[0].data.push(time);

    // ✅ correct mapping
    option.series[0].data.push(probs.TOXIC || 0);
    option.series[1].data.push(probs.TREND || 0);
    option.series[2].data.push(probs.MEAN_REVERT || 0);  // 🔥 FIX
    option.series[3].data.push(impactRisk || 0);         // 🔥 FIX

    // 🔥 fixed window
    const maxPoints = 200;

    if (option.xAxis[0].data.length > maxPoints) {
        option.xAxis[0].data.shift();
        option.series.forEach(s => s.data.shift());
    }

    regimeRiskChart.setOption(option);
}

export function resetRegimeRiskChart(panelId) {

    if (regimeRiskChart) {
        regimeRiskChart.dispose();
        regimeRiskChart = null;
    }

    initRegimeRiskChart(panelId);
}