// snapshotRenderer.js

// -----------------------------
// Format helpers
// -----------------------------
let snapshotState = {
    all: [],
    currentIndex: 0
}
let snapshotCharts = {}

function initSnapshotCharts() {

    let ivEl = document.getElementById("snapshotIvSkewChart")
    if (ivEl) {
        snapshotCharts.ivskew = echarts.init(ivEl)
    }

    let gexEl = document.getElementById("snapshotGEXChart")
    if (gexEl) {
        snapshotCharts.gex = echarts.init(gexEl)
    }
}
function initSnapshotSlider() {

    const slider = document.getElementById("snapshotSlider")
    if (!slider) return

    slider.addEventListener("input", (e) => {

        const indexFromLeft = parseInt(e.target.value)

        // oldest → latest mapping
        snapshotState.currentIndex = indexFromLeft

        renderCurrentSnapshot()
        updateSliderLabel()
    })
}
function updateSnapshotSlider() {

    const slider = document.getElementById("snapshotSlider")
    if (!slider) return

    slider.min = 0
    slider.max = snapshotState.all.length - 1

    // 🔥 latest
    slider.value = snapshotState.all.length - 1

    console.log("Slider set to:", slider.value)
}

function updateSliderLabel() {

    const label = document.getElementById("snapshotLabel")
    if (!label) return

    const snap = snapshotState.all[snapshotState.currentIndex]
    if (!snap) return

    const ts = Number(snap.timestamp) * 1000

    const istTime = new Date(ts).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata"
    })

    label.innerText = `Snapshot: ${istTime} IST`
}

function renderCurrentSnapshot() {

    const slider = document.getElementById("snapshotSlider")
    console.log("Slider element:", slider)
    if (!slider) return

    const index = parseInt(slider.value)

    const snap = snapshotState.all[index]

    console.log("Rendering index:", index, snap)

    if (!snap) return

    renderSnapshotsList([snap])
}

function formatExpiry(expiry) {

    try {
        // 🔧 Fix backend format
        let clean = expiry.replace(/_/g, ".")

        let d = new Date(clean)
        if (isNaN(d)) return expiry

        let now = new Date()

        // 🔥 Compute DTE (in days)
        let diffMs = d - now
        let dte = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))

        let day = d.getUTCDate()
        let month = d.toLocaleString("en-US", {
            month: "short",
            timeZone: "UTC"
        })

        return `${day} ${month} (${dte}D)`

    } catch {
        return expiry
    }
}

function detectIVRegime(optionChains) {

    let expiries = Object.keys(optionChains)
    if (expiries.length < 2) return "INSUFFICIENT DATA"

    // sort expiries (nearest first)
    expiries.sort((a, b) => new Date(a.replace(/_/g, ".")) - new Date(b.replace(/_/g, ".")))

    let front = optionChains[expiries[0]]
    let back = optionChains[expiries[expiries.length - 1]]

    if (!front || !back) return "NO DATA"

    // 🔥 Average IV
    let avgFrontIV = front.reduce((a, o) => a + (o.iv || 0), 0) / front.length
    let avgBackIV = back.reduce((a, o) => a + (o.iv || 0), 0) / back.length

    let diff = avgFrontIV - avgBackIV

    // 🔥 slope estimation (skew)
    function slope(chain) {
        if (chain.length < 2) return 0
        let first = chain[0]
        let last = chain[chain.length - 1]

        if (!first || !last) return 0

        return (last.iv - first.iv) / (last.strike - first.strike)
    }

    let slopeFront = slope(front)
    let slopeBack = slope(back)

    let slopeDiff = Math.abs(slopeFront - slopeBack)

    // 🔥 Regime logic
    if (diff > 3) return "PANIC / EVENT (Front IV >> Back IV)"
    if (diff < -3) return "LONG TERM UNCERTAINTY (Back IV >> Front IV)"
    if (slopeDiff > 0.01) return "CONVEXITY REGIME SHIFT"

    return "NORMAL TERM STRUCTURE"
}

function detectGEXRegime(optionChains) {

    let expiries = Object.keys(optionChains)
    if (expiries.length < 2) return "NO DATA"

    expiries.sort((a, b) => new Date(a.replace(/_/g, ".")) - new Date(b.replace(/_/g, ".")))

    let front = optionChains[expiries[0]]
    let back = optionChains[expiries[expiries.length - 1]]

    let sum = arr => arr.reduce((a, o) => a + (o.net_gex || 0), 0)

    let frontGEX = sum(front)
    let backGEX = sum(back)

    if (frontGEX < 0 && backGEX < 0) return "FULL SHORT GAMMA"
    if (frontGEX > 0 && backGEX > 0) return "FULL LONG GAMMA"
    if (frontGEX < 0 && backGEX > 0) return "FRONT INSTABILITY"
    if (frontGEX > 0 && backGEX < 0) return "BACK INSTABILITY"

    return "MIXED GAMMA"
}

function detectMarketState(optionChains, spot, flip) {

    let ivRegime = detectIVRegime(optionChains)
    let gexRegime = detectGEXRegime(optionChains)

    let distance = 0
    if (spot && flip) {
        distance = (spot - flip) / spot
    }

    // 🔥 CORE LOGIC

    // 🚨 HIGH RISK BREAKOUT
    if (
        ivRegime.includes("PANIC") &&
        gexRegime.includes("SHORT")
    ) {
        return "HIGH RISK BREAKOUT"
    }

    // ⚡ VOLATILE TRANSITION
    if (
        ivRegime.includes("SHIFT") ||
        gexRegime.includes("FRONT")
    ) {
        return "VOLATILE TRANSITION"
    }

    // 🟢 MEAN REVERSION
    if (
        ivRegime.includes("NORMAL") &&
        gexRegime.includes("LONG")
    ) {
        return "MEAN REVERSION"
    }

    // 🔴 CRASH RISK
    if (
        gexRegime.includes("SHORT") &&
        distance < 0
    ) {
        return "CRASH RISK"
    }

    // default
    return "MIXED / UNCLEAR"
}

function safe(v) {
    return (v === null || v === undefined) ? "N/A" : v
}

function formatTime(ts) {
    if (!ts) return "N/A"
    return new Date(Number(ts) * 1000).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata"
    }) + " IST"
}

function renderRegimeTable(regime) {

    if (!regime) return ""

    let html = `
        <h3>Regime State</h3>
        <table class="snapshot-table">
            <tr>
                <th>Metric</th>
                <th>Value</th>
            </tr>
    `

    Object.keys(regime).forEach(key => {

        // 🔥 skip heavy / noisy fields
        if ([
            "instability_pockets",
            "convexity_traps",
            "systemic"
        ].includes(key)) return

        let value = regime[key]

        // 🔥 format objects nicely
        if (typeof value === "object" && value !== null) {
            value = `<pre>${JSON.stringify(value, null, 2)}</pre>`
        }

        // 🔥 handle null
        if (value === null || value === undefined) {
            value = "N/A"
        }

        html += `
            <tr>
                <td><b>${key}</b></td>
                <td>${value}</td>
            </tr>
        `
    })

    html += `</table>`

    return html
}


// -----------------------------
// MAIN RENDER
// -----------------------------
function renderHeader(snapshot, spot) {
    return `
        <div class="section header">
            <h2>${snapshot.stock_id}</h2>
            <div>Time: ${new Date(Number(snapshot.timestamp) * 1000).toLocaleString("en-IN")}</div>
            <div>Spot: <b>${spot.close ?? "N/A"}</b></div>
        </div>
    `
}

function renderSummary(regime) {
    return `
        <div class="section summary">
            <h3>Market Regime</h3>
            <div class="grid-4">
                <div>Gamma Regime: <b>${regime.gamma_surface_regime ?? "N/A"}</b></div>
                <div>Vega: <b>${regime.vega_regime ?? "N/A"}</b></div>
                <div>Systemic: <b>${regime.systemic_regime ?? "N/A"}</b></div>
                <div>Confidence: <b>${regime.regime_confidence ?? "N/A"}</b></div>
            </div>
        </div>
    `
}

function renderVolatility(regime) {
    return `
        <div class="section">
            <h3>Volatility</h3>
            <div class="grid-4">
                <div>IV: ${regime.iv ?? "N/A"}</div>
                <div>HV: ${regime.hv ?? "N/A"}</div>
                <div>IV vs HV: ${regime.iv_vs_hv ?? "N/A"}</div>
                <div>ATR %: ${regime.atr_pct ?? "N/A"}</div>
            </div>
        </div>
    `
}

function renderGamma(regime) {
    return `
        <div class="section">
            <h3>Gamma Structure</h3>
            <div class="grid-4">
                <div>Call Wall: ${regime.call_wall ?? "N/A"}</div>
                <div>Put Wall: ${regime.put_wall ?? "N/A"}</div>
                <div>Gamma Flip: <b>${regime.gamma_flip ?? "N/A"}</b></div>
                <div>Spot: ${regime.current_spot ?? "N/A"}</div>
            </div>
        </div>
    `
}

function renderRisk(regime) {

    const c = regime.convexity || {}

    return `
        <div class="section">
            <h3>Risk & Convexity</h3>
            <div class="grid-4">
                <div>Crash Flag: ${c.crash_flag ?? "N/A"}</div>
                <div>Gamma Risk: ${c.gamma_transition_risk ?? "N/A"}</div>
                <div>Instability: ${c.convexity_instability ?? "N/A"}</div>
                <div>Inventory Stress: ${c.inventory_stress ?? "N/A"}</div>
            </div>
        </div>
    `
}

function renderStrategy(strategy) {

    if (!strategy.length) return ""

    const s = strategy[0]

    return `
        <div class="section strategy">
            <h3>Strategy</h3>
            <div class="grid-4">
                <div>Name: ${s.name}</div>
                <div>Bias: <b>${s.bias}</b></div>
                <div>Conviction: ${s.conviction}</div>
                <div>Expected PnL: ${s.expected_pnl}</div>
            </div>
        </div>
    `
}

function renderExpandable(regime) {
    return `
        <details>
            <summary>Advanced Data</summary>
            <pre>${JSON.stringify(regime, null, 2)}</pre>
        </details>
    `
}

function renderInstabilityPocketsTable(data) {

    const container = document.getElementById("instabilityPocketsTable")
    if (!container) return

    container.innerHTML = ""


// 🔥 Title
    let title = document.createElement("div")
    title.innerText = "Instablility Pockets"
    title.style.color = "#fff"
    title.style.fontSize = "16px"
    title.style.fontWeight = "bold"
    title.style.marginBottom = "8px"
    title.style.textAlign = "center"

    container.appendChild(title)

    let pockets = data?.instability_pockets

    if (!Array.isArray(pockets) || pockets.length === 0) {
        container.innerHTML = `<p style="color:#888">No instability pockets</p>`
        return
    }

    // 🔥 Collect ALL unique keys across objects
    let columns = new Set()

    pockets.forEach(p => {
        Object.keys(p).forEach(k => columns.add(k))
    })

    columns = Array.from(columns)


    let priority = ["strike", "net_gex", "gamma", "iv"]

    columns = [
        ...priority.filter(p => columns.includes(p)),
        ...columns.filter(c => !priority.includes(c))
    ]

    // 🔥 Create table
    let table = document.createElement("table")
    table.style.width = "100%"
    table.style.borderCollapse = "collapse"
    table.style.background = "#111"
    table.style.color = "#fff"
    table.style.fontSize = "12px"

    // 🔥 HEADER
    let thead = document.createElement("thead")
    let headerRow = document.createElement("tr")

    columns.forEach(col => {
        let th = document.createElement("th")
        th.innerText = col.toUpperCase()
        th.style.padding = "6px"
        th.style.borderBottom = "1px solid #444"
        th.style.color = "#aaa"
        th.style.textAlign = "center"
        headerRow.appendChild(th)
    })

    thead.appendChild(headerRow)
    table.appendChild(thead)

    // 🔥 BODY
    let tbody = document.createElement("tbody")

    // 🔥 Identify most extreme pocket (by |net_gex|)
    let maxRisk = Math.max(...pockets.map(p => Math.abs(p.net_gex || 0)))

    pockets.forEach(p => {

        let row = document.createElement("tr")

        columns.forEach(col => {

            let td = document.createElement("td")
            let val = p[col]

            // 🔧 format values
            if (typeof val === "number") {
                val = val.toFixed(4)
            }

            td.innerText = val ?? "-"
            td.style.padding = "6px"
            td.style.textAlign = "center"
            td.style.borderBottom = "1px solid #222"

            // 🎯 Smart coloring (generic + safe)

            if (col.includes("gex")) {
                td.style.color = val > 0 ? "#00ff9c" : "#ff4d4d"
            }

            if (col === "iv") {
                td.style.color =
                    val > 40 ? "#ff4d4d" :
                        val > 25 ? "#ffaa00" :
                            "#00ff9c"
            }

            if (col === "gamma") {
                td.style.color =
                    val > 0.004 ? "#ff4d4d" :
                        val > 0.002 ? "#ffaa00" :
                            "#00ff9c"
            }

            if (col.includes("oi")) {
                td.style.color = "#00c8ff"
            }

            if (col.includes("theta")) {
                td.style.color = "#ffaa00"
            }

            row.appendChild(td)
        })

        // 🔥 Highlight most dangerous pocket
        if (Math.abs(p.net_gex || 0) === maxRisk) {
            row.style.background = "#2a1a1a"
        }

        tbody.appendChild(row)
    })

    table.appendChild(tbody)
    container.appendChild(table)
}

function renderConvexityTrapsTable(data) {

    const container = document.getElementById("convexityTrapsTable")
    if (!container) return

    container.innerHTML = ""


// 🔥 Title
    let title = document.createElement("div")
    title.innerText = "Convexity Trap Analysis"
    title.style.color = "#fff"
    title.style.fontSize = "16px"
    title.style.fontWeight = "bold"
    title.style.marginBottom = "8px"
    title.style.textAlign = "center"

    container.appendChild(title)

    let traps = data?.convexity_traps

    if (!Array.isArray(traps) || traps.length === 0) {
        container.innerHTML = `<p style="color:#888">No convexity traps</p>`
        return
    }

    // 🔥 Collect all fields dynamically
    let columns = new Set()

    traps.forEach(t => {
        Object.keys(t).forEach(k => columns.add(k))
    })

    columns = Array.from(columns)

    // ✅ Priority ordering (important for readability)
    let priority = ["strike", "net_gex", "d_gex", "gamma", "iv"]
    columns = [
        ...priority.filter(p => columns.includes(p)),
        ...columns.filter(c => !priority.includes(c))
    ]

    // 🔥 Create table
    let table = document.createElement("table")
    table.style.width = "100%"
    table.style.borderCollapse = "collapse"
    table.style.background = "#111"
    table.style.color = "#fff"
    table.style.fontSize = "12px"

    // HEADER
    let thead = document.createElement("thead")
    let headerRow = document.createElement("tr")

    columns.forEach(col => {
        let th = document.createElement("th")
        th.innerText = col.toUpperCase()
        th.style.padding = "6px"
        th.style.borderBottom = "1px solid #444"
        th.style.color = "#aaa"
        th.style.textAlign = "center"
        headerRow.appendChild(th)
    })

    thead.appendChild(headerRow)
    table.appendChild(thead)

    // 🔥 Identify strongest convexity trap (based on d_gex)
    let maxTrap = Math.max(...traps.map(t => Math.abs(t.d_gex || 0)))

    // BODY
    let tbody = document.createElement("tbody")

    traps.forEach(t => {

        let row = document.createElement("tr")

        columns.forEach(col => {

            let td = document.createElement("td")
            let val = t[col]

            // 🔧 format numbers
            if (typeof val === "number") {
                val = val.toFixed(2)
            }

            td.innerText = val ?? "-"
            td.style.padding = "6px"
            td.style.textAlign = "center"
            td.style.borderBottom = "1px solid #222"

            // 🎯 SMART COLORING

            // Net GEX (positioning)
            if (col === "net_gex") {
                td.style.color = val > 0 ? "#00ff9c" : "#ff4d4d"
            }

            // dGEX (convexity gradient → MOST IMPORTANT)
            if (col === "d_gex") {
                td.style.color =
                    Math.abs(val) > 300000 ? "#ff3b3b" :
                        Math.abs(val) > 150000 ? "#ffaa00" :
                            "#00ff9c"
            }

            // Gamma (sensitivity)
            if (col === "gamma") {
                td.style.color =
                    val > 0.004 ? "#ff4d4d" :
                        val > 0.002 ? "#ffaa00" :
                            "#00ff9c"
            }

            // IV (vol regime)
            if (col === "iv") {
                td.style.color =
                    val > 40 ? "#ff4d4d" :
                        val > 25 ? "#ffaa00" :
                            "#00ff9c"
            }

            // OI fields
            if (col.includes("oi")) {
                td.style.color = "#00c8ff"
            }

            // Theta (decay)
            if (col.includes("theta")) {
                td.style.color = "#ffaa00"
            }

            row.appendChild(td)
        })

        // 🔥 Highlight strongest trap
        if (Math.abs(t.d_gex || 0) === maxTrap) {
            row.style.background = "#2a1a1a"
        }

        tbody.appendChild(row)
    })

    table.appendChild(tbody)
    container.appendChild(table)
}

function renderObjectInspectorTable(obj, containerId, titleText = "Regime State Overview") {

    const container = document.getElementById(containerId)
    if (!container) return

    container.innerHTML = ""

    if (!obj || typeof obj !== "object") {
        container.innerHTML = `<p style="color:#888">No data available</p>`
        return
    }

    // 🔥 Title
    let title = document.createElement("div")
    title.innerText = titleText
    title.style.color = "#fff"
    title.style.fontSize = "16px"
    title.style.fontWeight = "bold"
    title.style.marginBottom = "10px"
    title.style.textAlign = "center"

    container.appendChild(title)

    // 🔥 Table
    let table = document.createElement("table")
    table.style.width = "100%"
    table.style.borderCollapse = "collapse"
    table.style.background = "#111"
    table.style.color = "#fff"
    table.style.fontSize = "12px"

    let tbody = document.createElement("tbody")

    // ✅ Priority + Exclusions
    let priority = ["current_spot", "gamma_flip", "call_wall", "put_wall"]
    let excludeFields = ["convexity_traps", "instability_pockets"]

    let keys = [
        ...priority.filter(k => obj[k] !== undefined && !excludeFields.includes(k)),
        ...Object.keys(obj).filter(k =>
            !priority.includes(k) && !excludeFields.includes(k)
        )
    ]
    // console.log('keys:'+keys)

    // 🔥 Loop through keys
    keys.forEach(key => {

        let row = document.createElement("tr")

        // 🔹 LEFT COLUMN (Field Name)
        let tdKey = document.createElement("td")
        tdKey.innerText = key
        tdKey.style.padding = "6px"
        tdKey.style.borderBottom = "1px solid #222"
        tdKey.style.color = "#00c8ff"
        tdKey.style.fontWeight = "bold"
        tdKey.style.width = "30%"

        // 🔹 RIGHT COLUMN (Value)
        let tdVal = document.createElement("td")
        tdVal.style.padding = "6px"
        tdVal.style.borderBottom = "1px solid #222"
        tdVal.style.width = "70%"
        tdVal.style.whiteSpace = "pre-wrap"
        tdVal.style.fontFamily = "monospace"

        let value = obj[key]

        // 🔥 FORMAT VALUE
        if (typeof value === "object" && value !== null) {

            try {
                tdVal.innerText = JSON.stringify(value, null, 2)
            } catch {
                tdVal.innerText = "{...}"
            }

            tdVal.style.color = "#ffaa00"

        } else if (typeof value === "number") {

            tdVal.innerText = value.toFixed(4)

            tdVal.style.color =
                value > 0 ? "#00ff9c" :
                    value < 0 ? "#ff4d4d" :
                        "#ccc"

        } else {

            tdVal.innerText = value ?? "-"
            tdVal.style.color = "#ddd"
        }

        row.appendChild(tdKey)
        row.appendChild(tdVal)

        tbody.appendChild(row)
    })

    table.appendChild(tbody)
    container.appendChild(table)
}

function renderSnapshotIVSkew(optionChains) {

    if (!snapshotCharts.ivskew) return

    let chart = snapshotCharts.ivskew
    chart.clear()

    // console.log("Option Chains:", optionChains) // 🔍 debug

    if (!optionChains || typeof optionChains !== "object") return

    let series = []
    let allStrikes = new Set()

    let expiries = Object.keys(optionChains)

    // console.log("Expiries found:", expiries) // 🔍 should show 2+

    expiries.forEach((expiry, idx) => {

        let chain = optionChains[expiry]

        if (!Array.isArray(chain)) return

        let data = []

        chain.forEach(opt => {
            if (!opt || opt.iv == null || opt.strike == null) return

            data.push([Number(opt.strike), Number(opt.iv)])
            allStrikes.add(Number(opt.strike))
        })

        data.sort((a, b) => a[0] - b[0])

        // 🔥 IMPORTANT: unique name + color
        series.push({
            name: formatExpiry(expiry),
            type: "line",
            smooth: true,
            data: data
        })
    })

    // console.log("Series built:", series) // 🔍 must show multiple series

    if (series.length === 0) return

    let strikes = Array.from(allStrikes).sort((a, b) => a - b)
    let regime = detectIVRegime(optionChains)
    chart.setOption({
        backgroundColor: "#111",

        title: {
            text: "",
            left: "center",
            textStyle: {color: "#fff"}
        },

        tooltip: {trigger: "axis"},

        legend: {
            top: 30,
            textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "value",
            name: "Strike",
            min: Math.min(...strikes) - 5,
            max: Math.max(...strikes) + 5,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            name: "IV",
            axisLabel: {color: "#fff"},
            scale: true
        },
        graphic: [
            {
                type: "text",
                left: "center",
                top: 5,
                z: 100,
                style: {
                    text: `Regime: ${regime}`,
                    fill:
                        regime.includes("PANIC") ? "#ff4d4d" :
                            regime.includes("UNCERTAINTY") ? "#ffaa00" :
                                regime.includes("SHIFT") ? "#00c8ff" :
                                    "#00ff9c",
                    font: "14px sans-serif",
                    fontWeight: "bold",
                    textAlign: "center"
                }
            },

            // 🔵 Title Guide
            {
                type: "text",
                left: "70%",
                top: "15%",
                z: 100,
                style: {
                    text:
                        `IV TERM STRUCTURE GUIDE

1. Front IV >> Back IV
- Event / Panic / Short-term Hedging

2. Back IV >> Front IV
- Long-term Uncertainty

3. Diverging Slopes
- Convexity Regime Shift`,
                    fill: "#ddd",
                    font: "12px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            }

        ],

        series: series
    }, true) // 🔥 force replace
}

function renderMultiExpiryGEX(optionChains, current_spot, gamma_flip) {

    if (!snapshotCharts.gex) return

    let chart = snapshotCharts.gex
    chart.clear()

    if (!optionChains || typeof optionChains !== "object") return

    let series = []
    let allStrikes = new Set()

    let expiries = Object.keys(optionChains)

    expiries.forEach((expiry, idx) => {

        let chain = optionChains[expiry]
        if (!Array.isArray(chain)) return

        let data = []

        chain.forEach(opt => {

            if (!opt || opt.strike == null) return

            let gex = opt.net_gex ?? ((opt.call_gex || 0) - (opt.put_gex || 0))

            data.push([Number(opt.strike), Number(gex)])
            allStrikes.add(Number(opt.strike))
        })

        data.sort((a, b) => a[0] - b[0])

        series.push({
            name: formatExpiry(expiry),
            type: "line",
            smooth: true,
            data: data,
            lineStyle: {width: 2}
        })
    })

    if (series.length === 0) return

    let strikes = Array.from(allStrikes).sort((a, b) => a - b)
    let regime = detectGEXRegime(optionChains)
    let marketState = detectMarketState(
        optionChains,
        current_spot,
        gamma_flip
    )

    chart.setOption({

        backgroundColor: "#111",

        title: {
            text: "",
            left: "center",
            textStyle: {color: "#fff"}
        },

        tooltip: {
            trigger: "axis",
            formatter: function (params) {

                let text = `Strike: ${params[0].axisValue}<br>`

                params.forEach(p => {
                    text += `${p.seriesName}: ${p.data[1].toFixed(0)}<br>`
                })

                return text
            }
        },

        legend: {
            top: 30,
            textStyle: {color: "#fff"}
        },

        xAxis: {
            type: "value",
            name: "Strike",
            min: Math.min(...strikes) - 5,
            max: Math.max(...strikes) + 5,
            axisLabel: {color: "#fff"}
        },

        yAxis: {
            type: "value",
            name: "Net GEX",
            axisLabel: {color: "#fff"}
        },
        graphic: [
            // 🔥 Regime label
            {
                type: "text",
                left: "center",
                top: 5,
                z: 100,
                style: {
                    text: `GEX Regime: ${regime}`,
                    fill:
                        regime.includes("SHORT") ? "#ff4d4d" :
                            regime.includes("LONG") ? "#00ff9c" :
                                regime.includes("FRONT") ? "#ffaa00" :
                                    "#00c8ff",
                    font: "14px sans-serif",
                    fontWeight: "bold",
                    textAlign: "center"
                }
            },
            // 📘 Guide (left side)
            {
                type: "text",
                left: "10%",
                top: "15%",
                style: {
                    text:
                        `GEX REGIME GUIDE

FULL SHORT GAMMA
- Market unstable, trend amplification

FULL LONG GAMMA
- Mean reversion, suppressed volatility

FRONT INSTABILITY
- Near-term risk (most dangerous)

BACK INSTABILITY
- Structural longer-term imbalance`,
                    fill: "#e4de09",
                    opacity: 0.3,
                    font: "12px monospace",
                    lineHeight: 18
                }
            },
            {
                type: "text",
                left: "70%",
                top: "15%",
                style: {
                    text:
                        `GEX TERM STRUCTURE GUIDE

Above 0 - Long Gamma (Stability)
Below 0 - Short Gamma (Instability)

Front < Back - Near-term risk
Back < Front - Longer-term positioning

Sharp Peaks - Gamma Walls`,
                    fill: "#ccc",
                    font: "12px monospace",
                    opacity: 0.5,
                    lineHeight: 18
                }
            },
            {
                type: "text",
                left: "center",
                top: 25,
                z: 100,
                style: {
                    text: `MARKET STATE: ${marketState}`,
                    fill:
                        marketState.includes("BREAKOUT") ? "#ff3b3b" :
                            marketState.includes("TRANSITION") ? "#ffaa00" :
                                marketState.includes("REVERSION") ? "#00ff9c" :
                                    marketState.includes("CRASH") ? "#ff0000" :
                                        "#00c8ff",
                    font: "16px sans-serif",
                    fontWeight: "bold",
                    textAlign: "center"
                }
            }],

        series: series,

        // 🔥 Zero line (VERY IMPORTANT)
        markLine: {
            silent: true,
            lineStyle: {color: "#888", type: "dashed"},
            data: [{yAxis: 0}]
        },
    }, true)
}

function renderSnapshotsList(data) {

    const container = document.getElementById("snapshotContainer")
    if (!container) return

    container.innerHTML = ""

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `<p style="color:#888">No snapshot available</p>`
        return
    }
    initSnapshotCharts()

    data.forEach(snapshot => {

        const regime = snapshot.regime_state || {}
        const spot = snapshot.spot_snapshot?.[0] || {}
        const strategy = snapshot.strategy_output || []
        // console.log(regime.instability_pockets)

        const card = document.createElement("div")
        card.className = "snapshot-card"

        card.innerHTML = `
            ${renderHeader(snapshot, spot)}
            ${renderSummary(regime)}
            ${renderVolatility(regime)}
            ${renderGamma(regime)}
            ${renderRisk(regime)}
            ${renderStrategy(strategy)}
            
       
            
        `
        setTimeout(() => {
            renderInstabilityPocketsTable(regime)
            renderConvexityTrapsTable(regime)
            renderSnapshotIVSkew(snapshot.option_chains)
            renderMultiExpiryGEX(snapshot.option_chains,
                regime.current_spot,
                regime.gamma_flip)
            renderObjectInspectorTable(
                regime,
                "regimeStateTable",
                "Regime State Overview"
            )
        }, 0)


        container.appendChild(card)
    })
}


// -----------------------------
// GEX CHART
// -----------------------------
function renderGEXChart(container, optionChains, regime) {

    if (!container) return

    const firstExpiry = Object.values(optionChains)[0]
    if (!firstExpiry) return

    const strikes = firstExpiry.map(r => r.strike)
    const gex = firstExpiry.map(r => r.net_gex || 0)

    const chart = echarts.init(container)

    chart.setOption({
        xAxis: {type: 'category', data: strikes},
        yAxis: {type: 'value'},
        tooltip: {trigger: 'axis'},
        series: [{
            data: gex,
            type: 'line',
            smooth: true
        }],
        markLine: {
            data: [
                {xAxis: regime.gamma_flip, name: 'Gamma Flip'},
                {xAxis: regime.current_spot, name: 'Spot'}
            ]
        }
    })
}