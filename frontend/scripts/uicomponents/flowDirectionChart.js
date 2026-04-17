export let flowChart = null;

/**
 * ----------------------------------------
 * INIT
 * ----------------------------------------
 */
export function initFlowChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (flowChart) flowChart.dispose();

    flowChart = echarts.init(el);

    flowChart.setOption({
        backgroundColor: "#111",

        tooltip: { trigger: "axis" },

        xAxis: {
            type: "category",
            data: [],
            boundaryGap: false
        },

        yAxis: {
            type: "value",
            scale: true
        },

        series: [{
            name: "Flow",
            type: "line",
            data: [],
            smooth: true,
            showSymbol: false
        }],

        dataZoom: [
            { type: "inside" },
            { type: "slider", height: 25, bottom: 20 }
        ],
    });
}

/**
 * ----------------------------------------
 * VALUE AREA CALCULATION
 * ----------------------------------------
 */
function computeValueArea(flowArray, bins = 50, valueAreaPercent = 0.7) {
    if (!flowArray || flowArray.length < 20) return null;

    const clean = flowArray.filter(v => v != null && isFinite(v));
    if (clean.length < 20) return null;

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    if (min === max) return null;

    const step = (max - min) / bins;

    const hist = new Array(bins).fill(0);

    // Histogram build
    for (let v of clean) {
        const idx = Math.min(
            bins - 1,
            Math.floor((v - min) / step)
        );
        hist[idx]++;
    }

    const total = clean.length;

    // POC
    let pocIndex = 0;
    let maxCount = 0;

    for (let i = 0; i < bins; i++) {
        if (hist[i] > maxCount) {
            maxCount = hist[i];
            pocIndex = i;
        }
    }

    // Value Area expansion
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

function buildFlowProfile(flowArray, bins = 50) {
    const clean = flowArray.filter(v => v != null && isFinite(v));
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
 * UPDATE
 * ----------------------------------------
 */
export function updateFlowChart(marketBuffer) {
    if (!flowChart || flowChart.isDisposed?.() || !flowChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 30) return;

    const data = [];

    for (let i = 0; i < len; i++) {
        const v = marketBuffer.flow[i];
        if (v == null || !isFinite(v)) continue;
        data.push(v);
    }

    if (data.length < 30) return;

    // 🔥 Rolling window
    const WINDOW = 400;
    const windowData = data.slice(-WINDOW);

    const profile = buildFlowProfile(windowData, 60);
    if (!profile) return;

    const { hist, prices } = profile;

    // 🔥 Compute VA
    const levels = computeValueArea(windowData);

    /**
     * ----------------------------------------
     * CHART CONFIG (PROFILE MODE)
     * ----------------------------------------
     */
    flowChart.setOption({

        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: function (params) {
                const p = params?.[0];
                if (!p) return "";

                return `
                    <b>Flow:</b> ${prices[p.dataIndex].toFixed(4)}<br/>
                    <b>Count:</b> ${p.data}
                `;
            }
        },

        xAxis: {
            type: "value",
            name: "Frequency"
        },

        yAxis: {
            type: "category",
            data: prices.map(p => p.toFixed(4)),
            inverse: true
        },

        series: [{
            name: "Profile",
            type: "bar",
            data: hist,
            barWidth: "80%"
        }],

        /**
         * 🔥 POC / VAH / VAL OVERLAY
         */
        graphic: levels ? [
            {
                type: "line",
                left: 0,
                right: 0,
                top: getYCoord(levels.poc, prices),
                style: { stroke: "#ffcc00", lineWidth: 2 }
            },
            {
                type: "line",
                left: 0,
                right: 0,
                top: getYCoord(levels.vah, prices),
                style: { stroke: "#00ff99", lineWidth: 1, lineDash: [5, 5] }
            },
            {
                type: "line",
                left: 0,
                right: 0,
                top: getYCoord(levels.val, prices),
                style: { stroke: "#ff6666", lineWidth: 1, lineDash: [5, 5] }
            }
        ] : []
    });
}

function getYCoord(value, prices) {
    if (!prices || prices.length === 0) return 0;

    let closestIdx = 0;
    let minDiff = Infinity;

    for (let i = 0; i < prices.length; i++) {
        const diff = Math.abs(prices[i] - value);
        if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
        }
    }

    // map index → pixel %
    return (closestIdx / prices.length) * 100 + "%";
}