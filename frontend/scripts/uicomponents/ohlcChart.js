let chart = null;
let container = null;
let ltpLine = null;
let listenersAttached = false;

function resizeChart() {
    if (!chart || !container) return

    chart.resize(
        container.clientWidth,
        container.clientHeight || 400
    )
}

export function initOhlcChart(containerId) {


    container = document.getElementById(containerId)

    if (!container) return

    if (chart) {
        chart.remove()
        chart = null
    }

    chart = LightweightCharts.createChart(container, {
        layout: { background: { color: "#111" }, textColor: "#DDD" },
        grid: {
            vertLines: { color: "#222" },
            horzLines: { color: "#222" }
        },
        timeScale: { timeVisible: true, secondsVisible: true },
        height: container.clientHeight || 300
    })

    // ✅ CORRECT (v5 API)
    candleSeries = chart.addSeries(
        LightweightCharts.CandlestickSeries,
        {
            upColor: "#00ff9c",
            downColor: "#ff4d4f",
            // 🔥 TURN THESE OFF
            lastValueVisible: false,
            priceLineVisible: false
        }
    )

    resizeChart()
    ltpLine = candleSeries.createPriceLine({
    price: 0,
    color: "#FFD700",
    lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    axisLabelVisible: true,
    title: "LTP"
    });
    window.addEventListener("resize", resizeChart)
    // 🔥 ADD THIS HERE (IMPORTANT)
    attachGEXListeners();
    // 🔥 ADD THIS HERE
    window.addEventListener("resize", () => {
       chart.timeScale().subscribeVisibleTimeRangeChange(() => {
                if (lastGammaLadder) {
                    drawGEXLadder(lastGammaLadder);
                }
            });

    });
    initNetGEXChart("netgex-panel");
    initIVStructureChart("iv-structure-detailed");
    initMicroChart("microChart");
    initImbalanceChart("imbalanceChart");
    initFlowChart("flowChart");
    initLBAChart("lbaChart");
    initAlphaChart("alpha-panel");   // 🔥 ADD THIS
    initRRPChart("rrpChart");   // ✅ ADD THIS
}