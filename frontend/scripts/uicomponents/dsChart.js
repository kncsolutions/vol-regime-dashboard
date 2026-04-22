export let dSChart = null;

/**
 * ----------------------------------------
 * INIT
 * ----------------------------------------
 */
export function initdSChart(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;

    if (dSChart) dSChart.dispose();

    dSChart = echarts.init(el);

    dSChart.setOption({
        backgroundColor: "#111",

        tooltip: { trigger: "axis" },

        legend: {
            top: 0,
            left: "center",
            data: ["dS_raw", "dS_norm", "dS_adj", "G2 Signals", "Zones", "Profile"],
            textStyle: { color: "#ccc" }
        },

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 30 }
        ]
    });
}

/**
 * ----------------------------------------
 * FLOW-STYLE PROFILE BUILDER
 * ----------------------------------------
 */
function buildDSProfile(dsArray, bins = 40) {
    const clean = dsArray.filter(v => v != null && isFinite(v));
    if (clean.length < 20) return null;

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    if (min === max) return null;

    const step = (max - min) / bins;

    const hist = new Array(bins).fill(0);
    const prices = [];

    for (let i = 0; i < bins; i++) {
        prices.push(min + i * step);
    }

    for (let v of clean) {
        const idx = Math.min(
            bins - 1,
            Math.floor((v - min) / step)
        );
        hist[idx]++;
    }

    return { hist, prices, min, step };
}

/**
 * ----------------------------------------
 * VALUE AREA (SAME AS FLOW)
 * ----------------------------------------
 */
function computeValueArea(dsArray, bins = 50, valueAreaPercent = 0.7) {
    if (!dsArray || dsArray.length < 20) return null;

    const clean = dsArray.filter(v => v != null && isFinite(v));
    if (clean.length < 20) return null;

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    if (min === max) return null;

    const step = (max - min) / bins;
    const hist = new Array(bins).fill(0);

    for (let v of clean) {
        const idx = Math.min(bins - 1, Math.floor((v - min) / step));
        hist[idx]++;
    }

    const total = clean.length;

    let pocIndex = 0;
    let maxCount = 0;

    for (let i = 0; i < bins; i++) {
        if (hist[i] > maxCount) {
            maxCount = hist[i];
            pocIndex = i;
        }
    }

    let left = pocIndex;
    let right = pocIndex;
    let accumulated = hist[pocIndex];

    while (accumulated / total < valueAreaPercent) {
        const leftVal = left > 0 ? hist[left - 1] : -1;
        const rightVal = right < bins - 1 ? hist[right + 1] : -1;

        if (rightVal > leftVal) {
            right++;
            accumulated += rightVal;
        } else {
            left--;
            accumulated += leftVal;
        }

        if (left <= 0 && right >= bins - 1) break;
    }

    return {
        poc: min + pocIndex * step,
        vah: min + right * step,
        val: min + left * step
    };
}

/**
 * ----------------------------------------
 * UPDATE
 * ----------------------------------------
 */
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

    // ---------------------------
    // BUILD SERIES
    // ---------------------------
    for (let i = 0; i < buffer.data.length; i++) {
        const d = buffer.data[i];
        if (!d || d.raw == null || d.norm == null || d.adj == null || isNaN(d.adj)) continue;

        x.push(i);

        raw.push(d.raw);
        norm.push(d.norm);

        adj.push({
            value: d.adj,
            itemStyle: {
                color:
                    d.adj > 0
                        ? "#00ff9c"
                        : d.adj < 0
                        ? "#ff4d4f"
                        : "#888"
            }
        });

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

    const windowData = adj.slice(-ROLLING_WINDOW).map(d => d.value);

    // ---------------------------
    // PROFILE (FLOW STYLE)
    // ---------------------------
    const profile = buildDSProfile(windowData, 40);

    let hist = [];
    let prices = [];

    if (profile) {
        hist = profile.hist;
        prices = profile.prices;
    }

    // ---------------------------
    // VALUE AREA
    // ---------------------------
    const levels = computeValueArea(windowData);

    // ---------------------------
    // AXIS RANGE
    // ---------------------------
    const yMin = Math.min(...windowData);
    const yMax = Math.max(...windowData);
    const start = Math.max(0, buffer.data.length - ROLLING_WINDOW);
    const windowLen = buffer.data.length - start;

    let g2Count = 0;
    let trapCount = 0;
    let breakoutCount = 0;

    for (let i = start; i < buffer.data.length; i++) {
        const d = buffer.data[i];
        if (!d) continue;

        if (d.G2 === "STRONG") g2Count++;
        if (d.zone === "TRAP") trapCount++;
        if (d.zone === "BREAKOUT") breakoutCount++;
    }

    const g2Freq = windowLen ? g2Count / windowLen : 0;
    const trapFreq = windowLen ? trapCount / windowLen : 0;
    const breakoutFreq = windowLen ? breakoutCount / windowLen : 0;

    const freqText = `
    {g2|G2: ${(g2Freq * 100).toFixed(1)}%}
    {trap|TRAP: ${(trapFreq * 100).toFixed(1)}%}
    {brk|BRK: ${(breakoutFreq * 100).toFixed(1)}%}
    `;

    // ---------------------------
    // CHART UPDATE
    // ---------------------------
    dSChart.setOption({

        grid: [
            {
                left: "5%",
                right: "30%",
                top: "10%",
                bottom: "10%"
            },
            {
                left: "75%",
                right: "5%",
                top: "10%",
                bottom: "10%"
            }
        ],

        xAxis: [
            {
                type: "category",
                gridIndex: 0,
                data: x
            },
            {
                type: "value",
                gridIndex: 1,
                name: "Freq"
            }
        ],

        yAxis: [
            {
                type: "value",
                gridIndex: 0,
                min: yMin,
                max: yMax
            },
            {
                type: "category",
                gridIndex: 1,
                data: prices.map(p => p.toFixed(4))
            }
        ],
        graphic: [
            {
                type: "text",
                right: 20,
                top: 60,
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
        ],

        series: [
            {
                name: "dS_raw",
                type: "line",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: raw,
                smooth: false,
                lineStyle: { width: 1, opacity: 0.3 }
            },
            {
                name: "dS_norm",
                type: "line",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: norm,
                smooth: true
            },
            {
                name: "dS_adj",
                type: "bar",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: adj,
                barWidth: "60%",
                ...(levels && {
                    markLine: {
                        symbol: "none",
                        data: [
                            { yAxis: levels.poc },
                            { yAxis: levels.vah },
                            { yAxis: levels.val }
                        ]
                    }
                })
            },
            {
                name: "G2 Signals",
                type: "scatter",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: g2Markers,
                symbolSize: 8
            },
            {
                name: "Zones",
                type: "scatter",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: zoneMarkers,
                symbolSize: 10
            },
            {
                name: "Profile",
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: hist,
                barWidth: "70%",
                itemStyle: { color: "#888" }
            },

        ],


    });
}