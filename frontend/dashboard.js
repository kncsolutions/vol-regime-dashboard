const API = "/api"
// const API = "http://127.0.0.1:5000/api"
let charts = {}
let ivHistory = []
let ivTimes = []

let chainHistory = []   // ← ADD THIS
let spotSeries = []
let flipSeries = []

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

    let res = await fetch(API + "/stocks")

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

        document.getElementById("stockSelect").value = stocks[0]

        loadStock(stocks[0])

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

async function loadStock(symbol) {
    console.log("Fetching:", API + "/dashboard/" + symbol)


    try {

        let res = await fetch(API + "/dashboard/" + symbol)
        let data = await res.json()

        if (!data || !data.time) {
            console.warn("No data returned for", symbol)
            return
        }

        renderMarketBanner(data)

        renderLine(charts.spot, data.time, data.spot, "Spot")
        renderLine(charts.iv, data.time, data.iv, "IV")
        renderLine(charts.hv, data.time, data.hv, "HV")

        spotSeries = data.spot
        flipSeries = data.gamma_flip

        renderLine(charts.flip, data.time, data.gamma_flip, "Gamma Flip")
        renderLine(charts.k, data.time, data.k, "Impact k")
        renderLine(charts.bpr, data.time, data.bpr, "BPR")

        renderLine(charts.i1, data.time, data.I1, "I1")
        renderLine(charts.i2, data.time, data.I2, "I2")
        renderLine(charts.amp, data.time, data.amplification, "Amplification")

        renderLine(charts.frag, data.time, data.fragility, "Fragility")


        renderGamma(data.option_chain)


        renderOI(data.option_chain)
        renderOIChange(data.option_chain)
        renderGammaExposure(data.option_chain)
        renderDealerHeatmap(data.option_chain)
        renderGammaWallMap(data.option_chain)
        renderHedgingPressure(data.option_chain)
        ivHistory = data.option_chain_history
        ivTimes = data.time

        chainHistory = data.option_chain_history || []

        for (let i = 0; i < chainHistory.length; i++) {

            if (!Array.isArray(chainHistory[i])) {

                if (i > 0 && Array.isArray(chainHistory[i - 1])) {
                    chainHistory[i] = JSON.parse(JSON.stringify(chainHistory[i - 1]))
                } else {
                    chainHistory[i] = JSON.parse(JSON.stringify(data.option_chain))
                }

            }

            ensureNetGEX(chainHistory[i])
            sortChainByStrike(chainHistory[i])

        }

// also fix current chain
        ensureNetGEX(data.option_chain)
        sortChainByStrike(data.option_chain)

// also fix current chain
// ensureNetGEX(data.option_chain)
//         console.log(chainHistory[0].map(x => x.strike))

        spotSeries = data.spot
        flipSeries = data.gamma_flip
        let lotsize = (data.lot_size !== undefined && data.lot_size !== null) ? data.lot_size : 100

        // initialize chain slider
        let chainSlider = document.getElementById("chainSlider")

        chainSlider.max = ivHistory.length - 1
        chainSlider.value = ivHistory.length - 1

        renderOptionStructure(ivHistory.length - 1)
        renderGammaSpatialGradient(ivHistory.length - 1)
        renderGammaConvexity(ivHistory.length - 1)
        renderGammaTemporal(ivHistory.length - 1)
        renderVolatilityHedgingPressure()
        renderVolatilityHedgingRequirement()
        renderGammaShockSpeed(ivHistory.length - 1)
        renderGammaVegaCoupling()
        renderGammaVegaPhaseDiagram()
        renderDealerFlow()
        renderVannaFlow()
        renderGammaVannaSurface()
        renderDealerConvexitySurface()
        let chain = data.option_chain


        computeCharmExposure(chain, lotsize)

        renderCharmExposure(chain)
        renderCharmWall(chain)

        // chainHistory = data.option_chain_history
        let charmFlowSeries = computeCharmFlow(chainHistory)
        // console.log("Charm Flow Input", charmFlowSeries)

        renderCharmFlow(data.time, charmFlowSeries)

        let dealerFlowSeries = computeCharmDrift(chainHistory, spotSeries)

        renderCharmDrift(data.time, dealerFlowSeries)

        let phaseData = computePhaseDiagram(chainHistory, spotSeries, flipSeries)

        renderDealerPhaseDiagram(phaseData)

        computeVommaExposure(chain)

        renderVommaWall(chain)
        // console.log('chain:'+JSON.stringify(data.option_chain))
        // let chain = data.option_chain

        computeVannaExposure(chain, data.spot[data.spot.length - 1], lotsize)

        renderGreekTensorMap(data.option_chain, lotsize)

        let slider = document.getElementById("ivSlider")

        slider.max = ivHistory.length - 1
        slider.value = ivHistory.length - 1

        renderIVSkew(ivHistory.length - 1, data.spot, data.gamma_flip, data.option_chain)
        renderInstabilitySurface(data)

        loadGammaExplosionRanking()
        renderFlipZoneChart()
        loadConvexityRadar()


    } catch (err) {

        console.error("Error loading stock:", err)

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

    let res = await fetch(API + "/gamma-explosion")
    let data = await res.json()

    renderGammaExplosionRanking(data)

}

async function loadConvexityRadar() {

    let res = await fetch(API + "/convexity-radar")

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

        let chain = chainHistory[i]

        let gammaTotal = 0
        let charmTotal = 0

        chain.forEach(row => {

            let gamma = Number(row.gamma) || 0

            let callOI = Number(row.call_oi) || 0
            let putOI = Number(row.put_oi) || 0

            let callTheta = Number(row.call_theta) || 0
            let putTheta = Number(row.put_theta) || 0

            gammaTotal += gamma * (callOI + putOI) * 100
            charmTotal += (callTheta * callOI + putTheta * putOI) * 100

        })

        let dS = spotSeries[i] - spotSeries[i - 1]

        let gammaFlow = gammaTotal * dS

        let charmFlow = charmTotal

        let flow = gammaFlow + charmFlow

        dealerFlow.push(flow)

    }

    return dealerFlow
}

function computeDealerFlow(chainHistory, spotSeries) {

    let flow = []

    for (let i = 1; i < chainHistory.length; i++) {

        let chain = chainHistory[i]

        let gammaTotal = 0
        let charmTotal = 0

        chain.forEach(row => {

            let gamma = Number(row.gamma) || 0
            let callOI = Number(row.call_oi) || 0
            let putOI = Number(row.put_oi) || 0

            let callTheta = Number(row.call_theta) || 0
            let putTheta = Number(row.put_theta) || 0

            gammaTotal += gamma * (callOI + putOI) * 100
            charmTotal += (callTheta * callOI + putTheta * putOI) * 100

        })

        let dS = spotSeries[i] - spotSeries[i - 1]

        let gammaFlow = gammaTotal * dS
        let charmFlow = charmTotal

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

        phase.push([flipDist[i], dealerFlow[i]])

    }

    return phase
}

function renderDealerPhaseDiagram(data) {

    charts.phaseDiagram.clear()

    charts.phaseDiagram.setOption({

        backgroundColor: "#111",

        title: {
            text: "Dealer Flow Phase Diagram", left: "center", textStyle: {color: "#ddd"}
        },

        tooltip: {
            formatter: function (p) {

                return "Flip Distance: " + p.value[0].toFixed(4) + "<br>Dealer Flow: " + p.value[1].toFixed(0)

            }
        },

        xAxis: {
            name: "Distance From Gamma Flip", type: "value", axisLabel: {color: "#ccc"}
        },

        yAxis: {
            name: "Dealer Flow", type: "value", axisLabel: {color: "#ccc"}
        },

        series: [{

            type: "scatter",

            data: data,

            symbolSize: 12,

            itemStyle: {
                color: "#00E5FF"
            }

        }]

    })
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

        series: [{
            type: "bar", data: charm, itemStyle: {
                color: function (params) {
                    return params.value > 0 ? "#00FF9C" : "#FF4D4F"
                }
            }
        }]

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

        }]

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
            type: "value"
        },

        series: [{
            data: y, type: "line", smooth: true
        }]

    })


}

function renderGamma(chain) {


    charts.gamma.clear()

    if (!chain || chain.length === 0) {
        return
    }

    let strikes = chain.map(x => x.strike)

    let cumulative = []
    let sum = 0

    chain.forEach(c => {

        sum += c.net_gex
        cumulative.push(sum)

    })

    charts.gamma.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Ladder", textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "category", data: strikes
        },

        yAxis: {
            type: "value"
        },

        series: [{
            data: cumulative, type: "line"
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

        }]

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

        xAxis: {
            type: "category", data: strikes
        },

        yAxis: {
            type: "value"
        },

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

        surfaceData.push([distance, data.I1[i], data.I2[i], data.amplification[i]])
    }

    charts.instability.setOption({

        backgroundColor: "#111",

        title: {
            text: "Systemic Instability Surface", textStyle: {color: "#fff"}
        },

        tooltip: {

            formatter: function (p) {

                return `
                Flip Distance: ${p.value[0]}<br>
                I1: ${p.value[1]}<br>
                I2: ${p.value[2]}<br>
                Amplification: ${p.value[3]}
                `
            }
        },

        xAxis: {
            name: "Distance from Gamma Flip", type: "value", axisLabel: {color: "#fff"}
        },

        yAxis: {
            name: "Linear Instability (I1)", type: "value", axisLabel: {color: "#fff"}
        },

        visualMap: {

            dimension: 2, min: 0, max: 0.02,

            inRange: {
                color: ["#00ff9c", "#ffaa00", "#ff4d4d"]
            },

            textStyle: {color: "#fff"}
        },

        series: [

            {
                type: "scatter",

                data: surfaceData,

                symbolSize: function (val) {
                    return Math.abs(val[3]) * 10 + 10
                }

            }

        ]

    })

}

async function renderInstabilityMap() {

    let res = await fetch(API + "/instability-map")
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

    let res = await fetch(API + "/flipzone")

    let data = await res.json()

    if (!data || data.length === 0) return

    let stocks = data.map(x => x.symbol)

    let distances = data.map(x => x.distance)

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
            type: "value", name: "IV", axisLabel: {color: "#fff"}
        },

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

    renderGamma(chain)

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

    if (!data || data.length === 0) {
        console.warn("No gamma explosion data")
        return
    }

    // sort by explosion score
    data.sort((a, b) => b.gamma_explosion_score - a.gamma_explosion_score)

    // labels with flip distance
    let symbols = data.map(x => `${x.symbol} (${x.distance.toFixed(2)}%)`)

    // normalize scores (log scale to avoid huge values)
    let scores = data.map(x => Math.log10(1 + x.gamma_explosion_score))

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

                return `
        ${d.symbol}<br>
        Flip Distance: ${d.distance.toFixed(2)}%<br>
        Explosion Score: ${d.gamma_explosion_score.toExponential(2)}
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

        yAxis: {
            type: "value", axisLabel: {color: "#fff"}
        },

        series: [{
            type: "line", data: gradient, smooth: true
        }]

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

        series: [{
            type: "bar", data: convexity
        }]

    })
}

function renderGammaTemporal(index) {

    if (index === 0) return

    let chainNow = chainHistory[index]
    let chainPrev = chainHistory[index - 1]

    if (!chainNow || !chainPrev) return

    let prevMap = {}

    // map previous chain by strike
    chainPrev.forEach(o => {

        if (!o || o.net_gex == null) return

        prevMap[o.strike] = o.net_gex

    })

    let temporal = []
    let strikes = []

    chainNow.forEach(o => {

        if (!o || o.net_gex == null) return

        let prev = prevMap[o.strike] ?? 0
        let delta = o.net_gex - prev

        temporal.push(delta)
        strikes.push(o.strike)

    })

    charts.gammaTemporal.setOption({

        backgroundColor: "#111",

        title: {
            text: "Temporal GEX Gradient (Gamma-Time Compression) - Color proxy", textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", axisLabel: {color: "#fff"}
        },

        series: [{
            type: "bar", data: temporal, itemStyle: {
                color: function (p) {
                    return p.value >= 0 ? "#00ff9c" : "#ff4d4d"
                }
            }
        }]

    })
}

function renderGammaShockSpeed(index) {

    if (index === 0) return

    let chainNow = chainHistory[index]
    let chainPrev = chainHistory[index - 1]

    if (!chainNow || !chainPrev || chainNow.length < 3) return

    let strikes = []
    let shock = []

    for (let i = 1; i < chainNow.length - 1; i++) {

        let g2 = chainNow[i + 1].net_gex
        let g1 = chainNow[i].net_gex
        let g0 = chainNow[i - 1].net_gex

        let gPrev = chainPrev[i].net_gex

        if (g2 == null || g1 == null || g0 == null || gPrev == null) continue

        // spatial convexity
        let d2 = g2 - 2 * g1 + g0

        // temporal gradient
        let dt = g1 - gPrev

        let shockSpeed = Math.abs(dt) * Math.abs(d2)

        strikes.push(chainNow[i].strike)
        shock.push(shockSpeed)

    }

    charts.gammaShock.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Shock Speed", textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category", data: strikes, axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Shock Speed", axisLabel: {color: "#fff"}
        },

        series: [{
            type: "bar", data: shock, itemStyle: {
                color: "#ff2b2b"
            }
        }]

    })
}

function renderGammaVegaCoupling() {

    charts.gammaVegaCoupling.clear()

    if (!chainHistory || chainHistory.length < 2) return

    let values = []
    let times = ivTimes.slice(1)

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

    }

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

        data.push([gammaShock, vegaPressure])

    }

    charts.gammaVegaPhase.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Vega Phase Diagram", left: "center", textStyle: {color: "#fff"}
        },

        tooltip: {
            formatter: function (p) {

                let g = p.value[0]
                let v = p.value[1]

                let regime = ""

                if (g > 0 && v > 0) regime = "Stable Market"
                if (g > 0 && v < 0) regime = "Volatility Suppression"
                if (g < 0 && v > 0) regime = "Trend + Vol Expansion"
                if (g < 0 && v < 0) regime = "Convexity Cascade"

                return `
                Gamma: ${g.toFixed(2)}<br>
                Vega: ${v.toFixed(2)}<br>
                Regime: ${regime}
                `
            }
        },

        xAxis: {
            type: "value", name: "Gamma Shock", axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value", name: "Vega Pressure", axisLabel: {color: "#fff"}
        },

        series: [{

            type: "scatter",

            data: data,

            symbolSize: 10,

            itemStyle: {
                color: "#00c8ff"
            },

            markLine: {
                symbol: "none", lineStyle: {
                    color: "#888", type: "dashed"
                }, data: [{xAxis: 0}, {yAxis: 0}]
            }

        }],

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

        }]

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

/* ---------- Initialization ---------- */

window.onload = function () {

    initCharts()
    loadStocks()
    renderInstabilityMap()

}

document.getElementById("stockSelect").addEventListener("change", function () {

    const symbol = this.value

    if (symbol) {
        loadStock(symbol)
    }

})

document.getElementById("stockSelect").addEventListener("keydown", function (e) {

    if (e.key === "Enter") {

        const symbol = this.value

        if (symbol) {
            loadStock(symbol)
        }

    }

})
document
    .getElementById("ivSlider")
    .addEventListener("input", function () {

        let index = parseInt(this.value)

        renderIVSkew(index, spotSeries, flipSeries, chainHistory[index])

    })
document
    .getElementById("chainSlider")
    .addEventListener("input", function () {

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

