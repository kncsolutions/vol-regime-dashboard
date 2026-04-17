export let dSChart = null;

export function initdSChart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    if (dSChart) dSChart.dispose();

    dSChart = echarts.init(el);

    dSChart.setOption({
        backgroundColor: "#111",

        tooltip: { trigger: "axis" },

        legend: {
            top: 5,
            left: "center",
            data: [
                "dS_raw",
                "dS_norm",
                "dS_adj",
                "G2 Signals",
                "Zones",
                "Profile"
            ],
            textStyle: { color: "#ccc" }
        },

        // =========================
        // 🧱 DUAL GRID (MAIN + PROFILE)
        // =========================
        grid: [
            {
                left: 50,
                right: "25%",   // leave space for profile
                top: 60,
                bottom: 80
            },
            {
                right: 10,
                width: "20%",
                top: 60,
                bottom: 80
            }
        ],

        // =========================
        // 📉 X AXIS
        // =========================
        xAxis: [
            {
                type: "category",
                data: [],
                axisLine: { lineStyle: { color: "#888" } }
            },
            {
                type: "value",
                gridIndex: 1,
                show: false   // hidden for profile
            }
        ],

        // =========================
        // 📊 Y AXIS
        // =========================
        yAxis: [
            {
                type: "value",
                scale: true,
                axisLine: { lineStyle: { color: "#888" } },
                splitLine: { lineStyle: { color: "#222" } }
            },
            {
                type: "value",
                gridIndex: 1,
                show: false   // shared visually
            }
        ],

        // =========================
        // 📈 SERIES
        // =========================
        series: [
            {
                name: "dS_raw",
                type: "line",
                data: [],
                smooth: false,
                lineStyle: { width: 1, opacity: 0.4 }
            },
            {
                name: "dS_norm",
                type: "line",
                data: [],
                smooth: true,
                lineStyle: { width: 2 }
            },
            {
                name: "dS_adj",
                type: "line",
                data: [],
                smooth: true,
                lineStyle: { width: 2 }
            },
            {
                name: "G2 Signals",
                type: "scatter",
                data: [],
                symbol: "circle",
                symbolSize: 8,
                z: 10
            },
            {
                name: "Zones",
                type: "scatter",
                data: [],
                symbol: "circle",
                symbolSize: 10,
                z: 11
            },

            // =========================
            // 📊 HORIZONTAL PROFILE
            // =========================
            {
                name: "Profile",
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: [],
                barWidth: "80%",
                itemStyle: {
                    color: "#888",
                    opacity: 0.5
                },
                z: 1
            }
        ],

        // =========================
        // 🔍 ZOOM
        // =========================
        dataZoom: [
            { type: "inside" },
            {
                type: "slider",
                height: 25,
                bottom: 30
            }
        ]
    });
}
const ROLLING_WINDOW = 200;

export function updatedSChart(buffer) {
    if (!dSChart || dSChart.isDisposed?.()) return;
    if (!buffer?.data?.length) return;

    const x = [];
    const raw = [];
    const norm = [];
    const adj = [];

    const g2Markers = [];
    const zoneMarkers = [];

    // =========================
    // BUILD SERIES
    // =========================
    for (let i = 0; i < buffer.data.length; i++) {
        const d = buffer.data[i];

        if (!d || d.raw == null || d.norm == null || d.adj == null || isNaN(d.adj)) continue;

        x.push(d.time);
        raw.push(d.raw);
        norm.push(d.norm);
        adj.push(d.adj);

        if (d.G2 === "STRONG") {
            g2Markers.push({ value: [i, d.adj], itemStyle: { color: "#FFD700" } });
        }

        if (d.zone === "TRAP") {
            zoneMarkers.push({ value: [i, d.adj], itemStyle: { color: "#ff4d4f" } });
        }

        if (d.zone === "BREAKOUT") {
            zoneMarkers.push({ value: [i, d.adj], itemStyle: { color: "#00ff9c" } });
        }
    }

    const n = adj.length;
    if (n === 0) return;

    // =========================
    // ROLLING WINDOW
    // =========================
    const windowSize = Math.min(n, ROLLING_WINDOW);
    const start = n - windowSize;
    const windowData = adj.slice(start);

    // =========================
    // STATS
    // =========================
    let mean = 0;
    let sd = 0;

    if (windowData.length >= 2) {
        mean = windowData.reduce((a, b) => a + b, 0) / windowData.length;

        const variance =
            windowData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / windowData.length;

        sd = Math.sqrt(variance);
    }

    // =========================
    // HISTOGRAM + VALUE AREA
    // =========================
    let profileData = [];
    let VAL = null, VAH = null, POC = null;

    if (windowData.length >= 5) {
        const bins = Math.min(30, Math.floor(windowData.length / 2));
        const min = Math.min(...windowData);
        const max = Math.max(...windowData);

        if (max !== min) {
            const binSize = (max - min) / bins;
            const hist = new Array(bins).fill(0);

            for (let v of windowData) {
                let idx = Math.floor((v - min) / binSize);
                idx = Math.max(0, Math.min(bins - 1, idx));
                hist[idx]++;
            }

            const total = hist.reduce((a, b) => a + b, 0);

            // POC
            let pocIndex = hist.indexOf(Math.max(...hist));

            let left = pocIndex;
            let right = pocIndex;
            let acc = hist[pocIndex];

            while (acc / total < 0.7) {
                const leftVal = left > 0 ? hist[left - 1] : -1;
                const rightVal = right < bins - 1 ? hist[right + 1] : -1;

                if (rightVal > leftVal) {
                    right++;
                    acc += rightVal;
                } else {
                    left--;
                    acc += leftVal;
                }

                if (left <= 0 && right >= bins - 1) break;
            }

            VAL = min + left * binSize;
            VAH = min + (right + 1) * binSize;
            POC = min + (pocIndex + 0.5) * binSize;

            const maxCount = Math.max(...hist);

            for (let i = 0; i < bins; i++) {
                const y = min + (i + 0.5) * binSize;
                const density = hist[i] / maxCount;
                profileData.push([density, y]);
            }
        }
    }

    // =========================
    // SIGNAL FREQUENCY (ROLLING)
    // =========================
    let g2Count = 0, trapCount = 0, breakoutCount = 0;

    for (let i = start; i < buffer.data.length; i++) {
        const d = buffer.data[i];
        if (!d) continue;

        if (d.G2 === "STRONG") g2Count++;
        if (d.zone === "TRAP") trapCount++;
        if (d.zone === "BREAKOUT") breakoutCount++;
    }

    const windowLen = buffer.data.length - start;

    const g2Freq = windowLen ? g2Count / windowLen : 0;
    const trapFreq = windowLen ? trapCount / windowLen : 0;
    const breakoutFreq = windowLen ? breakoutCount / windowLen : 0;

    const freqText = `
{g2|G2: ${(g2Freq * 100).toFixed(1)}%}
{trap|TRAP: ${(trapFreq * 100).toFixed(1)}%}
{brk|BRK: ${(breakoutFreq * 100).toFixed(1)}%}
`;

    // =========================
    // AXIS RANGE
    // =========================
    const yMin = Math.min(...adj);
    const yMax = Math.max(...adj);

    // =========================
    // MARKERS
    // =========================
    let markLine = null;
    let markArea = [];

    if (sd > 0 && isFinite(sd)) {
        markLine = {
            symbol: "none",
            lineStyle: { type: "dashed", opacity: 0.6 },
            data: [{ yAxis: mean }]
        };

        markArea.push(
            [{ yAxis: mean - sd }, { yAxis: mean + sd }],
            [{ yAxis: mean - 2 * sd }, { yAxis: mean + 2 * sd }],
            [{ yAxis: mean - 3 * sd }, { yAxis: mean + 3 * sd }]
        );
    }

    if (VAL !== null && VAH !== null) {
        markArea.unshift([{ yAxis: VAL }, { yAxis: VAH }]);
    }

    if (POC !== null) {
        if (!markLine) markLine = { symbol: "none", data: [] };
        markLine.data.push({
            yAxis: POC,
            lineStyle: { color: "#00e5ff", width: 2 }
        });
    }
    if (VAL !== null) {
        if (!markLine) markLine = { symbol: "none", data: [] };
        markLine.data.push({
            yAxis: VAL,
            lineStyle: { color: "#00e5ff", width: 2 }
        });
    }
    if (VAH !== null) {
        if (!markLine) markLine = { symbol: "none", data: [] };
        markLine.data.push({
            yAxis: VAH,
            lineStyle: { color: "#00e5ff", width: 2 }
        });
    }

    // =========================
    // UPDATE CHART
    // =========================
    dSChart.setOption({
        xAxis: [{ data: x }, {}],

        yAxis: [
            { min: yMin, max: yMax },
            { min: yMin, max: yMax }
        ],

        series: [
            { name: "dS_raw", data: raw },
            { name: "dS_norm", data: norm },
            {
                name: "dS_adj",
                data: adj,
                ...(markLine && { markLine }),
                ...(markArea.length && {
                    markArea: {
                        silent: true,
                        data: markArea,
                        itemStyle: { opacity: 0.08 }
                    }
                })
            },
            { name: "G2 Signals", data: g2Markers },
            { name: "Zones", data: zoneMarkers },
            { name: "Profile", data: profileData }
        ],

        graphic: [
            {
                type: "text",
                right: 20,
                top: 70,
                style: {
                    rich: {
                        g2: { fill: "#FFD700" },
                        trap: { fill: "#ff4d4f" },
                        brk: { fill: "#00ff9c" }
                    },
                    text: freqText,
                    font: "12px monospace",
                    lineHeight: 18
                }
            }
        ]
    });
}