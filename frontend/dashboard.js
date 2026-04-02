//const API = "/api"
const API = "http://127.0.0.1:5000/api"
const isLocalhost = window.location.hostname === "127.0.0.1"
                 || window.location.hostname === "localhost";
let source = localStorage.getItem("source") || "localdb"
if (!isLocalhost) {
    source = "localdb"
    localStorage.setItem("source", source)
}
let database = localStorage.getItem("db") || "cleaned"
if (!isLocalhost && sourceSelect) {
    sourceSelect.disabled = true
}
let charts = {}
let ivHistory = []
let ivTimes = []

let chainHistory = []   // ← ADD THIS
let spotSeries = []
let flipSeries = []
let activeStock = null

 // 🔥 NEW STATE
let universe = new Map()   // all stocks from API
let watchlist = new Map()  // selected stocks


function sortChainByStrike(chain) {

    if (!Array.isArray(chain)) return

    chain.sort((a, b) => {

        let s1 = Number(a.strike) || 0
        let s2 = Number(b.strike) || 0

        return s1 - s2
    })

}

function initCharts() {


    charts.spot = echarts.init(document.getElementById("spotChart"))
    charts.iv = echarts.init(document.getElementById("ivChart"))
    charts.hv = echarts.init(document.getElementById("hvChart"))

    charts.flip = echarts.init(document.getElementById("flipChart"))
    charts.k = echarts.init(document.getElementById("kChart"))
    charts.bpr = echarts.init(document.getElementById("bprChart"))

    charts.i1 = echarts.init(document.getElementById("i1Chart"))
    charts.i2 = echarts.init(document.getElementById("i2Chart"))
    charts.amp = echarts.init(document.getElementById("ampChart"))

    charts.frag = echarts.init(document.getElementById("fragilityChart"))

    charts.gamma = echarts.init(document.getElementById("gammaLadder"))
    charts.vega = echarts.init(document.getElementById("vegaLadder"))

    charts.vex = echarts.init(document.getElementById("vegaExposure"))

    charts.oi = echarts.init(document.getElementById("oiDist"))
    charts.oichange = echarts.init(document.getElementById("oiChange"))
    charts.gex = echarts.init(document.getElementById("gammaExposure"))
    charts.dealerHeat = echarts.init(document.getElementById("dealerHeatmap"))
    charts.gammaWall = echarts.init(document.getElementById("gammaWallMap"))
    charts.hedge = echarts.init(document.getElementById("hedgingPressure"))
    charts.instability = echarts.init(document.getElementById("instabilitySurface"))
    charts.instabilityMap = echarts.init(document.getElementById("instabilityMap"))
    charts.flipzone = echarts.init(document.getElementById("flipZoneChart"))

    charts.ivskew = echarts.init(document.getElementById("ivSkewChart"))
    charts.gammaExplosionRanking = echarts.init(document.getElementById("gammaExplosionRanking"))
    charts.gammaSpatial = echarts.init(document.getElementById("gammaSpatialGradient"))

    charts.gammaTemporal = echarts.init(document.getElementById("gammaTemporalGradient"))

    charts.gammaConvexity = echarts.init(document.getElementById("gammaConvexity"))

    charts.gammaShock = echarts.init(document.getElementById("gammaShockSpeed"))

    charts.volHedge = echarts.init(document.getElementById("volHedgePressure"))

    charts.volHedgeReq = echarts.init(document.getElementById("volHedgeRequirement"))

    charts.gammaVegaCoupling = echarts.init(document.getElementById("gammaVegaCoupling"))

    charts.gammaVegaPhase = echarts.init(document.getElementById("gammaVegaPhase"))

    charts.vanna = echarts.init(document.getElementById("vannaExposure"))

    charts.dealerFlow = echarts.init(document.getElementById("dealerFlowMap"))
    charts.vannaFlow = echarts.init(document.getElementById("vannaFlowChart"))

    charts.gammaVannaSurface = echarts.init(document.getElementById("gammaVannaSurface"))
    charts.dealerConvexitySurface = echarts.init(document.getElementById("dealerConvexitySurface"))

    charts.convexityRadar = echarts.init(document.getElementById("convexityRadar"))

    charts.charmExposure = echarts.init(document.getElementById("charmExposure"))
    charts.charmWall = echarts.init(document.getElementById("charmWall"))
    charts.charmFlow = echarts.init(document.getElementById("charmFlow"))
    charts.charmDrift = echarts.init(document.getElementById("charmDrift"))
    charts.phaseDiagram = echarts.init(document.getElementById("phaseDiagram"))

    charts.vommaWall = echarts.init(document.getElementById("vommaWall"))
    charts.tensorMap = echarts.init(document.getElementById("tensorMap"))

}

async function loadStocks() {

    let res = await authFetch(`${API}/stocks?source=${source}&db=${database}`)

    let stocks = await res.json()

    let list = document.getElementById("stockList")

    list.innerHTML = ""

    stocks.forEach(symbol => {

        let option = document.createElement("option")

        option.value = symbol

        list.appendChild(option)

    })

    // auto load first stock
    if (stocks.length > 0) {

        const select = document.getElementById("stockSelect")

        // 🧠 Restore previous selection OR fallback
        let selected = activeStock || localStorage.getItem("selectedStock") || stocks[0]

        // If selected stock not in new list → fallback safely
        if (!stocks.includes(selected)) {
            selected = stocks[0]
        }

        activeStock = selected
        select.value = selected

        loadStock(selected)
    }

}

function ensureNetGEX(chain) {

    if (!Array.isArray(chain)) return

    chain.forEach(row => {

        if (row.net_gex === undefined || row.net_gex === null) {

            let call = Number(row.call_gex) || 0
            let put = Number(row.put_gex) || 0

            row.net_gex = call - put

        }

    })

}

let currentRequestId = 0
let isLoading = false

async function loadStock(symbol) {

    if (!symbol) return

    // 🔒 prevent duplicate calls
    if (isLoading && symbol === activeStock) return

    const requestId = ++currentRequestId
    isLoading = true
    activeStock = symbol

    console.log("📡 Loading:", symbol)

    try {

        const res = await authFetch(`${API}/dashboard/${symbol}?source=${source}&db=${database}`)
        const data = await res.json()

        // ❌ Ignore stale responses
        if (requestId !== currentRequestId) return

        if (!data || !Array.isArray(data.time)) {
            console.warn("No valid data for", symbol)
            return
        }

        // -------------------------
        // 📊 BASIC SERIES
        // -------------------------
        spotSeries = data.spot || []
        flipSeries = data.gamma_flip || []

        renderMarketBanner(data)

        renderLine(charts.spot, data.time, spotSeries, "Spot")
        renderLine(charts.iv, data.time, data.iv || [], "IV")
        renderLine(charts.hv, data.time, data.hv || [], "HV")

        renderLine(charts.flip, data.time, flipSeries, "Gamma Flip")
        renderLine(charts.k, data.time, data.k || [], "Impact k")
        renderLine(charts.bpr, data.time, data.bpr || [], "BPR")

        renderLine(charts.i1, data.time, data.I1 || [], "I1")
        renderLine(charts.i2, data.time, data.I2 || [], "I2")
        renderLine(charts.amp, data.time, data.amplification || [], "Amplification")

        renderLine(charts.frag, data.time, data.fragility || [], "Fragility")

        // -------------------------
        // 🧱 OPTION CHAIN
        // -------------------------
        let chain = Array.isArray(data.option_chain) ? data.option_chain : []

        ensureNetGEX(chain)
        sortChainByStrike(chain)

        try {
            renderGammaLadder(chain)
        } catch (err) {
            console.error("Gamma ladder error:", err)
        }

        renderOI(chain)
        renderOIChange(chain)
        renderGammaExposure(chain)
        renderDealerHeatmap(chain)
        renderGammaWallMap(chain)
        renderHedgingPressure(chain)

        // -------------------------
        // 📚 HISTORY
        // -------------------------
        ivHistory = data.option_chain_history || []
        ivTimes = data.time || []

        chainHistory = ivHistory.map((c, i) => {

            if (!Array.isArray(c)) {
                return JSON.parse(JSON.stringify(chain))
            }

            ensureNetGEX(c)
            sortChainByStrike(c)

            return c
        })

        // -------------------------
        // 🎚️ SLIDERS
        // -------------------------
        const lastIndex = Math.max(ivHistory.length - 1, 0)

        const chainSlider = document.getElementById("chainSlider")
        if (chainSlider) {
            chainSlider.max = lastIndex
            chainSlider.value = lastIndex
        }

        const ivSlider = document.getElementById("ivSlider")
        if (ivSlider) {
            ivSlider.max = lastIndex
            ivSlider.value = lastIndex
        }

        // -------------------------
        // 📈 DERIVED VISUALS
        // -------------------------
        renderOptionStructure(lastIndex)
        renderGammaSpatialGradient(lastIndex)
        renderGammaConvexity(lastIndex)
        renderGammaTemporal(lastIndex)
        renderGammaShockSpeed(lastIndex)

        renderVolatilityHedgingPressure()
        renderVolatilityHedgingRequirement()

        renderGammaVegaCoupling()
        renderGammaVegaPhaseDiagram()

        renderDealerFlow()
        renderVannaFlow()
        renderGammaVannaSurface()
        renderDealerConvexitySurface()

        renderInstabilitySurface(data)
        renderIVSkew(lastIndex, spotSeries, flipSeries, chain)

        // -------------------------
        // 🧠 ADVANCED GREEKS
        // -------------------------
        const lotSize = data.lot_size ?? 100

        computeCharmExposure(chain, lotSize)
        renderCharmExposure(chain)
        renderCharmWall(chain)

        const charmFlow = computeCharmFlow(chainHistory)
        renderCharmFlow(data.time, charmFlow)

        const dealerFlow = computeCharmDrift(chainHistory, spotSeries)
        renderCharmDrift(data.time, dealerFlow)

        const phaseData = computePhaseDiagram(chainHistory, spotSeries, flipSeries)
        renderDealerPhaseDiagram(phaseData)

        computeVommaExposure(chain)
        renderVommaWall(chain)

        computeVannaExposure(chain, spotSeries.at(-1), lotSize)
        renderGreekTensorMap(chain, lotSize)

        // -------------------------
        // 🌐 EXTRA DATA (ASYNC)
        // -------------------------
        loadGammaExplosionRanking()
        renderFlipZoneChart()
        loadConvexityRadar()

        // 🔥 snapshots (non-blocking)
        loadSnapshotsForStock(symbol)

    } catch (err) {

        console.error("🔥 loadStock error:", err)

    } finally {
        isLoading = false
    }
}

function computeVannaExposure(chain, spot, lotSize = 1) {

    for (let i = 0; i < chain.length; i++) {

        let row = chain[i]

        let vega = row.vega ?? 0
        let putOI = row.put_oi ?? 0
        let callOI = row.call_oi ?? 0

        // simple approximation
        let vanna = vega / spot

        let putVanna = vanna * putOI * lotSize
        let callVanna = -vanna * callOI * lotSize

        row.net_vanna = putVanna + callVanna
    }
}

async function loadGammaExplosionRanking() {

    let res = await authFetch(`${API}/gamma-explosion?source=${source}&db=${database}`)
    let data = await res.json()

    renderGammaExplosionRanking(data)

}

async function loadConvexityRadar() {

    let res = await authFetch(`${API}/convexity-radar?source=${source}&db=${database}`)

    let data = await res.json()

    renderConvexityRadar(data)

}

function computeCharmExposure(chain, lotsize) {

    const CONTRACT_SIZE = lotsize

    chain.forEach(row => {

        let callTheta = Number(row.call_theta) || 0
        let putTheta = Number(row.put_theta) || 0

        let callOI = Number(row.call_oi) || 0
        let putOI = Number(row.put_oi) || 0

        let callCharmExposure = callTheta * callOI * CONTRACT_SIZE
        let putCharmExposure = putTheta * putOI * CONTRACT_SIZE

        row.net_charm = callCharmExposure + putCharmExposure

    })

}

function computeCharmFlow(chainHistory) {

    if (!chainHistory) return []
    // console.log("Bad chains:", chainHistory.filter(c => !Array.isArray(c)))

    let flow = []

    chainHistory.forEach(chain => {

        if (!Array.isArray(chain)) {
            flow.push(0)
            return
        }

        let totalCharm = 0

        chain.forEach(row => {

            let callTheta = Number(row.call_theta) || 0
            let putTheta = Number(row.put_theta) || 0

            let callOI = Number(row.call_oi) || 0
            let putOI = Number(row.put_oi) || 0

            totalCharm += (callTheta * callOI + putTheta * putOI) * 100

        })

        flow.push(totalCharm)

    })

    return flow
}

function computeCharmDrift(chainHistory, spotSeries) {

    let dealerFlow = []

    for (let i = 1; i < chainHistory.length; i++) {

        let chainNow = chainHistory[i]
        let chainPrev = chainHistory[i - 1]

        if (!chainNow || !chainPrev) {
            dealerFlow.push(0)
            continue
        }

        // 🔥 Build previous strike map
        let prevMap = {}

        chainPrev.forEach(o => {
            if (o && o.strike != null) {
                prevMap[o.strike] = o
            }
        })

        let dS = spotSeries[i] - spotSeries[i - 1]

        let gammaFlow = 0
        let charmFlow = 0

        chainNow.forEach(row => {

            if (!row || row.strike == null) return

            let prev = prevMap[row.strike]

            // 🔥 Only common strikes
            if (!prev) return

            let gamma = Number(row.gamma) || 0
            let callOI = Number(row.call_oi) || 0
            let putOI = Number(row.put_oi) || 0

            let callTheta = Number(row.call_theta) || 0
            let putTheta = Number(row.put_theta) || 0

            let totalOI = callOI + putOI

            gammaFlow += gamma * totalOI * dS
            charmFlow += (callTheta * callOI + putTheta * putOI)

        })

        dealerFlow.push(gammaFlow + charmFlow)
    }

    return dealerFlow
}

function computeDealerFlow(chainHistory, spotSeries) {

    let flow = []

    for (let t = 1; t < chainHistory.length; t++) {

        let chainNow = chainHistory[t]
        let chainPrev = chainHistory[t - 1]

        if (!chainNow || !chainPrev) {
            flow.push(0)
            continue
        }

        // 🔥 Build previous map
        let prevMap = {}

        chainPrev.forEach(o => {
            if (o && o.strike != null) {
                prevMap[o.strike] = o
            }
        })

        let dS = spotSeries[t] - spotSeries[t - 1]

        let gammaFlow = 0
        let charmFlow = 0

        chainNow.forEach(o => {

            if (!o || o.strike == null) return

            let prev = prevMap[o.strike]

            // 🔥 skip if strike not present before
            if (!prev) return

            let gamma = Number(o.gamma) || 0
            let callOI = Number(o.call_oi) || 0
            let putOI = Number(o.put_oi) || 0

            let callTheta = Number(o.call_theta) || 0
            let putTheta = Number(o.put_theta) || 0

            let totalOI = callOI + putOI

            gammaFlow += gamma * totalOI * dS
            charmFlow += (callTheta * callOI + putTheta * putOI)

        })

        flow.push(gammaFlow + charmFlow)
    }

    return flow
}

function computeFlipDistance(spotSeries, flipSeries) {

    let dist = []

    for (let i = 1; i < spotSeries.length; i++) {

        let d = (spotSeries[i] - flipSeries[i]) / spotSeries[i]

        dist.push(d)

    }

    return dist
}

function computePhaseDiagram(chainHistory, spotSeries, flipSeries) {

    let dealerFlow = computeDealerFlow(chainHistory, spotSeries)
    let flipDist = computeFlipDistance(spotSeries, flipSeries)

    let phase = []

    for (let i = 0; i < dealerFlow.length; i++) {

        phase.push({
            value: [flipDist[i], dealerFlow[i]],
            time: ivTimes[i],
            spot: spotSeries[i],
            flip: flipSeries[i]
        })

    }


    return phase
}

function renderDealerPhaseDiagram(data) {

    charts.phaseDiagram.clear()
    let latestPoint = data[data.length - 1]

    charts.phaseDiagram.setOption({

            backgroundColor: "#111",

            title: {
                text: "Dealer Flow Phase Diagram", left: "center", textStyle: {color: "#ddd"}
            },

            tooltip: {
                formatter: function (p) {

                    return `
Time: ${p.data?.time || "N/A"}<br>
Spot: ${(Number(p.data?.spot) || 0).toFixed(2)}<br>
Flip Distance: ${(Number(p.value?.[0]) || 0).toFixed(4)}<br>
Dealer Flow: ${(Number(p.value?.[1]) || 0).toFixed(0)}
`
                }
            },

            xAxis: {
                name: "Distance From Gamma Flip - X axis", type: "value", axisLabel: {color: "#ccc"}
            },

            yAxis: {
                name: "Dealer Flow - Y axis", type: "value", axisLabel: {color: "#ccc"}
            },


            series: [{

                type: "scatter",

                data: data,

                symbolSize: 12,

                itemStyle: {
                    color: "#00E5FF"
                },
                markLine: {
                    silent: true,
                    lineStyle: {color: "#888", type: "dashed"},
                    data: [
                        {xAxis: 0},
                        {yAxis: 0}
                    ]
                }

            },
                // 🔴 Latest point (highlighted)
                {
                    type: "scatter",
                    data: [latestPoint],
                    symbolSize: 18,
                    itemStyle: {
                        color: "#FF3B3B"
                    },
                    label: {
                        show: true,
                        formatter: "Latest",
                        color: "#fff",
                        position: "top"
                    }
                },
            ],
            graphic: [

                // +X, +Y (top-right)
                {
                    type: "text",
                    left: "75%",
                    top: "15%",
                    z: 100,
                    style: {
                        text: "Stable\n(Long Gamma + Buying)",
                        fill: "#00FF9C",
                        font: "12px sans-serif",
                        textAlign: "center"
                    }
                },

                // -X, +Y (top-left)
                {
                    type: "text",
                    left: "10%",
                    top: "15%",
                    style: {
                        text: "Squeeze\n(Short Gamma + Buying)",
                        fill: "#FFD700",
                        font: "12px sans-serif",
                        textAlign: "center"
                    }
                },

                // -X, -Y (bottom-left)
                {
                    type: "text",
                    left: "10%",
                    top: "75%",
                    style: {
                        text: "Crash Risk\n(Short Gamma + Selling)",
                        fill: "#FF3B3B",
                        font: "12px sans-serif",
                        textAlign: "center"
                    }
                },

                // +X, -Y (bottom-right)
                {
                    type: "text",
                    left: "75%",
                    top: "75%",
                    style: {
                        text: "Mean Reversion\n(Long Gamma + Selling)",
                        fill: "#00BFFF",
                        font: "12px sans-serif",
                        textAlign: "center"
                    }
                }

            ]

        },
    )
}

function renderCharmExposure(chain) {

    charts.charmExposure.clear()

    if (!chain || chain.length === 0) return

    let strikes = chain.map(x => x.strike)
    let charm = chain.map(x => x.net_charm)

    charts.charmExposure.setOption({

        backgroundColor: "#111",

        title: {
            text: "Charm Exposure", left: "center", textStyle: {color: "#ddd"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#ccc"}
        },

        yAxis: {
            type: "value", axisLabel: {color: "#ccc"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{
            type: "bar", data: charm, itemStyle: {
                color: function (params) {
                    return params.value > 0 ? "#00FF9C" : "#FF4D4F"
                }
            }
        }],
        graphic: [
            // 🔵 Title Guide
            {
                type: "text",
                left: "15%",
                top: "10%",
                z: 100,
                style: {
                    text:
                        `charm = d(delta)/d(time)
Negative charm exposure
-delta decreases over time
-dealers sell underlying

Positive charm exposure
-delta increases
-dealers buy underlying`,
                    fill: "#e4de09",
                    font: "12px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            }

        ]

    })

}

function renderCharmWall(chain) {

    charts.charmWall.clear()

    if (!chain || chain.length === 0) return

    let strikes = chain.map(x => x.strike)
    let charm = chain.map(x => x.net_charm)

    let maxCharm = Math.max(...charm.map(v => Math.abs(v)))

    let bubbleData = charm.map((v, i) => [i, v])

    charts.charmWall.setOption({

        backgroundColor: "#111",

        title: {
            text: "Charm Wall", left: "center", textStyle: {color: "#ddd"}
        },

        tooltip: {
            formatter: function (p) {

                let strike = strikes[p.data[0]]

                return "Strike: " + strike + "<br>Charm: " + p.data[1].toFixed(0)

            }
        },

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#ccc"}
        },

        yAxis: {
            type: "value", axisLabel: {color: "#ccc"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{

            type: "scatter",

            data: bubbleData,

            symbolSize: function (val) {

                let normalized = Math.abs(val[1]) / maxCharm

                return 10 + normalized * 40

            },

            itemStyle: {
                color: "#3BA272"
            }

        }]

    })

}

function renderCharmFlow(times, flow) {

    charts.charmFlow.clear()

    charts.charmFlow.setOption({

        backgroundColor: "#111",

        title: {
            text: "Charm Flow", left: "center", textStyle: {color: "#ddd"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: times, axisLabel: {color: "#ccc"}
        },

        yAxis: {
            type: "value", axisLabel: {color: "#ccc"}
        },

        series: [{

            type: "line", smooth: true, data: flow, areaStyle: {}, lineStyle: {width: 3}

        }]

    })

}

function renderCharmDrift(times, flow) {

    charts.charmDrift.clear()

    charts.charmDrift.setOption({

        backgroundColor: "#111",

        title: {
            text: "Dealer Drift (Gamma + Charm)", left: "center", textStyle: {color: "#ddd"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: times.slice(1), axisLabel: {color: "#ccc"}
        },

        yAxis: {
            type: "value", axisLabel: {color: "#ccc"}
        },

        series: [{

            name: "Dealer Flow",

            type: "line",

            smooth: true,

            data: flow,

            areaStyle: {},

            lineStyle: {width: 3}

        }]

    })

}

function computeVommaExposure(chain) {

    chain.forEach(row => {

        // Use lot_size from data if available, otherwise default to 100
        let contractSize = Number(row.lot_size) || 100

        let vega = Number(row.vega) || 0

        let callOI = Number(row.call_oi) || 0
        let putOI = Number(row.put_oi) || 0

        let totalOI = callOI + putOI

        row.net_vomma = vega * totalOI * contractSize

    })

}

function renderVommaWall(chain) {

    charts.vommaWall.clear()

    if (!chain || chain.length === 0) return

    let strikes = chain.map(x => x.strike)
    let vomma = chain.map(x => x.net_vomma)

    let maxVomma = Math.max(...vomma.map(v => Math.abs(v)))

    let bubbleData = vomma.map((v, i) => [i, v])

    charts.vommaWall.setOption({

        backgroundColor: "#111",

        title: {
            text: "Vomma Wall", left: "center", textStyle: {color: "#ddd"}
        },

        tooltip: {
            formatter: function (p) {

                let strike = strikes[p.data[0]]

                return "Strike: " + strike + "<br>Vomma Exposure: " + p.data[1].toFixed(0)

            }
        },

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#ccc"}
        },

        yAxis: {
            type: "value", axisLabel: {color: "#ccc"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{

            type: "scatter",

            data: bubbleData,

            symbolSize: function (val) {

                let normalized = Math.abs(val[1]) / maxVomma

                return 8 + normalized * 40

            },

            itemStyle: {
                color: "#00E5FF"
            }

        }],
        graphic: [
            // 🔵 Title Guide
            {
                type: "text",
                left: "15%",
                top: "5%",
                z: 100,
                style: {
                    text:
                        `vomma = d2(option-price)/d2(IV)
Vomma Exposure = summation (Vomma x OI x contract size)
Positive Vomma Exposure:
Vega increases when IV rises and Vega decreases when IV falls.
Implication:Volatility moves become self-reinforcing.
If IV starts rising -> dealers become more sensitive ->can amplify vol spikes
Negative Vomma Exposure:
Vega decreases when IV rises and Vega increases when IV falls
Implication: Volatility moves become self-dampening.
System resists large IV moves.
Interpreting the MAGNITUDE
-Small Vomma Exposure
Vega is stable.IV changes don’t alter dealer behavior much
Calm / predictable vol regime
-Large Vomma Exposure
Vega is unstable. Small IV changes -> big changes in hedging flows`,
                    fill: "#ddd",
                    font: "12px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            }

        ]

    })

}

function normalize(values) {

    let max = Math.max(...values.map(v => Math.abs(v)))

    return v => max ? v / max : 0
}

function computeGreekTensor(chain, lot_size) {

    const CONTRACT_SIZE = lot_size

    return chain.map(row => {

        let gamma = Number(row.gamma) || 0
        let callOI = Number(row.call_oi) || 0
        let putOI = Number(row.put_oi) || 0

        let callTheta = Number(row.call_theta) || 0
        let putTheta = Number(row.put_theta) || 0

        let vega = Number(row.vega) || 0

        let lot = Number(row.lot_size) || CONTRACT_SIZE

        let gammaExp = gamma * (callOI + putOI) * lot
        let charmExp = (callTheta * callOI + putTheta * putOI) * lot
        let vannaExp = row.net_vanna || 0
        let vommaExp = row.net_vomma || 0

        return {
            strike: row.strike, gamma: gammaExp, charm: charmExp, vanna: vannaExp, vomma: vommaExp
        }

    })
}

function renderGreekTensorMap(chain, lot_size) {

    if (!charts.tensorMap) return

    charts.tensorMap.clear()

    let tensor = computeGreekTensor(chain, lot_size)

    if (!tensor || tensor.length === 0) {
        console.warn("Tensor map: no data")
        return
    }

    // normalize greeks
    let gammaN = normalize(tensor.map(t => t.gamma))
    let charmN = normalize(tensor.map(t => t.charm))
    let vannaN = normalize(tensor.map(t => t.vanna))
    let vommaN = normalize(tensor.map(t => t.vomma))

    let strikes = tensor.map(t => t.strike)

    // build scatter rows
    let data = tensor.map((t, i) => ({
        value: [
            t.strike,               // x axis
            Number(t.gamma) || 0,   // y axis
            gammaN(t.gamma),
            charmN(t.charm),
            vannaN(t.vanna),
            vommaN(t.vomma)
        ]
    }))
    // console.log(console.log("Tensor data:", JSON.stringify(data)))

    charts.tensorMap.setOption({

        backgroundColor: "#111",

        title: {
            text: "Greek Tensor Map",
            left: "center",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            formatter: p => `
            Strike: ${p.value[0]}<br>
            Gamma: ${p.value[1].toFixed(0)}<br>
            Charm: ${p.value[3].toFixed(2)}<br>
            Vanna: ${p.value[4].toFixed(2)}<br>
            Vomma: ${p.value[5].toFixed(2)}
            `
        },

        xAxis: {
            type: "value",
            name: "Strike",
            scale: true,
            axisLabel: {color: "#ccc"}
        },

        yAxis: {
            type: "value",
            name: "Gamma Exposure",
            scale: true,
            axisLabel: {color: "#ccc"}
        },

        visualMap: {
            dimension: 4,
            min: -1,
            max: 1,
            calculable: true,
            orient: "vertical",
            right: 10,
            top: "middle",
            inRange: {
                color: ["#ff4d4d", "#ffaa00", "#00ff9c"]
            }
        },

        series: [{

            type: "scatter",

            data: data,

            symbol: "circle",

            symbolSize: function (v) {
                let charm = Math.abs(v[3]) || 0
                return 15 + charm * 60
            },

            itemStyle: {
                color: "#00c8ff",
                borderColor: "#fff",
                borderWidth: 1,
                opacity: 0.9
            }

        }]

    })

}

function renderLine(chart, x, y, title) {


    chart.clear()

    chart.setOption({

        backgroundColor: "#111",

        title: {
            text: title, textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "category", data: x
        },

        yAxis: {
            type: "value",
            scale: true,
            boundaryGap: ['5%', '5%']
        },
        tooltip: {trigger: "axis"},

        series: [{
            data: y, type: "line", smooth: true,

        }]

    })


}

function renderGammaLadder(chain) {


    charts.gamma.clear()


    if (!chain || chain.length === 0) {
        return
    }

    let strikes = chain.map(x => x.strike)

    let cumulative = []
    let sum = 0

    chain.forEach(c => {

        let g = Number(c.net_gex) || 0
        sum += g
        cumulative.push(sum)

    })

    charts.gamma.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Ladder",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis",
            axisPointer: {
                type: "cross"
            },
            formatter: function (params) {
                let p = params[0]
                return `
                Strike: <b>${p.axisValue}</b><br>
                Cumulative GEX: <b>${(Number(p.data) || 0).toFixed(2)}</b>
                `
            }
        },

        xAxis: {
            type: "category",
            data: strikes
        },

        yAxis: {
            type: "value"
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{
            name: "Cumulative Gamma",
            data: cumulative,
            type: "line",
            smooth: true
        }]

    })

}

function renderVega(chain) {

    charts.vega.clear()

    if (!chain || chain.length === 0) return

    let strikes = []
    let vex = []

    chain.forEach(o => {

        let netOI = (o.call_oi || 0) - (o.put_oi || 0)

        let netVega = (o.vega || 0) * netOI

        strikes.push(o.strike)
        vex.push(netVega)

    })

    charts.vega.setOption({

        backgroundColor: "#111",

        title: {
            text: "Vega Ladder", textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Vega Exposure", axisLabel: {color: "#fff"}
        },

        dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{

            type: "bar", data: vex,

            itemStyle: {
                color: function (p) {
                    return p.value >= 0 ? "#00ff9c" : "#ff4d4d"
                }
            }

        }]

    })
}

function renderVegaExposure(chain) {

    charts.vex.clear()

    if (!chain || chain.length === 0) return

    let strikes = []
    let cumulative = []

    let sum = 0

    chain.forEach(o => {

        let netOI = (o.call_oi || 0) - (o.put_oi || 0)

        let v = (o.vega || 0) * netOI

        sum += v

        strikes.push(o.strike)
        cumulative.push(sum)

    })

    charts.vex.setOption({

        backgroundColor: "#111",

        title: {
            text: "Cumulative Vega Exposure", textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", axisLabel: {color: "#fff"}
        },

        dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{

            type: "line",

            smooth: true,

            data: cumulative,

            lineStyle: {
                width: 2, color: "#00c8ff"
            }

        }],
        graphic: [
            // 🔵 Title Guide
            {
                type: "text",
                left: "15%",
                top: "5%",
                z: 100,
                style: {
                    text:
                        `-Positive Cumulative VEX
Market is long volatility
Typically:
Dealers are long vega.Customers are short vol (selling options)
Interpretation: If IV up => dealers gain and If IV down => dealers lose
Behavioral impact: Dealers are comfortable with rising vol. They do not need to hedge aggressively
Result: Volatility can expand smoothly. Trends can sustain
-Negative Cumulative VEX
Market is short volatility
Typically: Dealers are short vega. Customers are long options
Interpretation: If IV up => dealers lose and If IV down => dealers gain
Behavioral impact: Dealers are forced to hedge volatility moves
Rising IV creates feedback loops
Result:Vol spikes accelerate. Market becomes fragile / explosive`,
                    fill: "#ddd",
                    font: "12px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            }

        ]

    })

}

function renderVolatilityHedgingPressure() {

    charts.volHedge.clear()

    if (!chainHistory || chainHistory.length < 2) return

    let pressure = []
    let times = ivTimes

    for (let t = 1; t < chainHistory.length; t++) {

        let chain = chainHistory[t]
        let prevChain = chainHistory[t - 1]

        if (!chain || !prevChain) continue

        let totalVega = 0

        chain.forEach(o => {

            let netOI = (o.call_oi || 0) - (o.put_oi || 0)

            totalVega += (o.vega || 0) * netOI

        })

        // average IV change between snapshots
        let ivNow = chain.reduce((a, o) => a + (o.iv || 0), 0) / chain.length
        let ivPrev = prevChain.reduce((a, o) => a + (o.iv || 0), 0) / prevChain.length

        let dIV = ivNow - ivPrev

        pressure.push(totalVega * dIV)

    }

    charts.volHedge.setOption({

        backgroundColor: "#111",

        title: {
            text: "Volatility Hedging Pressure", textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: times.slice(1), axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Vega x del(IV)", axisLabel: {color: "#fff"}
        },

        series: [{

            type: "line",

            smooth: true,

            data: pressure,

            lineStyle: {
                width: 3, color: "#ffcc00"
            },

            areaStyle: {
                opacity: 0.2
            }

        }]

    })

}

function renderVolatilityHedgingRequirement() {

    charts.volHedgeReq.clear()

    if (!chainHistory || chainHistory.length < 2) return

    let requirement = []
    let times = ivTimes.slice(1)

    for (let t = 1; t < chainHistory.length; t++) {

        let chain = chainHistory[t]
        let prevChain = chainHistory[t - 1]

        if (!chain || !prevChain) continue

        let totalVega = 0

        chain.forEach(o => {

            let netOI = (o.call_oi || 0) - (o.put_oi || 0)

            totalVega += (o.vega || 0) * netOI

        })

        let ivNow = chain.reduce((a, o) => a + (o.iv || 0), 0) / chain.length
        let ivPrev = prevChain.reduce((a, o) => a + (o.iv || 0), 0) / prevChain.length

        let dIV = ivNow - ivPrev

        let hedgeReq = Math.abs(totalVega) * Math.abs(dIV)

        requirement.push(hedgeReq)

    }

    charts.volHedgeReq.setOption({

        backgroundColor: "#111",

        title: {
            text: "Volatility Hedging Requirement", left: "center", textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis", formatter: function (p) {

                return `
                Time: ${p[0].axisValue}<br>
                Hedging Requirement: ${p[0].data.toFixed(2)}
                `
            }
        },

        xAxis: {
            type: "category", data: times, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Hedging Size", axisLabel: {color: "#fff"}
        },

        series: [{

            type: "bar",

            data: requirement,

            itemStyle: {
                color: "#ffaa00"
            }

        }]

    })

}

function renderOI(chain) {


    charts.oi.clear()

    if (!chain || chain.length === 0) {
        return
    }

    let strikes = chain.map(x => x.strike)

    let callOI = chain.map(x => x.call_oi)
    let putOI = chain.map(x => x.put_oi)

    charts.oi.setOption({

        backgroundColor: "#111",

        title: {
            text: "OI Distribution", textStyle: {color: "#fff"}
        },

        legend: {
            data: ["Call", "Put"]
        },
        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: strikes
        },

        yAxis: {
            type: "value"
        },
        dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [

            {data: callOI, type: "bar", name: "Call"}, {data: putOI, type: "bar", name: "Put"}

        ]

    })


}

function renderOIChange(chain) {

    charts.oichange.clear()

    if (!chain || chain.length === 0) {
        return
    }

    let strikes = chain.map(x => x.strike)

    let callChange = chain.map(x => x.call_oi_change)
    let putChange = chain.map(x => x.put_oi_change)

    charts.oichange.setOption({

        backgroundColor: "#111",

        title: {
            text: "OI Change", textStyle: {color: "#fff"}
        },

        legend: {
            data: ["Call OI Change", "Put OI Change"], textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category", data: strikes
        },

        yAxis: {
            type: "value"
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [

            {
                name: "Call OI Change", type: "bar", data: callChange
            },

            {
                name: "Put OI Change", type: "bar", data: putChange
            }

        ]

    })

}

function renderGammaExposure(chain) {

    charts.gex.clear()

    if (!chain || chain.length === 0) {
        return
    }

    let strikes = chain.map(x => x.strike)
    let gex = chain.map(x => x.net_gex)

    charts.gex.setOption({

        backgroundColor: "#111",

        title: {
            text: "Strike vs Gamma Exposure", textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category", data: strikes
        },

        yAxis: {
            type: "value", name: "Gamma Exposure"
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{
            name: "GEX", type: "bar", data: gex, itemStyle: {
                color: function (params) {
                    return params.value >= 0 ? "#00ff9c" : "#ff4d4d"
                }
            }
        }]

    })

}

function renderDealerHeatmap(chain) {

    charts.dealerHeat.clear()

    if (!chain || chain.length === 0) {
        return
    }

    let strikes = chain.map(x => x.strike)

    let callChange = chain.map(x => x.call_oi_change)
    let putChange = chain.map(x => x.put_oi_change)

    let heatData = []

    callChange.forEach((v, i) => {
        heatData.push([i, 0, v])
    })

    putChange.forEach((v, i) => {
        heatData.push([i, 1, v])
    })

    charts.dealerHeat.setOption({

        backgroundColor: "#111",

        title: {
            text: "Dealer Position Heatmap", textStyle: {color: "#fff"}
        },

        tooltip: {
            position: "top"
        },

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "category", data: ["Call OI Change", "Put OI Change"], axisLabel: {color: "#fff"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        visualMap: {
            min: -500000, max: 500000, calculable: true, orient: "horizontal", left: "center", bottom: 20, inRange: {
                color: ["#ff4d4d", "#111", "#00ff9c"]
            }
        },

        series: [{
            type: "heatmap", data: heatData, label: {show: false}
        }]

    })

}

function renderGammaWallMap(chain) {

    charts.gammaWall.clear()

    if (!chain || chain.length === 0) {
        return
    }

    let data = []

    chain.forEach(opt => {

        if (!opt || opt.net_gex == null) return

        data.push([opt.strike, opt.net_gex])

    })

    if (data.length === 0) return

    let strikes = data.map(d => d[0])
    let gexValues = data.map(d => d[1])

    let minStrike = Math.min(...strikes)
    let maxStrike = Math.max(...strikes)

    charts.gammaWall.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Wall Map", textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "item", formatter: function (p) {
                return `
                Strike: ${p.value[0]}<br>
                GEX: ${p.value[1].toExponential(2)}
                `
            }
        },

        xAxis: {
            type: "value", name: "Strike", min: minStrike - 2, max: maxStrike + 2, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Gamma Exposure", axisLabel: {color: "#fff"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [

            {
                type: "scatter",

                data: data,

                symbolSize: function (val) {

                    // normalize bubble size
                    return Math.sqrt(Math.abs(val[1])) / 5000 + 8
                },

                itemStyle: {
                    color: function (params) {
                        return params.value[1] >= 0 ? "#00ff9c" : "#ff4d4d"
                    }
                }

            }

        ]

    })

}

function renderHedgingPressure(chain) {

    charts.hedge.clear()

    if (!chain || chain.length === 0) {
        return
    }

    let strikes = chain.map(x => x.strike)

    // hedging pressure = absolute gamma exposure
    let pressure = chain.map(x => Math.abs(x.net_gex))

    charts.hedge.setOption({

        backgroundColor: "#111",

        title: {
            text: "Dealer Hedging Pressure", textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Hedging Pressure", axisLabel: {color: "#fff"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [

            {
                type: "bar", data: pressure,

                itemStyle: {
                    color: "#ffaa00"
                }
            }

        ]

    })

}

function renderInstabilitySurface(data) {

    charts.instability.clear()

    if (!data || data.time.length === 0) {
        return
    }


    let surfaceData = []

    for (let i = 0; i < data.time.length; i++) {

        let flip = data.gamma_flip[i]
        let spot = data.spot[i]

        if (flip == null || spot == null) continue

        let distance = spot - flip

        surfaceData.push([
            distance,
            data.I1[i],
            data.I2[i],
            data.amplification[i],
            data.time[i] || "N/A"
        ])

    }
    let latestPoint = surfaceData[surfaceData.length - 1]
    let i2Values = surfaceData.map(p => p[2])

    let minI2 = Math.min(...i2Values)
    let maxI2 = Math.max(...i2Values)

    charts.instability.setOption({

        backgroundColor: "#111",

        title: {
            text: "Systemic Instability Surface", textStyle: {color: "#fff"}
        },

        tooltip: {
            formatter: function (p) {

                let raw = p.value[4]

                let ts = raw ? raw : "Unknown"

                return `
        Time: ${ts}<br>
        Flip Distance: ${p.value[0]}<br>
        I1: ${p.value[1]}<br>
        I2: ${p.value[2]}<br>
        Amplification: ${p.value[3]}
        `
            }
        },

        xAxis: {
            name: "Distance from Gamma Flip - X axis", type: "value", axisLabel: {color: "#fff"}
        },

        yAxis: {
            name: "Linear Instability (I1) - Y axis", type: "value", axisLabel: {color: "#fff"}
        },

        visualMap: {
            dimension: 2,
            min: minI2,
            max: maxI2,
            calculable: true,
            inRange: {
                color: ["#00ff9c", "#ffaa00", "#ff4d4d"]
            },
            textStyle: {color: "#fff"}
        },

        series: [

            // 🔵 All points
            {
                type: "scatter",
                data: surfaceData,
                symbolSize: function (val) {
                    return Math.abs(val[3]) * 10 + 10
                },
                itemStyle: {
                    color: "#00c8ff",
                    opacity: 0.6
                }
            },

            // 🔴 Latest point (highlighted)
            {
                type: "scatter",
                data: latestPoint ? [latestPoint] : [],
                symbolSize: 18,
                z: 100,
                itemStyle: {
                    color: "#ff3b3b"
                },
                label: {
                    show: true,
                    formatter: "Latest",
                    color: "#fff",
                    position: "top"
                }
            }

        ],
        graphic: [

            // top-right
            {
                type: "text",
                left: "75%",
                top: "15%",
                style: {
                    text: "Stable\n(+Gamma + Low Instability)",
                    fill: "#00ff9c",
                    font: "12px sans-serif",
                    textAlign: "center"
                }
            },

            // top-left
            {
                type: "text",
                left: "10%",
                top: "15%",
                style: {
                    text: "Transition\n(Flip Zone)",
                    fill: "#ffd700",
                    font: "12px sans-serif",
                    textAlign: "center"
                }
            },

            // bottom-left
            {
                type: "text",
                left: "10%",
                top: "75%",
                style: {
                    text: "Crash Risk\n(Short Gamma)",
                    fill: "#ff3b3b",
                    font: "12px sans-serif",
                    textAlign: "center"
                }
            },

            // bottom-right
            {
                type: "text",
                left: "75%",
                top: "75%",
                style: {
                    text: "Mean Reversion",
                    fill: "#00c8ff",
                    font: "12px sans-serif",
                    textAlign: "center"
                }
            },
            {
                type: "text",
                left: 20,
                top: 20,
                style: {
                    text:
                        `Green = Stable
Yellow = Transition
Red = Convexity Risk

Small bubbles = low impact
Large bubbles = high amplification`,
                    fill: "#ddd",
                    font: "12px monospace"
                }
            }

        ]

    })

}

async function renderInstabilityMap() {

    let res = await authFetch(`${API}/instability-map?source=${source}&db=${database}`)
    let data = await res.json()

    let points = data.map(d => {

        return {
            name: d.symbol, value: [d.distance, d.I1, d.I2, d.amp]
        }

    })

    // Normalize bubble size
    let maxAmp = Math.max(...points.map(p => Math.abs(p.value[3])))

    charts.instabilityMap.setOption({

        backgroundColor: "#111",

        title: {
            text: "Market Instability Map", textStyle: {color: "#fff"}
        },

        tooltip: {
            formatter: function (p) {

                return `
                ${p.name}<br>
                Flip Distance: ${p.value[0]}%<br>
                I1: ${p.value[1]}<br>
                I2: ${p.value[2]}<br>
                Amplification: ${p.value[3]}
                `
            }
        },

        xAxis: {
            name: "Distance from Gamma Flip (%)", type: "value"
        },

        yAxis: {
            name: "Linear Instability (I1)", type: "value"
        },

        visualMap: {

            dimension: 2, min: 0, max: 0.02,

            inRange: {
                color: ["#00ff9c", "#ffaa00", "#ff4d4d"]
            }

        },

        series: [{

            type: "scatter",

            data: points,

            symbolSize: function (v) {

                let normalized = Math.abs(v[3]) / maxAmp

                return 8 + normalized * 35

            },

            label: {

                show: true,

                formatter: function (p) {

                    if (Math.abs(p.value[0]) < 2) return p.name

                    return ""

                }

            }

        }]

    })

}

function renderMarketBanner(data) {

    if (!data || data.time.length === 0) return

    let spot = data.spot[data.spot.length - 1]
    let flip = data.gamma_flip[data.gamma_flip.length - 1]
    let time = data.time[data.time.length - 1]

    let regime = "UNKNOWN"
    let regimeClass = "banner-item"

    let distance = null

    if (spot && flip) {

        distance = (spot - flip).toFixed(2)

        if (spot > flip) {

            regime = "LONG GAMMA"
            regimeClass = "banner-long"

        } else {

            regime = "SHORT GAMMA"
            regimeClass = "banner-short"

        }

    }

    let banner = `
        <div class="${regimeClass}">Market Regime: ${regime}</div>
        <div class="banner-item">Spot: ${spot}</div>
        <div class="banner-item">Gamma Flip: ${flip}</div>
        <div class="banner-item">Distance: ${distance}</div>
        <div class="banner-item">Last Update: ${time} IST</div>
    `

    document.getElementById("marketBanner").innerHTML = banner

}

async function renderFlipZoneChart() {
    console.log('flipzone chart activated')

    let res = await authFetch(`${API}/flipzone?source=${source}&db=${database}`)

    let data = await res.json()

    if (!data || data.length === 0) return

    let stocks = data.map(x => x.symbol)

    let distances = data.map(x => x.distance_pct)
    // 👉 attach download button trigger
    window.flipzoneData = data

    charts.flipzone.setOption({

        backgroundColor: "#111",

        title: {
            text: "Stocks Near Gamma Flip ((+/-)2%)", textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: stocks, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Distance (%)", axisLabel: {color: "#fff"}
        },

        series: [{

            type: "bar",

            data: distances,

            itemStyle: {

                color: function (p) {

                    return p.value > 0 ? "#00ff9c" : "#ff4d4d"

                }

            }

        }]

    })

}

function renderIVSkew(index, spotSeries, flipSeries, latestChain) {

    charts.ivskew.clear()

    if (!ivHistory || ivHistory.length === 0) return

    let chain = ivHistory[index]
    if (!chain) return

    let data = []
    let strikes = []

    chain.forEach(opt => {

        if (!opt || opt.iv == null) return

        data.push([opt.strike, opt.iv])
        strikes.push(opt.strike)

    })

    if (strikes.length === 0) return

    let minStrike = Math.min(...strikes)
    let maxStrike = Math.max(...strikes)

    let spot = spotSeries ? spotSeries[index] : null
    let flip = flipSeries ? flipSeries[index] : null

    // Find strike with largest absolute gamma exposure
    let maxGexStrike = null

    if (latestChain) {

        let max = 0

        latestChain.forEach(o => {

            if (!o || o.net_gex == null) return

            if (Math.abs(o.net_gex) > max) {

                max = Math.abs(o.net_gex)
                maxGexStrike = o.strike

            }

        })

    }

    // build safe mark lines
    let lines = []

    if (spot != null) {
        lines.push({
            xAxis: spot,
            label: {formatter: "Spot", color: "#ffcc00"},
            lineStyle: {color: "#ffcc00", width: 2, type: "dashed"}
        })
    }

    if (flip != null) {
        lines.push({
            xAxis: flip, label: {formatter: "Gamma Flip", color: "#ff4d4d"}, lineStyle: {color: "#ff4d4d", width: 2}
        })
    }

    if (maxGexStrike != null) {
        lines.push({
            xAxis: maxGexStrike,
            label: {formatter: "Max GEX", color: "#00ff9c"},
            lineStyle: {color: "#00ff9c", width: 2}
        })
    }

    charts.ivskew.setOption({

        backgroundColor: "#111",

        title: {
            text: "IV Skew", textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "value", name: "Strike", min: minStrike - 2, max: maxStrike + 2, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "IV", axisLabel: {color: "#fff"},
            scale: true,
            boundaryGap: ['5%', '5%']

        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{

            type: "line", smooth: true, data: data,

            lineStyle: {
                width: 3, color: "#00c8ff"
            },


            markLine: {
                symbol: "none", label: {
                    show: true, position: "insideEndTop", fontWeight: "bold"
                }, data: lines
            }

        }]

    })

    document.getElementById("ivTimeLabel").innerText = "Snapshot: " + ivTimes[index]

}

function renderOptionStructure(index) {

    if (!ivHistory || ivHistory.length === 0) return

    let chain = ivHistory[index]

    if (!chain) return

    renderGammaLadder(chain)

    renderVega(chain)
    renderVegaExposure(chain)
    renderVanna(chain)
    renderOI(chain)
    renderOIChange(chain)
    renderGammaExposure(chain)
    renderDealerHeatmap(chain)
    renderGammaWallMap(chain)
    renderHedgingPressure(chain)

    document.getElementById("chainTimeLabel").innerText = "Snapshot: " + ivTimes[index]

}


function renderGammaExplosionRanking(data) {

    charts.gammaExplosionRanking.clear()
    console.log("Gamma Explosion RAW:", data, Array.isArray(data))

    if (!data || data.length === 0) {
        console.warn("No gamma explosion data")
        return
    }
    window.gammaExplosionData = data;

    // sort by explosion score
    data.sort((a, b) => b.gamma_explosion_score - a.gamma_explosion_score)
    console.log('gammaexp'+data)

    // labels with flip distance
    let symbols = data.map(x => {
    if (x.distance == null) return `${x.symbol} (NA)`
    let pct = x.distance_pct ?? 0
    return `${x.symbol} (${(pct * 100).toFixed(2)}%)`
})

    // normalize scores (log scale to avoid huge values)
   let scores = data.map(x => {
    let val = x.gamma_explosion_score
    if (!val || val <= 0) return 0
    return Math.log10(1 + val)
})

    charts.gammaExplosionRanking.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Explosion Ranking ((+/-)2% Flip)", left: "center", textStyle: {color: "#fff"}
        },

        grid: {
            left: 60, right: 20, top: 60, bottom: 120
        }, itemStyle: {
            color: function (params) {

                if (params.dataIndex === 0) return "#ff2b2b"   // strongest
                if (params.dataIndex === 1) return "#ff7a00"
                if (params.dataIndex === 2) return "#ffc400"

                return "#2ecc71"
            }
        },

        tooltip: {
            trigger: "axis", formatter: function (p) {
    let d = data[p[0].dataIndex]

    let dist = d.distance != null ? d.distance.toFixed(2) : "NA"

    return `
    ${d.symbol}<br>
    Flip Distance: ${dist}<br>
    Explosion Score: ${d.gamma_explosion_score?.toExponential(2) || "NA"}
    `
}
        },

        xAxis: {
            type: "category", data: symbols, axisLabel: {
                color: "#fff", rotate: 45
            }
        },

        yAxis: {
            type: "value", name: "log(GEX Gradient * GEX Gradient)-Base 10 is used", axisLabel: {color: "#fff"}
        },

        series: [{
            name: "Gamma Explosion", type: "bar", data: scores,

            barWidth: "50%",

            itemStyle: {

                color: function (params) {

                    let v = params.value

                    if (v > 18) return "#ff3b3b"
                    if (v > 16) return "#ff9f1a"
                    return "#2ecc71"

                }

            }

        }]

    })
}

function renderGammaSpatialGradient(index) {

    let chain = chainHistory[index]

    if (!chain || chain.length < 3) return

    let strikes = []
    let gex = []

    chain.forEach(o => {

        if (o.net_gex == null) return

        strikes.push(o.strike)
        gex.push(o.net_gex)

    })

    let gradient = []

    for (let i = 1; i < gex.length - 1; i++) {

        let d = (gex[i + 1] - gex[i - 1]) / (strikes[i + 1] - strikes[i - 1])

        gradient.push(d)

    }

    charts.gammaSpatial.setOption({

        backgroundColor: "#111",

        title: {
            text: "Spatial GEX Gradient (Gamma Cliffs)", textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "category", data: strikes.slice(1, -1), axisLabel: {color: "#fff"}
        },
        tooltip: {trigger: "axis"},

        yAxis: {
            type: "value", axisLabel: {color: "#fff"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{
            type: "line", data: gradient, smooth: true
        }],
         graphic: [
            // 🔵 Title Guide
            {
                type: "text",
                left: "15%",
                top: "5%",
                z: 100,
                style: {
                    text:
                        `
It measures how dealer gamma exposure changes as price moves through different levels.
Gamma Cliff = Flow Shock Zone
When price approaches a gamma cliff:
Before the Cliff-Hedging is relatively stable.Market behaves normally.
At the Cliff-Tiny price move => huge change in GEX.Dealers must rapidly rebalance.
Liquidity gets stressed.After Crossing-Market enters a new regime.
Often: Volatility expansion and Directional acceleration.
Sign Matters (Very Important)
Positive Gradient-Moving up => GEX increases.Dealers become more long gamma.
Effect:Increasing stabilization and Volatility compression ahead.
Negative Gradient-Moving up => GEX decreases.Dealers become more short gamma.
Effect: Increasing instability and Higher chance of sharp moves/squeezes.
-Connection to Gamma Flip-Gamma cliffs often sit near:Gamma flip zones,
Large OI strikes, Expiry pinning levels.
Crossing a cliff can mean:Long gamma => short gamma transition
Or vice versa.
`,
                    fill: "#ddd",
                    font: "12px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            }

        ]

    })
}

function renderGammaConvexity(index) {

    let chain = chainHistory[index]


    if (!chain || chain.length < 3) return

    let strikes = []
    let gex = []

    chain.forEach(o => {

        if (o.net_gex == null) return

        strikes.push(o.strike)
        gex.push(o.net_gex)

    })

    let convexity = []

    for (let i = 1; i < gex.length - 1; i++) {

        let d2 = gex[i + 1] - 2 * gex[i] + gex[i - 1]

        convexity.push(d2)

    }

    charts.gammaConvexity.setOption({

        backgroundColor: "#111",

        title: {
            text: "Convexity Instability  (Second derivative of GEX w.r.t S)", textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "category", data: strikes.slice(1, -1), axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", axisLabel: {color: "#fff"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],
        tooltip: {trigger: "axis"},

        series: [{
            type: "bar", data: convexity
        }],
        graphic: [
            // 🔵 Title Guide
            {
                type: "text",
                left: "15%",
                top: "5%",
                z: 100,
                style: {
                    text:
                        `
It tells you whether hedging flows are becoming
more aggressive or fading as price moves.
1. Positive Second Derivative-Convex GEX curve
Implication:
As price moves => hedging pressure accelerates in same direction.
Feedback loop strengthens
Market Behavior:Increasing instability,Stronger squeezes,Trend reinforcement.
This is where convexity instability (I2 > 0) shows up.
2. Negative Second Derivative
Concave GEX curve -Implication:
Hedging pressure decelerates.System absorbs shocks
Market Behavior:Mean reversion,Vol suppression,Stabilizing flows
3. Near Zero Second Derivative
Linear regime -Hedging flows change at constant rate,
No nonlinear feedback, Predictable behavior
`,
                    fill: "#ddd",
                    font: "12px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            }

        ]

    })
}

function renderGammaTemporal(index) {

    if (index === 0) return

    let chainNow = chainHistory[index]
    let chainPrev = chainHistory[index - 1]

    if (!chainNow || !chainPrev) return

    // 🔥 Build strike map for previous chain
    let prevMap = {}

    chainPrev.forEach(o => {
        if (o && o.strike != null && o.net_gex != null) {
            prevMap[o.strike] = o.net_gex
        }
    })

    let temporal = []
    let strikes = []

    chainNow.forEach(o => {

        if (!o || o.strike == null || o.net_gex == null) return

        let prev = prevMap[o.strike]

        // 🔥 STRICT MATCH (no fake zeros)
        if (prev == null) return

        let delta = o.net_gex - prev

        temporal.push(delta)
        strikes.push(o.strike)

    })

    charts.gammaTemporal.setOption({

        backgroundColor: "#111",

        title: {
            text: "Temporal GEX Gradient (Gamma-Time Compression) - Color Proxy",
            textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category",
            data: strikes,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            axisLabel: {color: "#fff"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{
            type: "bar",
            data: temporal,
            itemStyle: {
                color: function (p) {
                    return p.value >= 0 ? "#00ff9c" : "#ff4d4d"
                }
            }
        }],
        graphic: [
            // 🔵 Title Guide
            {
                type: "text",
                left: "15%",
                top: "5%",
                z: 100,
                style: {
                    text:
                        `
It measures how fast the dealer hedging regime is evolving as time passes—mainly due to theta decay, expiry roll-down,
and OI redistribution.
Why GEX Changes With Time?Even if spot stays constant, GEX changes because: Theta decay-Options
lose extrinsic value.
Gamma profile reshapes (especially near ATM)-Expiry approach-Near-expiry gamma becomes very sharp
and concentrated-OI migration.Traders roll positions → reshaping GEX surface
Interpretation of d(GEX)/dt.
1. Positive Temporal Gradient-GEX is increasing over time,Implication:Market becoming more long
gamma,Dealers hedge more passively.Market Behavior:Volatility compression,Stronger pinning,
Reduced realized vol.
2. Negative Temporal Gradient-GEX is decreasing over time Implication:Market moving toward short gamma regime
Market Behavior:Vol expansion,Increasing fragility,Higher probability of large moves.
Microstructure Interpretation-
1. Hedging Regime Drift-Even without price movement:Dealers must continuously rebalance Because gamma sensitivity itself is changing.
2. Intraday Instability Source - Temporal gradient creates:Instability without price movement
This is critical:Market can suddenly start moving even after being quiet .Because the hedging landscape has shifted underneath.
3. Pre-Expiry Effects-As expiry approaches:Gamma becomes:More localized (ATM spike) and More unstable
Leads to:Pinning -> then sudden release or Compression -> expansion cycles.
--Key Trading Signals--
Rapidly Negative -Market losing stability fast.Expect:Breakouts or Vol expansion. Very common
before:Large intraday moves and Post-lunch expansions.
Rapidly Positive -Market becoming pinned
Expect:Range-bound action or IV crush.
Sign Flip-
Strong signal of:Regime transition or Flow realignment.
`,
                    fill: "#ddd",
                    font: "8px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            }

        ]
    })
}

function renderGammaShockSpeed(index) {

    if (index === 0) return

    let chainNow = chainHistory[index]
    let chainPrev = chainHistory[index - 1]

    if (!chainNow || !chainPrev) return

    // 🔥 Create map for previous chain
    let prevMap = {}

    chainPrev.forEach(o => {
        if (o && o.strike != null && o.net_gex != null) {
            prevMap[o.strike] = o.net_gex
        }
    })

    let strikes = []
    let shock = []

    for (let i = 1; i < chainNow.length - 1; i++) {

        let curr = chainNow[i]
        let left = chainNow[i - 1]
        let right = chainNow[i + 1]

        if (!curr || !left || !right) continue

        let g1 = curr.net_gex
        let g0 = left.net_gex
        let g2 = right.net_gex

        // 🔥 SAFE previous lookup
        let gPrev = prevMap[curr.strike]

        if (
            g1 == null || g0 == null || g2 == null ||
            gPrev == null
        ) continue

        let d2 = g2 - 2 * g1 + g0
        let dt = g1 - gPrev

        let shockSpeed = Math.abs(dt) * Math.abs(d2)

        strikes.push(curr.strike)
        shock.push(shockSpeed)
    }

    charts.gammaShock.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Shock Speed",
            textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "category",
            data: strikes,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            name: "Shock Speed",
            axisLabel: {color: "#fff"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],
        tooltip: {trigger: "axis"},

        series: [{
            type: "bar",
            data: shock,
            itemStyle: {
                color: "#ff2b2b"
            }
        }]
    })
}

// function renderGammaShockSpeed(index) {
//
//     if (index === 0) return
//
//     let chainNow = chainHistory[index]
//     let chainPrev = chainHistory[index - 1]
//
//     if (!chainNow || !chainPrev || chainNow.length < 3) return
//
//     let strikes = []
//     let shock = []
//
//     for (let i = 1; i < chainNow.length - 1; i++) {
//
//         let g2 = chainNow[i + 1].net_gex
//         let g1 = chainNow[i].net_gex
//         let g0 = chainNow[i - 1].net_gex
//
//         let gPrev = chainPrev[i].net_gex
//
//         if (g2 == null || g1 == null || g0 == null || gPrev == null) continue
//
//         // spatial convexity
//         let d2 = g2 - 2 * g1 + g0
//
//         // temporal gradient
//         let dt = g1 - gPrev
//
//         let shockSpeed = Math.abs(dt) * Math.abs(d2)
//
//         strikes.push(chainNow[i].strike)
//         shock.push(shockSpeed)
//
//     }
//
//     charts.gammaShock.setOption({
//
//         backgroundColor: "#111",
//
//         title: {
//             text: "Gamma Shock Speed", textStyle: {color: "#fff"}
//         },
//
//         tooltip: {
//             trigger: "axis"
//         },
//
//         xAxis: {
//             type: "category", data: strikes, axisLabel: {color: "#fff"}
//         },
//
//         yAxis: {
//             type: "value", name: "Shock Speed", axisLabel: {color: "#fff"}
//         },
//
//         series: [{
//             type: "bar", data: shock, itemStyle: {
//                 color: "#ff2b2b"
//             }
//         }]
//
//     })
// }

function renderGammaVegaCoupling() {

    charts.gammaVegaCoupling.clear()

    if (!chainHistory || chainHistory.length < 2) return

    let values = []
    let times = []

    for (let t = 1; t < chainHistory.length; t++) {

        let chain = chainHistory[t]
        let prevChain = chainHistory[t - 1]

        if (!chain || !prevChain) continue

        // total vega
        let totalVega = 0

        chain.forEach(o => {

            let netOI = (o.call_oi || 0) - (o.put_oi || 0)

            totalVega += (o.vega || 0) * netOI

        })

        // IV change
        let ivNow = chain.reduce((a, o) => a + (o.iv || 0), 0) / chain.length
        let ivPrev = prevChain.reduce((a, o) => a + (o.iv || 0), 0) / prevChain.length

        let dIV = ivNow - ivPrev

        // approximate gamma shock
        let gammaShock = 0

        for (let i = 1; i < chain.length - 1; i++) {

            let g2 = chain[i + 1].net_gex
            let g1 = chain[i].net_gex
            let g0 = chain[i - 1].net_gex

            if (g2 == null || g1 == null || g0 == null) continue

            gammaShock += Math.abs(g2 - 2 * g1 + g0)

        }

        let coupling = Math.abs(gammaShock) * Math.abs(totalVega * dIV)


        values.push(coupling)
        // attach timestamp
        times.push(ivTimes[t])

    }
    // console.log(times)

    charts.gammaVegaCoupling.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Vega Coupling Index \n Coupling Index=abs(Gamma Shock Speed) x abs(Total Vega x del(IV))",
            left: "center",
            textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: times, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Coupling Strength", axisLabel: {color: "#fff"}
        },

        series: [{

            type: "line",

            smooth: true,

            data: values,

            lineStyle: {
                width: 3, color: "#ff2b2b"
            },

            areaStyle: {
                opacity: 0.25
            }

        }]

    })

}

function generateCirclePoints(radius) {

    let points = []
    let steps = 100

    for (let i = 0; i <= steps; i++) {

        let theta = (i / steps) * 2 * Math.PI

        let x = radius * Math.cos(theta)
        let y = radius * Math.sin(theta)

        points.push([x, y])
    }

    return points
}

function renderGammaVegaPhaseDiagram() {

    charts.gammaVegaPhase.clear()


    if (!chainHistory || chainHistory.length < 2) return

    let data = []

    for (let t = 1; t < chainHistory.length; t++) {

        let chain = chainHistory[t]
        let prevChain = chainHistory[t - 1]

        if (!chain || !prevChain) continue

        // ----- Total Vega -----
        let totalVega = 0

        chain.forEach(o => {

            let netOI = (o.call_oi || 0) - (o.put_oi || 0)

            totalVega += (o.vega || 0) * netOI

        })

        // ----- IV Change -----
        let ivNow = chain.reduce((a, o) => a + (o.iv || 0), 0) / chain.length

        let ivPrev = prevChain.reduce((a, o) => a + (o.iv || 0), 0) / prevChain.length

        let dIV = ivNow - ivPrev

        let vegaPressure = totalVega * dIV

        // ----- Gamma Shock (spatial convexity) -----
        let gammaShock = 0

        for (let i = 1; i < chain.length - 1; i++) {

            let g2 = chain[i + 1].net_gex
            let g1 = chain[i].net_gex
            let g0 = chain[i - 1].net_gex

            if (g2 == null || g1 == null || g0 == null) continue

            gammaShock += (g2 - 2 * g1 + g0)

        }
        // ----- VALIDATION -----
        if (!isFinite(gammaShock) || !isFinite(vegaPressure)) continue

        if (!ivTimes || !ivTimes[t]) continue

        data.push({
            value: [gammaShock, vegaPressure],
            time: ivTimes[t]
        })


    }

    let maxAbsX = Math.max(...data.map(d => Math.abs(d.value[0])))
    let maxAbsY = Math.max(...data.map(d => Math.abs(d.value[1])))
    let magnitudes = data.map(d => {
        let g = d.value[0]
        let v = d.value[1]
        return Math.sqrt(g * g + v * v)
    })
    let latest = data[data.length - 1]

    let latestMag = Math.sqrt(
        latest.value[0] * latest.value[0] +
        latest.value[1] * latest.value[1]
    )


// choose threshold (e.g. 80th percentile)
    let sorted = [...magnitudes].sort((a, b) => a - b)
    let threshold = sorted[Math.floor(sorted.length * 0.8)]
    let isDanger = latestMag > threshold
    let R = Math.sqrt(
        latest.value[0] ** 2 + latest.value[1] ** 2
    )
    let inner = 0.5 * threshold     // 🟢 stable
    let outer = threshold
    let regime =
        R < inner ? "innre - STABLE" :
            R < outer ? "on circumference - TRANSITION" :
                "outer - INSTABILITY"
    // 🔴 boundary

    charts.gammaVegaPhase.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Vega Phase Diagram", left: "center", textStyle: {color: "#fff"}
        },

        tooltip: {
            formatter: function (p) {
                if (!p.value) return ""

                let g = p.value[0]
                let v = p.value[1]

                let regime = ""

                if (g > 0 && v > 0) regime = "Stable Market"
                if (g > 0 && v < 0) regime = "Volatility Suppression"
                if (g < 0 && v > 0) regime = "Trend + Vol Expansion"
                if (g < 0 && v < 0) regime = "Convexity Cascade"

                return `
        Time: ${p.data.time}<br>
        Gamma Shock: ${p.value[0].toFixed(2)}<br>
        Vega Pressure: ${p.value[1].toFixed(2)}<br>
        `
            }
        },


        xAxis: {
            type: "value",
            min: -maxAbsX * 1.2,
            max: maxAbsX * 1.2,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            min: -maxAbsY * 1.2,
            max: maxAbsY * 1.2,
            axisLabel: {color: "#fff"}
        },

        series: [

            {
                type: "scatter",
                data: data,
                symbolSize: function (val, params) {
                    return params.dataIndex === data.length - 1 ? 16 : 8
                },
                itemStyle: {
                    color: "#00c8ff",
                    opacity: 0.6
                },
                markLine: {
                    symbol: "none",
                    lineStyle: {color: "#888", type: "dashed"},
                    data: [{xAxis: 0}, {yAxis: 0}]
                }
            },

            // 🔴 explicit latest point
            {
                type: "scatter",
                data: [latest],
                symbolSize: 22,
                z: 100,
                zlevel: 10,

                itemStyle: {
                    color:
                        R < inner ? "#00ff9c" :
                            R < outer ? "#ffd700" :
                                "#ff3b3b",
                    shadowBlur: 20,
                    shadowColor:
                        R < inner ? "#00ff9c" :
                            R < outer ? "#ffd700" :
                                "#ff3b3b"
                },

                label: {
                    show: true,
                    formatter: regime,
                    color: "#fff",
                    position: "top",
                    fontWeight: "bold"
                }
            },
            {
                type: "line",
                data: generateCirclePoints(threshold),
                smooth: true,
                showSymbol: false,
                lineStyle: {
                    color: "#ff4d4d",
                    width: 2,
                    type: "dashed"
                },
                z: 5
            }

        ],

        graphic: [

            {
                type: "text", left: "70%", top: "15%", style: {
                    text: "Stable Market\n(+Gamma, +Vega)",
                    fill: "#00ff9c",
                    font: "14px sans-serif",
                    textAlign: "center"
                }
            },

            {
                type: "text", left: "70%", top: "70%", style: {
                    text: "Volatility Suppression\n(+Gamma, -Vega)",
                    fill: "#ffaa00",
                    font: "14px sans-serif",
                    textAlign: "center"
                }
            },

            {
                type: "text", left: "15%", top: "15%", style: {
                    text: "Trend + Vol Expansion\n(-Gamma, +Vega)",
                    fill: "#00c8ff",
                    font: "14px sans-serif",
                    textAlign: "center"
                }
            },

            {
                type: "text", left: "15%", top: "70%", style: {
                    text: "Convexity Cascade\n(-Gamma, -Vega)",
                    fill: "#ff4d4d",
                    font: "14px sans-serif",
                    textAlign: "center"
                }
            },
            {
                type: "text",
                left: 20,
                top: 20,
                z: 100,
                style: {
                    text:
                        `Stable - Mean Reversion
Transition - Watch
Instability - Breakout`,
                    fill: "#ddd",
                    font: "12px monospace"
                }
            }

        ]

    })

}

function renderVanna(chain) {

    charts.vanna.clear()

    if (!chain || chain.length === 0) return

    let strikes = []
    let vannaExp = []

    chain.forEach(o => {

        let netOI = (o.call_oi || 0) - (o.put_oi || 0)

        let delta = Math.abs(o.call_delta || 0)

        let vanna = (o.vega || 0) * (1 - delta)

        let exposure = vanna * netOI

        strikes.push(o.strike)
        vannaExp.push(exposure)

    })

    charts.vanna.setOption({

        backgroundColor: "#111",

        title: {
            text: "Vanna Exposure: Vanna = Vega x (1 - abs(Delta)) and Vanna Exposure = Vanna x Net OI",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Vanna Exposure", axisLabel: {color: "#fff"}
        },

        dataZoom: [{type: "inside"}, {type: "slider"}],

        series: [{

            type: "bar",

            data: vannaExp,

            itemStyle: {
                color: function (p) {

                    return p.value >= 0 ? "#00c8ff" : "#ff4d4d"
                }
            }

        }],
        graphic: [
            // 🔵 Title Guide
            {
                type: "text",
                left: "15%",
                top: "10%",
                z: 100,
                style: {
                    text:
                        `--vanna = d(delta)/d(iv)
--Positive Vanna Exposure (VEX > 0)
When IV rises => delta increases
Dealers: Become longer delta. Need to sell underlying to hedge.
When IV falls => delta decreases. Dealers need to buy underlying
Result:Vol up => market gets selling pressure and Vol down => market gets buying support
->This is mean-reverting / stabilizing
--Negative Vanna Exposure (VEX < 0)
When IV rises => delta decreases. Dealers:Become short delta. Need to buy underlying.
When IV falls => delta increases.Dealers need to sell underlying
Result:Vol up => market gets buying (squeeze) and Vol down => market gets selling
->This is trend-amplifying / destabilizing`,
                    fill: "#e4de09",
                    font: "12px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            }

        ]

    })

}

function renderDealerFlow() {

    charts.dealerFlow.clear()

    if (!chainHistory || chainHistory.length < 2) return

    let flow = []
    let times = ivTimes.slice(1)

    for (let t = 1; t < chainHistory.length; t++) {

        let chain = chainHistory[t]
        let prevChain = chainHistory[t - 1]

        if (!chain || !prevChain) continue

        // price move
        let dS = spotSeries[t] - spotSeries[t - 1]

        // IV change
        let ivNow = chain.reduce((a, o) => a + (o.iv || 0), 0) / chain.length

        let ivPrev = prevChain.reduce((a, o) => a + (o.iv || 0), 0) / prevChain.length

        let dIV = ivNow - ivPrev

        let gammaFlow = 0
        let vannaFlow = 0

        chain.forEach(o => {

            let netOI = (o.call_oi || 0) - (o.put_oi || 0)

            let gamma = (o.gamma || 0)

            let delta = Math.abs(o.call_delta || 0)

            let vanna = (o.vega || 0) * (1 - delta)

            gammaFlow += gamma * netOI * dS
            vannaFlow += vanna * netOI * dIV

        })

        flow.push(gammaFlow + vannaFlow)

    }

    charts.dealerFlow.setOption({

        backgroundColor: "#111",

        title: {
            text: "Dealer Hedging Flow : Dealer Flow =(Gamma . del(S)) + (Vanna . del(IV))", textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: times, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Flow", axisLabel: {color: "#fff"}
        },

        series: [{

            type: "bar",

            data: flow,

            itemStyle: {
                color: function (p) {

                    return p.value >= 0 ? "#00ff9c" : "#ff4d4d"
                }
            }

        }]

    })


}

function renderVannaFlow() {

    charts.vannaFlow.clear()

    if (!chainHistory || chainHistory.length < 2) return

    let flow = []
    let times = ivTimes.slice(1)

    for (let t = 1; t < chainHistory.length; t++) {

        let chain = chainHistory[t]
        let prevChain = chainHistory[t - 1]

        if (!chain || !prevChain) continue

        // ----- total vanna -----
        let totalVanna = 0

        chain.forEach(o => {

            let netOI = (o.call_oi || 0) - (o.put_oi || 0)

            let delta = Math.abs(o.call_delta || 0)

            let vanna = (o.vega || 0) * (1 - delta)

            totalVanna += vanna * netOI

        })

        // ----- IV change -----
        let ivNow = chain.reduce((a, o) => a + (o.iv || 0), 0) / chain.length

        let ivPrev = prevChain.reduce((a, o) => a + (o.iv || 0), 0) / prevChain.length

        let dIV = ivNow - ivPrev

        let vannaFlow = totalVanna * dIV

        flow.push(vannaFlow)

    }

    charts.vannaFlow.setOption({

        backgroundColor: "#111",

        title: {
            text: "Vanna Flow Indicator", textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category", data: times, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Vanna Flow", axisLabel: {color: "#fff"}
        },

        series: [{

            type: "bar",

            data: flow,

            itemStyle: {
                color: function (p) {

                    return p.value >= 0 ? "#00c8ff" : "#ff4d4d"
                }
            }

        }]

    })

}

function renderGammaVannaSurface() {

    charts.gammaVannaSurface.clear()

    if (!chainHistory || chainHistory.length === 0) return

    let strikeSet = new Set()

    chainHistory.forEach(chain => {

        if (!chain) return

        chain.forEach(o => {
            strikeSet.add(o.strike)
        })

    })

    let strikeList = Array.from(strikeSet).sort((a, b) => a - b)

    let strikeIndex = {}
    strikeList.forEach((s, i) => strikeIndex[s] = i)

    let data = []

    chainHistory.forEach((chain, t) => {

        if (!chain) return

        chain.forEach(o => {

            let netOI = (o.call_oi || 0) - (o.put_oi || 0)

            let delta = Math.abs(o.call_delta || 0)

            let vanna = (o.vega || 0) * (1 - delta)

            let exposure = vanna * netOI

            data.push([strikeIndex[o.strike], t, exposure])

        })

    })

    charts.gammaVannaSurface.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Vanna Surface", textStyle: {color: "#fff"}
        },

        tooltip: {
            formatter: function (p) {

                let strike = strikeList[p.value[0]]
                let time = ivTimes[p.value[1]]

                return `
                Strike: ${strike}<br>
                Time: ${time}<br>
                Vanna Exposure: ${p.value[2].toFixed(2)}
                `
            }
        },

        xAxis: {
            type: "category", name: "Strike", data: strikeList, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "category", name: "Time", data: ivTimes, axisLabel: {color: "#fff"}
        },
         dataZoom: [{type: "inside"}, {type: "slider"}],

        visualMap: {
            min: -50000,
            max: 50000,
            calculable: true,
            orient: "vertical",
            right: 10,
            top: "center",
            textStyle: {color: "#fff"},
            inRange: {
                color: ["#ff4d4d", "#222", "#00c8ff"]
            }
        },


        series: [{
            type: "heatmap", data: data
        }]

    },)

}

function renderDealerConvexitySurface() {

    charts.dealerConvexitySurface.clear()

    if (!chainHistory || chainHistory.length === 0) return

    let data = []

    chainHistory.forEach((chain, t) => {

        if (!chain) return

        chain.forEach(o => {

            let netOI = (o.call_oi || 0) - (o.put_oi || 0)

            let gammaExposure = (o.gamma || 0) * netOI

            let delta = Math.abs(o.call_delta || 0)

            let vanna = (o.vega || 0) * (1 - delta)

            let vannaExposure = vanna * netOI

            let convexity = gammaExposure + vannaExposure

            data.push([o.strike, t, convexity])

        })

    })

    charts.dealerConvexitySurface.setOption({

        backgroundColor: "#111",

        title: {
            text: "Dealer Convexity Surface (Gamma + Vanna)", textStyle: {color: "#fff"}
        },

        tooltip: {
            formatter: function (p) {

                return `
                Strike: ${p.value[0]}<br>
                Time: ${ivTimes[p.value[1]]}<br>
                Convexity: ${p.value[2].toFixed(2)}
                `
            }
        },

        xAxis3D: {
            type: "value", name: "Strike", axisLabel: {color: "#fff"}
        },

        yAxis3D: {
            type: "value", name: "Time", axisLabel: {color: "#fff"}
        },

        zAxis3D: {
            type: "value", name: "Dealer Convexity", axisLabel: {color: "#fff"}
        },

        grid3D: {
            viewControl: {
                projection: "perspective"
            }, light: {
                main: {intensity: 1.2}, ambient: {intensity: 0.3}
            }
        },

        visualMap: {
            min: -100000, max: 100000, calculable: true, inRange: {
                color: ["#ff4d4d", "#222", "#00c8ff"]
            }
        },

        series: [{

            type: "scatter3D",

            data: data,

            symbolSize: 4

        }]

    })

}


function renderConvexityRadar(data) {

    charts.convexityRadar.clear()

    if (!data || data.length === 0) return

    let indicators = [

        {name: "Gamma Instability", max: 1}, {name: "Vanna Pressure", max: 1}, {
            name: "Dealer Flow",
            max: 1
        }, {name: "Flip Distance", max: 1}, {name: "Shock Speed", max: 1}

    ]

    let series = data.map(d => {

        return {

            name: d.symbol,

            value: [d.gamma_instability, d.vanna_pressure, d.dealer_flow, d.flip_distance, d.shock_speed]

        }

    })
    window.convexityRadarData = data;

    charts.convexityRadar.setOption({

        backgroundColor: "#111",

        title: {
            text: "Convexity Radar", textStyle: {color: "#fff"}
        },

        tooltip: {},

        radar: {
            indicator: indicators,
            radius: "75%",
            center: ["50%", "55%"],
            axisName: {color: "#fff"},
            splitLine: {lineStyle: {color: "#444"}},
            splitArea: {areaStyle: {color: ["#111", "#181818"]}}
        },

        series: [{

            type: "radar",

            data: series,

            lineStyle: {width: 2},

            areaStyle: {
                opacity: 0.2
            }

        }]

    })

}


/*---------------Snapshot Tab..................*/
function renderSnapshotsUI() {

    if (!snapshotState.all || snapshotState.all.length === 0) {
        console.warn("No snapshots to render")
        return
    }

    const slider = document.getElementById("snapshotSlider")

    if (!slider) {
        console.warn("Slider not ready yet")
        return
    }

    initSnapshotSlider()
    updateSnapshotSlider()
    renderCurrentSnapshot()
}

function loadSnapshots(dataArray) {

    if (!Array.isArray(dataArray)) {
        console.error("Invalid snapshot data:", dataArray)
        return
    }

    let flat = []

    dataArray.forEach(item => {

        if (item.timestamp) {
            flat.push(item)
        } else if (Array.isArray(item)) {
            flat.push(...item)
        } else if (typeof item === "object") {
            Object.values(item).forEach(v => {
                if (v && v.timestamp) flat.push(v)
            })
        }
    })

    console.log("After flatten:", flat)

    snapshotState.all = flat.map(s => ({
        ...(s.data || {}),
        timestamp: s.timestamp,
        stock_id: s.stock_id || s.data?.stock_id
    }))

    snapshotState.all.sort(
        (a, b) => new Date(Number(a.timestamp) * 1000) - new Date(Number(b.timestamp) * 1000)
    )

    console.log("Final normalized:", snapshotState.all)
}


async function fetchSnapshot() {

    try {

        const res = await authFetch(`${API}/latest/${activeStock}?source=${source}&dataset=${database}`)
        const json = await res.json()
        console.log("json.data =", json.data)

        if (!res.ok || json.error || !json.data) {
            console.error("Invalid snapshot")
            return []
        }
        const data = json.data || json

// renderDebugTable(data)   // 🔥 ADD THIS

// return [data]


        return [json.data]   // ✅ THIS FIXES EVERYTHING

    } catch (err) {
        console.error(err)
        return []
    }
}

//--------------------------------------------------
// 🌐 LOAD STOCK UNIVERSE (FROM BACKEND)
//--------------------------------------------------
async function loadStocksFromAPI() {
    try {
        const res = await authFetch(`${API}/liststocks`)
        const data = await res.json()

        universe.clear()

        data.forEach(stock => {

            // 🔥 Normalize + store full object
            const normalized = {
                symbol: stock.symbol,
                id: stock.id || null,
                lotSize: stock.lot_size || null,
                securityId: stock.security_id || null,

                // 👉 keep raw as fallback (important)
                raw: stock
            }

            universe.set(stock.symbol, normalized)
        })

        console.log("🌐 Universe loaded:", [...universe.values()])

        // ✅ render if needed
        RealtimeRenderer.renderUniverseUI(universe)

    } catch (err) {
        console.error("❌ Failed to load stocks:", err)
    }
}
let isRealtimeInitialized = false;
function switchTab(tabId, el) {
    console.log('Active Stock:' + activeStock)
    RealtimeRenderer.stopQuotePolling()

    // remove active from all tabs
    document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.remove("active")
    })

    // remove active from all contents
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active")
    })

    // activate selected tab
    document.getElementById(tabId).classList.add("active")
    el.classList.add("active")

    // -----------------------------
    // 🔥 REALTIME CONTROL
    // -----------------------------
    if (tabId === "realtimeTab") {

    if (!isRealtimeInitialized) {

        RealtimeRenderer.initRealtimeChart("realtimeChartContainer")
        loadStocksFromAPI()
        RealtimeRenderer.initSearch(universe)

        isRealtimeInitialized = false;
    }
}

    // -----------------------------
    // 🔥 LOAD SNAPSHOTS ON DEMAND
    // -----------------------------
    if (tabId === "snapshotsTab") {

        if (!snapshotState.all.length) return

        setTimeout(() => {
            renderSnapshotsUI()
        }, 0)
    }


    // -----------------------------
    // Resize charts (important)
    // -----------------------------
    setTimeout(() => {
        Object.values(charts).forEach(chart => {
            if (chart && chart.resize) {
                chart.resize()
            }
        })
    }, 200)
}

async function loadSnapshotsForStock(stock) {

    if (!stock) return

    console.log("Fetching snapshots for:", stock)

    const data = await fetchSnapshot()

    if (!data || data.length === 0) {
        console.warn("No snapshots found")
        return
    }

    loadSnapshots(data)

    // 🔥 Always point to latest snapshot
    snapshotState.currentIndex = snapshotState.all.length - 1

    // 🔥 Render ONLY if snapshots tab is active
    if (document.getElementById("snapshotsTab").classList.contains("active")) {

        setTimeout(() => {
            renderSnapshotsUI()
        }, 0)

    }
}

/*************Realtime*******************/
async function loadRealtimeData() {

    if (!activeStock) return

        try {
            initRealtimeChart()

              // load history first
            const res = await fetch(`${API}/ohlc/${activeStock}`)
            const history = await res.json()

            setInitialCandles(history)

            // start streaming
            startRealtimePolling(`${API}/realtime-candle/${activeStock}`)

        } catch (err) {
            console.error("Realtime error:", err)
    }
}

function startRealtime() {

    if (realtimeInterval) return  // already running

    console.log("▶️ Starting realtime stream")

    loadRealtimeData() // immediate call

    realtimeInterval = setInterval(() => {
        loadRealtimeData()
    }, 2000) // 🔁 every 2 sec (tune this)
}

function stopRealtime() {

    if (realtimeInterval) {
        console.log("⏹️ Stopping realtime stream")
        clearInterval(realtimeInterval)
        realtimeInterval = null
    }
}

/* ---------- Initialization ---------- */

function initDashboard() {

    initCharts()
    loadStocks()
    renderInstabilityMap()
    console.log("Dashboard loaded")

}



async function authFetch(url) {

    // console.log('token:'+window.FIREBASE_TOKEN);
    const token = await getFreshToken()

    return fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })

}

function reloadAll() {

    console.log("Reloading → Source:", source, "Dataset:", database)

    loadStocks()

    if (activeStock) {
        loadStock(activeStock)
    }

    renderInstabilityMap()
    loadConvexityRadar()
}

window.downloadflipZoneCSV = function(data) {
    if (!data || data.length === 0) return;

    let csv = "Symbol,Distance (%)\n";

    data.forEach(row => {
        csv += `${row.symbol},${row.distance_pct}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "flipzone_data.csv";
    link.click();

    URL.revokeObjectURL(url);
}
window.downloadConvexityRadarCSV = function(data) {
    if (!data || data.length === 0) return;

    let csv = "Symbol,Gamma Instability,Vanna Pressure,Dealer Flow,Flip Distance,Shock Speed\n";

    data.forEach(d => {
        csv += [
            d.symbol,
            d.gamma_instability,
            d.vanna_pressure,
            d.dealer_flow,
            d.flip_distance,
            d.shock_speed
        ].join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `convexity_radar_${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
};
window.downloadGammaExplosionCSV = function(data) {
    if (!data || data.length === 0) return;

    // 👉 sort exactly like chart (important for consistency)
    let sorted = [...data].sort(
        (a, b) => b.gamma_explosion_score - a.gamma_explosion_score
    );

    let csv = "Rank,Symbol,Distance,Distance (%),Raw Score,Log Score\n";

    sorted.forEach((d, i) => {

        let raw = d.gamma_explosion_score || 0;

        let logScore = (raw > 0) ? Math.log10(1 + raw) : 0;

        let distance = (d.distance != null) ? d.distance : "NA";

        let pct = (d.distance_pct != null)
            ? (d.distance_pct * 100).toFixed(2)
            : "NA";

        csv += [
            i + 1,
            d.symbol,
            distance,
            pct,
            raw,
            logScore.toFixed(4)
        ].join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `gamma_explosion_${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
};

document.addEventListener("DOMContentLoaded", function () {

    // -------------------------
    // 🔧 STATE INIT
    // -------------------------
    let sourceSelect = document.getElementById("sourceSelect")
    if (sourceSelect) {

    // Remove disallowed options in production
    if (!isLocalhost) {
        [...sourceSelect.options].forEach(option => {
            if (option.value === "mongo" || option.value === "firebase") {
                option.remove()
            }
        })
    }
}
    let dbSelect = document.getElementById("dbSelect")

    // restore state
    source = localStorage.getItem("source") || "mongo"
    database = localStorage.getItem("dataset") || "raw"

    if (sourceSelect) sourceSelect.value = source
    if (dbSelect) dbSelect.value = database

    // disable dataset if mongo
//    if (source === "mongo" && dbSelect) {
//        dbSelect.disabled = true
//    }

    // -------------------------
    // 📦 STOCK SELECTOR
    // -------------------------
    let stockSelect = document.getElementById("stockSelect")

    if (stockSelect) {
        stockSelect.addEventListener("change", function () {

            if (!this.value) return

            activeStock = this.value
            localStorage.setItem("selectedStock", activeStock)

            loadStock(activeStock)
        })
    }

    // -------------------------
    // 🎚️ IV SLIDER
    // -------------------------
    let ivSlider = document.getElementById("ivSlider")

    if (ivSlider) {
        ivSlider.addEventListener("input", function () {

            let index = parseInt(this.value)

            renderIVSkew(index, spotSeries, flipSeries, chainHistory[index])
        })
    }

    // -------------------------
    // 🎚️ CHAIN SLIDER
    // -------------------------
    let chainSlider = document.getElementById("chainSlider")

    if (chainSlider) {
        chainSlider.addEventListener("input", function () {

            let index = parseInt(this.value)
            let chain = chainHistory[index]

            renderOptionStructure(index)
            renderGammaSpatialGradient(index)
            renderGammaConvexity(index)
            renderGammaTemporal(index)
            renderGammaShockSpeed(index)

            renderVega(chain)
            renderVegaExposure(chain)
        })
    }

    // -------------------------
    // 🔁 SOURCE SELECTOR (NEW)
    // -------------------------
    if (sourceSelect) {
        sourceSelect.addEventListener("change", function () {

            source = this.value
            localStorage.setItem("source", source)

            console.log("Source switched:", source)

            // disable dataset when mongo
//            if (dbSelect) {
//                dbSelect.disabled = (source === "mongo" || source === "localdb")
//            }

            reloadAll()
        })
    }

    // -------------------------
    // 🔁 DATASET SELECTOR (UPDATED)
    // -------------------------
    if (dbSelect) {
        dbSelect.addEventListener("change", function () {

            database = this.value
            localStorage.setItem("dataset", database)

            console.log("Dataset switched:", database)

            reloadAll()
        })
    }
    // 🔥 ADD THIS AT THE END
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", function () {
            const tabId = this.getAttribute("data-tab")
            switchTab(tabId, this)
        })
    })

})

setInterval(async () => {

    const user = auth.currentUser
    if (!user) return

    await user.getIdToken(true)
    console.log("♻️ Background token refresh")

}, 30 * 60 * 1000) // every 50 min

window.switchTab = switchTab