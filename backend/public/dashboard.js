const API = "http://localhost:5000/api"

let charts = {}
let ivHistory = []
let ivTimes = []

let chainHistory = []   // ← ADD THIS
let spotSeries = []
let flipSeries = []

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

    charts.oi = echarts.init(document.getElementById("oiDist"))
    charts.oichange = echarts.init(document.getElementById("oiChange"))
    charts.gex = echarts.init(document.getElementById("gammaExposure"))
    charts.dealerHeat = echarts.init(document.getElementById("dealerHeatmap"))
    charts.gammaWall = echarts.init(document.getElementById("gammaWallMap"))
    charts.hedge = echarts.init(document.getElementById("hedgingPressure"))
    charts.instability = echarts.init(document.getElementById("instabilitySurface"))
    charts.instabilityMap = echarts.init(document.getElementById("instabilityMap"))
    charts.flipzone = echarts.init(document.getElementById("flipZoneChart"))

    charts.ivskew = echarts.init(
        document.getElementById("ivSkewChart")
    )


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

        chainHistory = data.option_chain_history
        spotSeries = data.spot
        flipSeries = data.gamma_flip

        // initialize chain slider
        let chainSlider = document.getElementById("chainSlider")

        chainSlider.max = ivHistory.length - 1
        chainSlider.value = ivHistory.length - 1

        renderOptionStructure(ivHistory.length - 1)

        let slider = document.getElementById("ivSlider")

        slider.max = ivHistory.length - 1
        slider.value = ivHistory.length - 1

        renderIVSkew(
            ivHistory.length - 1,
            data.spot,
            data.gamma_flip,
            data.option_chain
        )
        renderInstabilitySurface(data)
        renderFlipZoneChart()


    } catch (err) {

        console.error("Error loading stock:", err)

    }


}

function renderLine(chart, x, y, title) {


    chart.clear()

    chart.setOption({

        backgroundColor: "#111",

        title: {
            text: title,
            textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "category",
            data: x
        },

        yAxis: {
            type: "value"
        },

        series: [{
            data: y,
            type: "line",
            smooth: true
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
            text: "Gamma Ladder",
            textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "category",
            data: strikes
        },

        yAxis: {
            type: "value"
        },

        series: [{
            data: cumulative,
            type: "line"
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
            text: "OI Distribution",
            textStyle: {color: "#fff"}
        },

        legend: {
            data: ["Call", "Put"]
        },

        xAxis: {
            type: "category",
            data: strikes
        },

        yAxis: {
            type: "value"
        },

        series: [

            {data: callOI, type: "bar", name: "Call"},
            {data: putOI, type: "bar", name: "Put"}

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
            text: "OI Change",
            textStyle: {color: "#fff"}
        },

        legend: {
            data: ["Call OI Change", "Put OI Change"],
            textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category",
            data: strikes
        },

        yAxis: {
            type: "value"
        },

        series: [

            {
                name: "Call OI Change",
                type: "bar",
                data: callChange
            },

            {
                name: "Put OI Change",
                type: "bar",
                data: putChange
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
            text: "Strike vs Gamma Exposure",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category",
            data: strikes
        },

        yAxis: {
            type: "value",
            name: "Gamma Exposure"
        },

        series: [
            {
                name: "GEX",
                type: "bar",
                data: gex,
                itemStyle: {
                    color: function (params) {
                        return params.value >= 0 ? "#00ff9c" : "#ff4d4d"
                    }
                }
            }
        ]

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
            text: "Dealer Position Heatmap",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            position: "top"
        },

        xAxis: {
            type: "category",
            data: strikes,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "category",
            data: ["Call OI Change", "Put OI Change"],
            axisLabel: {color: "#fff"}
        },

        visualMap: {
            min: -500000,
            max: 500000,
            calculable: true,
            orient: "horizontal",
            left: "center",
            bottom: 20,
            inRange: {
                color: ["#ff4d4d", "#111", "#00ff9c"]
            }
        },

        series: [
            {
                type: "heatmap",
                data: heatData,
                label: {show: false}
            }
        ]

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

        data.push([
            opt.strike,
            opt.net_gex
        ])

    })

    if (data.length === 0) return

    let strikes = data.map(d => d[0])
    let gexValues = data.map(d => d[1])

    let minStrike = Math.min(...strikes)
    let maxStrike = Math.max(...strikes)

    charts.gammaWall.setOption({

        backgroundColor: "#111",

        title: {
            text: "Gamma Wall Map",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "item",
            formatter: function (p) {
                return `
                Strike: ${p.value[0]}<br>
                GEX: ${p.value[1].toExponential(2)}
                `
            }
        },

        xAxis: {
            type: "value",
            name: "Strike",
            min: minStrike - 2,
            max: maxStrike + 2,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            name: "Gamma Exposure",
            axisLabel: {color: "#fff"}
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
                        return params.value[1] >= 0
                            ? "#00ff9c"
                            : "#ff4d4d"
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
            text: "Dealer Hedging Pressure",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "category",
            data: strikes,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            name: "Hedging Pressure",
            axisLabel: {color: "#fff"}
        },

        series: [

            {
                type: "bar",
                data: pressure,

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
            data.amplification[i]
        ])
    }

    charts.instability.setOption({

        backgroundColor: "#111",

        title: {
            text: "Systemic Instability Surface",
            textStyle: {color: "#fff"}
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
            name: "Distance from Gamma Flip",
            type: "value",
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            name: "Linear Instability (I1)",
            type: "value",
            axisLabel: {color: "#fff"}
        },

        visualMap: {

            dimension: 2,
            min: 0,
            max: 0.02,

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

            name: d.symbol,

            value: [
                d.distance,
                d.I1,
                d.I2,
                d.amp
            ]

        }

    })

    charts.instabilityMap.setOption({

        backgroundColor: "#111",

        title: {
            text: "Market Instability Map",
            textStyle: {color: "#fff"}
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
            name: "Distance from Gamma Flip (%)",
            type: "value"
        },

        yAxis: {
            name: "Linear Instability (I1)",
            type: "value"
        },

        visualMap: {

            dimension: 2,
            min: 0,
            max: 0.02,

            inRange: {
                color: ["#00ff9c", "#ffaa00", "#ff4d4d"]
            }

        },

        series: [{

            type: "scatter",

            data: points,

            symbolSize: function (v) {
                return Math.abs(v[3]) * 15 + 10
            },

            label: {

                show: true,

                formatter: function (p) {

                    if (Math.abs(p.value[0]) < 2)
                        return p.name

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
            text: "Stocks Near Gamma Flip (±2%)",
            textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        xAxis: {
            type: "category",
            data: stocks,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            name: "Distance (%)",
            axisLabel: {color: "#fff"}
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
            xAxis: flip,
            label: {formatter: "Gamma Flip", color: "#ff4d4d"},
            lineStyle: {color: "#ff4d4d", width: 2}
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
            text: "IV Skew",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis"
        },

        xAxis: {
            type: "value",
            name: "Strike",
            min: minStrike - 2,
            max: maxStrike + 2,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            name: "IV",
            axisLabel: {color: "#fff"}
        },

        series: [{

            type: "line",
            smooth: true,
            data: data,

            lineStyle: {
                width: 3,
                color: "#00c8ff"
            },

            markLine: {
                symbol: "none",
                label: {
                    show: true,
                    position: "insideEndTop",
                    fontWeight: "bold"
                },
                data: lines
            }

        }]

    })

    document.getElementById("ivTimeLabel").innerText =
        "Snapshot: " + ivTimes[index]

}

function renderOptionStructure(index) {

    if (!ivHistory || ivHistory.length === 0) return

    let chain = ivHistory[index]

    if (!chain) return

    renderGamma(chain)
    renderOI(chain)
    renderOIChange(chain)
    renderGammaExposure(chain)
    renderDealerHeatmap(chain)
    renderGammaWallMap(chain)
    renderHedgingPressure(chain)

    document.getElementById("chainTimeLabel").innerText =
        "Snapshot: " + ivTimes[index]

}

/* ---------- Initialization ---------- */

initCharts()
loadStocks()

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

        renderIVSkew(
            index,
            spotSeries,
            flipSeries,
            chainHistory[index]
        )

    })
document
    .getElementById("chainSlider")
    .addEventListener("input", function () {

        let index = parseInt(this.value)

        renderOptionStructure(index)

    })
renderInstabilityMap()
