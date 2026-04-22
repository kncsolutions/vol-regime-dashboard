// ======================================
// 📈 Expected Move + Lambda Chart
// ======================================

export let expectedMoveChart = null;

const buffer = {
    time: [],
    expectedMove: [],
    lambda: [],
    max: 300
};

// -----------------------------
// INIT
// -----------------------------
export function initExpectedMoveChart(panelId) {

    const el = document.getElementById(panelId);
    if (!el) return;

    if (expectedMoveChart) {
        expectedMoveChart.dispose();
    }

    expectedMoveChart = echarts.init(el);

    expectedMoveChart.setOption({
        backgroundColor: "#111",

        tooltip: { trigger: "axis" },

        legend: {
            data: ["ExpectedMove", "Lambda"],
            textStyle: { color: "#ccc" }
        },

        xAxis: {
            type: "category",
            data: [],
            axisLabel: { color: "#aaa" }
        },

        yAxis: [
            {
                type: "value",
                name: "Expected Move",
                axisLabel: { color: "#aaa" }
            },
            {
                type: "value",
                name: "Lambda",
                axisLabel: { color: "#aaa" }
            }
        ],

        series: [
            {
                name: "ExpectedMove",
                type: "line",
                data: [],
                smooth: true
            },
            {
                name: "Lambda",
                type: "line",
                yAxisIndex: 1,
                data: [],
                smooth: true
            }
        ]
    });
}

// -----------------------------
// UPDATE
// -----------------------------
export function updateExpectedMoveChart({
    expectedMove,
    lambda,
    timestamp
}) {

    if (!expectedMoveChart) return;

    const t = timestamp || Date.now();

    buffer.time.push(t);
    buffer.expectedMove.push(expectedMove);
    buffer.lambda.push(lambda);

    // maintain rolling window
    if (buffer.time.length > buffer.max) {
        buffer.time.shift();
        buffer.expectedMove.shift();
        buffer.lambda.shift();
    }

    expectedMoveChart.setOption({
        xAxis: {
            data: buffer.time
        },
        series: [
            {
                data: buffer.expectedMove
            },
            {
                data: buffer.lambda
            }
        ]
    });
}

// -----------------------------
// RESET
// -----------------------------
export function resetExpectedMoveChart() {
    buffer.time = [];
    buffer.expectedMove = [];
    buffer.lambda = [];

    if (expectedMoveChart) {
        expectedMoveChart.clear();
    }
}