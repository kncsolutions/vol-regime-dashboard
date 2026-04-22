// ======================================
// ⏱️ TimeToMove Chart
// ======================================

export let timeToMoveChart = null;

const buffer = {
    time: [],
    timeToMove: [],
    velocity: [],
    max: 300
};

// -----------------------------
// INIT
// -----------------------------
export function initTimeToMoveChart(panelId, timeUnit = "bars") {

    const el = document.getElementById(panelId);
    if (!el) return;

    if (timeToMoveChart) {
        timeToMoveChart.dispose();
    }

    timeToMoveChart = echarts.init(el);

    timeToMoveChart.setOption({
        backgroundColor: "#111",

        tooltip: {
            trigger: "axis",
            formatter: function (params) {
                const t = params[0].axisValue;

                const timeVal = params[0].data;
                const velocityVal = params[1].data;

                return `
                    Time: ${t}<br/>
                    ⏱️ TimeToMove: ${timeVal?.toFixed(2)} ${window.TIME_UNIT || "bars"}<br/>
                    ⚡ Velocity: ${velocityVal?.toFixed(4)} pts/${window.TIME_UNIT || "unit"}
                `;
            }
        },

        legend: {
            data: ["TimeToMove", "Velocity"],
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
        name: `Time (${timeUnit})`,
        axisLabel: { color: "#aaa" }
            },
            {
                type: "value",
                name: "Velocity (pts/unit)",
                axisLabel: { color: "#aaa" }
            }
        ],

        series: [
            {
                name: "TimeToMove",
                type: "line",
                data: [],
                smooth: true
            },
            {
                name: "Velocity",
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
export function updateTimeToMoveChart({
    timeToMove,
    velocity,
    timestamp
}) {

    if (!timeToMoveChart) return;

    const t = timestamp || Date.now();

    buffer.time.push(t);
    buffer.timeToMove.push(timeToMove);
    buffer.velocity.push(velocity);

    // rolling window
    if (buffer.time.length > buffer.max) {
        buffer.time.shift();
        buffer.timeToMove.shift();
        buffer.velocity.shift();
    }

    timeToMoveChart.setOption({
        xAxis: {
            data: buffer.time
        },
        series: [
            {
                data: buffer.timeToMove
            },
            {
                data: buffer.velocity
            }
        ]
    });
}

// -----------------------------
// RESET
// -----------------------------
export function resetTimeToMoveChart() {

    buffer.time = [];
    buffer.timeToMove = [];
    buffer.velocity = [];

    if (timeToMoveChart) {
        timeToMoveChart.clear();
    }
}