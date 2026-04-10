/**
 * ============================================================
 * 📊 Net GEX Chart Module
 * ============================================================
 *
 * Description:
 * Visualization layer for Net Gamma Exposure (GEX) data.
 * Renders real-time time-series of Net, Call, and Put GEX.
 *
 * Works on top of netGEXBuffer and updates dynamically.
 *
 * Version: 1.0.0
 * License: MIT (see LICENSE file)
 *
 * Developed by: Pallav Nandi Chaudhuri
 * ============================================================
 */


// ============================================================
// 📈 CHART INSTANCE (SINGLETON)
// ============================================================
// Holds reference to the ECharts instance.
//
// 🔥 Design:
// - Only one chart instance per panel
// - Reinitialized on panel switch
// - Shared across update calls
//
export let netGEXChart = null;



// ============================================================
// 🚀 INITIALIZE NET GEX CHART
// ============================================================
// Creates and configures the ECharts instance.
//
// 🔥 Responsibilities:
// - Bind chart to DOM container
// - Initialize layout, axes, legend
// - Prepare empty series for streaming updates
//
// 🔥 Input:
// panel → DOM element ID
//
// ⚠️ Behavior:
// - Disposes existing chart (prevents memory leaks)
// - Safe to call multiple times
//
export function initNetGEXChart(panel) {

    const el = document.getElementById(panel);
    if (!el) return;

    // Dispose existing chart instance (important for re-init)
    if (netGEXChart) netGEXChart.dispose();

    // Create new chart instance
    netGEXChart = echarts.init(el);

    // Set base configuration
    netGEXChart.setOption({

        backgroundColor: "#111",

        // --------------------------------------------------
        // 📐 LAYOUT
        // --------------------------------------------------
        grid: {
            left: 50,
            right: 20,
            top: 20,
            bottom: 80
        },

        // --------------------------------------------------
        // 🧭 TOOLTIP
        // --------------------------------------------------
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            textStyle: { color: "#fff" }
        },

        // --------------------------------------------------
        // 📊 LEGEND
        // --------------------------------------------------
        legend: {
            top: 0,
            data: ["Net GEX", "Call GEX", "Put GEX"],
            textStyle: { color: "#DDD" }
        },

        // --------------------------------------------------
        // ⏱️ X-AXIS (initial placeholder)
        // --------------------------------------------------
        xAxis: {
            type: "category",
            data: []
        },

        // --------------------------------------------------
        // 📉 Y-AXIS
        // --------------------------------------------------
        yAxis: {
            type: "value",
            scale: true
        },

        // --------------------------------------------------
        // 📈 SERIES (empty at init)
        // --------------------------------------------------
        series: [
            {
                name: "Net GEX",
                type: "line",
                data: [],
                smooth: true
            },
            {
                name: "Call GEX",
                type: "line",
                data: [],
                smooth: true
            },
            {
                name: "Put GEX",
                type: "line",
                data: [],
                smooth: true
            }
        ],

        // --------------------------------------------------
        // 🔍 ZOOM CONTROLS
        // --------------------------------------------------
        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 10 }
        ],

        // --------------------------------------------------
        // ⚡ ZERO LINE (GEX FLIP REFERENCE)
        // --------------------------------------------------
        markLine: {
            data: [{ yAxis: 0 }],
            lineStyle: { color: "#FFD700" }
        }
    });
}



// ============================================================
// 🔄 UPDATE NET GEX CHART
// ============================================================
// Updates chart using data from netGEXBuffer.
//
// 🔥 Responsibilities:
// - Extract valid data from buffer
// - Convert into ECharts-compatible format
// - Update chart efficiently
//
// 🔥 Input:
// buffer → netGEXBuffer
//
// ⚠️ Safeguards:
// - Skips update if chart not initialized
// - Skips invalid / NaN data
// - Prevents rendering empty datasets
//
export function updateNetGEXChart(buffer) {

    // Safety checks (prevents runtime crashes)
    if (!netGEXChart) return;
    if (netGEXChart.isDisposed?.()) return;
    if (!netGEXChart._model) return;

    const size = buffer.size;

    // --------------------------------------------------
    // 📊 DATA ARRAYS
    // --------------------------------------------------
    const net = [];
    const call = [];
    const put = [];

    // --------------------------------------------------
    // 🔁 EXTRACT VALID DATA FROM BUFFER
    // --------------------------------------------------
    for (let i = 0; i < size; i++) {

        const ts = buffer.timestamp[i];
        const n = buffer.net_gex[i];
        const c = buffer.call_gex[i];
        const p = buffer.put_gex[i];

        // Skip invalid / incomplete data points
        if (
            !ts ||
            n == null || c == null || p == null ||
            !isFinite(n) || !isFinite(c) || !isFinite(p)
        ) continue;

        // Push in [time, value] format for time-series plotting
        net.push([ts, n]);
        call.push([ts, c]);
        put.push([ts, p]);
    }

    // No valid data → skip update
    if (net.length === 0) return;

    // --------------------------------------------------
    // 🔄 UPDATE CHART CONFIG
    // --------------------------------------------------
    netGEXChart.setOption({

        // Switch to time-based axis for streaming data
        xAxis: {
            type: "time",
            axisLabel: {
                formatter: function (value) {
                    return new Date(value).toLocaleTimeString();
                }
            }
        },

        yAxis: {
            type: "value",
            scale: true
        },

        // --------------------------------------------------
        // 🧭 TOOLTIP FORMAT
        // --------------------------------------------------
        tooltip: {
            trigger: "axis",
            formatter: function (params) {

                const time = new Date(params[0].value[0]);

                let text = `<b>${time.toLocaleTimeString()}</b><br/><br/>`;

                params.forEach(p => {
                    text += `${p.seriesName}: ${p.value[1].toFixed(2)}<br/>`;
                });

                return text;
            }
        },

        // --------------------------------------------------
        // 📈 UPDATE SERIES DATA
        // --------------------------------------------------
        series: [
            {
                name: "Net GEX",
                type: "line",
                data: net,
                smooth: true
            },
            {
                name: "Call GEX",
                type: "line",
                data: call,
                smooth: true
            },
            {
                name: "Put GEX",
                type: "line",
                data: put,
                smooth: true
            }
        ]
    });
}