export let reachProbChart = null;
export function initReachProbChart(domId) {
    const el = document.getElementById(domId);
    if (!el) return;

    reachProbChart = echarts.init(el);

    const option = {
        animation: false,

        grid: {
            left: 50,
            right: 20,
            top: 30,
            bottom: 40
        },

        xAxis: {
            type: "category",
            name: "Strike",
            data: [],
            axisLabel: {
                color: "#aaa"
            }
        },

        yAxis: {
            type: "value",
            name: "Probability",
            min: 0,
            max: 1,
            axisLabel: {
                color: "#aaa"
            },
            splitLine: {
                lineStyle: { color: "#222" }
            }
        },

        series: [
            {
                name: "Reach Probability",
                type: "line",
                data: [],
                smooth: true,
                showSymbol: false,
                lineStyle: {
                    width: 2
                },
                areaStyle: {
                    opacity: 0.15
                }
            }
        ],

        tooltip: {
            trigger: "axis"
        }
    };

    reachProbChart.setOption(option);
}

export function updateReachProbChart(reachProbMap, spot = null) {
    if (!reachProbChart) return;

    if (!reachProbMap || Object.keys(reachProbMap).length === 0) {
        reachProbChart.setOption({
            xAxis: { data: [] },
            series: [{ data: [] }]
        });
        return;
    }

    // -------------------------
    // Prepare sorted data
    // -------------------------
    const strikes = Object.keys(reachProbMap)
        .map(Number)
        .sort((a, b) => a - b);

    const probs = strikes.map(k => reachProbMap[k]);

    // -------------------------
    // Spot marker (vertical line)
    // -------------------------
    let markLine = {};

    if (spot != null) {
        markLine = {
            data: [
                {
                    xAxis: spot,
                    lineStyle: {
                        color: "#ffcc00",
                        width: 1.5
                    },
                    label: {
                        formatter: "Spot",
                        color: "#ffcc00"
                    }
                }
            ]
        };
    }

    // -------------------------
    // Update chart
    // -------------------------
    reachProbChart.setOption({
        xAxis: {
            data: strikes
        },
        series: [
            {
                data: probs,
                markLine
            }
        ]
    });
}