// snapshotRenderer.js

// -----------------------------
// Format helpers
// -----------------------------
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
            <div>Time: ${new Date(Number(snapshot.timestamp)*1000).toLocaleString("en-IN")}</div>
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
function renderSnapshotsList(data) {

    const container = document.getElementById("snapshotContainer")
    if (!container) return

    container.innerHTML = ""

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `<p style="color:#888">No snapshot available</p>`
        return
    }

    data.forEach(snapshot => {

        const regime = snapshot.regime_state || {}
        const spot = snapshot.spot_snapshot?.[0] || {}
        const strategy = snapshot.strategy_output || []

        const card = document.createElement("div")
        card.className = "snapshot-card"

        card.innerHTML = `
            ${renderHeader(snapshot, spot)}
            ${renderSummary(regime)}
            ${renderVolatility(regime)}
            ${renderGamma(regime)}
            ${renderRisk(regime)}
            ${renderStrategy(strategy)}
            ${renderExpandable(regime)}
        `

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