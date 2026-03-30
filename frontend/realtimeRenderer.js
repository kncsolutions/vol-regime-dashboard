const RealtimeRenderer = (() => {

    let chart = null
    let candleSeries = null
    let realtimeInterval = null
    let container = null

    // 🔥 NEW STATE
    let universe = new Map()   // all stocks from API
    let watchlist = new Map()  // selected stocks
    let activeTimeframe = "1d"

    document.querySelectorAll(".tf-selector button").forEach(btn => {
    btn.onclick = () => {

        // update UI
        document.querySelectorAll(".tf-selector button")
            .forEach(b => b.classList.remove("active"))

        btn.classList.add("active")

        // update state
        activeTimeframe = btn.dataset.tf
        console.log("TF changed:", activeTimeframe)

        // reload current stock
        if (activeStock) {
            setActiveStock(activeStock)
        }
    }
})

    //--------------------------------------------------
    // 🧱 INIT CHART
    //--------------------------------------------------
    function initRealtimeChart(containerId) {
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
            downColor: "#ff4d4f"
        }
    )

    resizeChart()
    window.addEventListener("resize", resizeChart)
}
    //--------------------------------------------------
    // 📊 DATA
    //--------------------------------------------------
    function setInitialData(data) {
        if (!candleSeries) return
        candleSeries.setData(data)
    }

    function updateCandle(candle) {
        if (!candleSeries) return
        candleSeries.update(candle)
    }

    //--------------------------------------------------
    // 🔁 REALTIME
    //--------------------------------------------------
    function startRealtime(apiUrl, interval = 2000) {
        stopRealtime()

        realtimeInterval = setInterval(async () => {
            try {
                const res = await fetch(apiUrl)
                const data = await res.json()
                updateCandle(data)
            } catch (e) {
                console.error(e)
            }
        }, interval)
    }

    function stopRealtime() {
        if (realtimeInterval) {
            clearInterval(realtimeInterval)
            realtimeInterval = null
        }
    }

    function startRealtimeFake(interval = 2000) {

            if (realtimeInterval) return

            console.log("🧪 Starting FAKE realtime stream")

            let lastCandle = {
                time: Math.floor(Date.now() / 1000),
                open: 100,
                high: 102,
                low: 99,
                close: 101
            }

            realtimeInterval = setInterval(() => {

                const now = Math.floor(Date.now() / 1000)

                // simulate price movement
                let drift = (Math.random() - 0.5) * 2   // random walk
                let newClose = lastCandle.close + drift

                let candle = {
                    time: now,
                    open: lastCandle.close,
                    high: Math.max(lastCandle.close, newClose) + Math.random(),
                    low: Math.min(lastCandle.close, newClose) - Math.random(),
                    close: newClose
                }

                updateCandle(candle)

                lastCandle = candle

            }, interval)
}
    //--------------------------------------------------
    // 📋 UNIVERSE UI (CLICK TO SELECT)
    //--------------------------------------------------
    function initSearch(universe) {
    const input = document.getElementById("stock-search")

    if (!input) return

    input.addEventListener("input", () => {
        renderUniverseUI(universe)
    })
}
let stockMap = {}

function renderUniverseUI(stocks) {

    const list = document.getElementById("stockchartList")
    const input = document.getElementById("stockSelectchart")

    list.innerHTML = ""
    stockMap = {}

    // Build UI + map
    stocks.forEach(s => {

        // Map by symbol (UI key)
        stockMap[s.symbol] = {
            security_id: s.securityId,
            lotSize: s.lotSize,
            raw: s
        }

        const option = document.createElement("option")
        option.value = s.symbol   // 👈 what user sees/types
        list.appendChild(option)
    })

    const symbols = Object.keys(stockMap)

    if (symbols.length > 0) {

        let selected =
            activeStock ||
            localStorage.getItem("selectedStock") ||
            symbols[0]

        if (!stockMap[selected]) {
            selected = symbols[0]
        }

        setActiveStock(selected)
    }

    // Handle manual selection
    input.onchange = () => {
        const selected = input.value

        if (!stockMap[selected]) return

        setActiveStock(selected)
    }
}

function setActiveStock(symbol) {

    const input = document.getElementById("stockSelectchart")

    activeStock = symbol
    input.value = symbol

    localStorage.setItem("selectedStock", symbol)

    const stock = stockMap[symbol]

    // 🚀 Now you have everything cleanly
    const security_id = stock.security_id
    const lotSize = stock.lotSize

    console.log("Selected:", symbol, security_id, lotSize)

    // 👇 This is your real pipeline trigger
    loadStockforCharting({
        symbol,
        security_id,
        lotSize
    })
}
async function loadStockforCharting({ symbol, security_id, lotSize }) {

    const params = new URLSearchParams({
        underlying_security: symbol,
        tf: activeTimeframe   // 🔥 dynamic
    })

    const [histRes, ocRes] = await Promise.all([
        authFetch(`${API}/historical/${security_id}?${params}`),
        authFetch(`${API}/option-chain/${security_id}?${params}`)
    ])

    const historical = await histRes.json()


    const optionChain = await ocRes.json()
    console.log("option chain:"+optionChain)

    if (historical.status === "success" || "close" in historical) {
    console.log("hist data fetched")
    if (activeTimeframe === "1d")
        renderChart(historical.data, activeTimeframe)
     else
        renderChart(historical, activeTimeframe)
    }
}

function toISTDate(ts) {
    const date = new Date(ts * 1000)

    return date.toLocaleDateString("en-CA", {   // YYYY-MM-DD format
        timeZone: "Asia/Kolkata"
    })
}

function renderChart(data, tf) {

    const isDaily = tf === "1d"

    let candles = data.open.map((_, i) => ({
        time: isDaily
            ? toISTDate(data.timestamp[i])
            : Math.floor(data.timestamp[i]),
        open: data.open[i],
        high: data.high[i],
        low: data.low[i],
        close: data.close[i]
    }))

    // ✅ sort
    candles.sort((a, b) => a.time - b.time)

    // ✅ remove duplicates
    const unique = []
    const seen = new Set()

    for (const c of candles) {
        if (!seen.has(c.time)) {
            seen.add(c.time)
            unique.push(c)
        }
    }

    candleSeries.setData(unique)

    // 🔥 force intraday rendering
    chart.applyOptions({
        timeScale: {
            timeVisible: !isDaily,
            secondsVisible: tf === "1m"
        }
    })
}
    //--------------------------------------------------
    // ➕ ADD TO WATCHLIST
    //--------------------------------------------------
    function addToWatchlist(symbol) {

        if (watchlist.has(symbol)) return

        const stock = universe.get(symbol)
        if (!stock) return

        watchlist.set(symbol, stock)

        console.log("➕ Added:", symbol)

        renderWatchlistUI()
    }

    //--------------------------------------------------
    // ➖ REMOVE
    //--------------------------------------------------
    function removeFromWatchlist(symbol) {
        watchlist.delete(symbol)

        console.log("➖ Removed:", symbol)

        renderWatchlistUI()
    }

    //--------------------------------------------------
    // 📌 WATCHLIST UI
    //--------------------------------------------------
    function renderWatchlistUI() {
        const el = document.getElementById("watchlist")
        if (!el) return

        el.innerHTML = ""

        watchlist.forEach((stock, symbol) => {

            const row = document.createElement("div")
            row.className = "watchlist-item"

            row.innerText = symbol

            // 🔥 LOAD CHART
            row.onclick = () => {
                console.log("📊 Loading:", symbol)

                startRealtime(`/api/dashboard/${symbol}`)
            }

            // ❌ REMOVE BUTTON
            const btn = document.createElement("button")
            btn.innerText = "x"

            btn.onclick = (e) => {
                e.stopPropagation()
                removeFromWatchlist(symbol)
            }

            row.appendChild(btn)
            el.appendChild(row)
        })
    }

    //--------------------------------------------------
    // 📐 RESIZE
    //--------------------------------------------------
   function resizeChart() {
    if (!chart || !container) return

    chart.resize(
        container.clientWidth,
        container.clientHeight || 400
    )
}

    //--------------------------------------------------
    // 🧹 CLEANUP
    //--------------------------------------------------
    function destroy() {
        stopRealtime()

        if (chart) {
            chart.remove()
            chart = null
            candleSeries = null
        }

        window.removeEventListener("resize", resizeChart)
    }

    //--------------------------------------------------
    // 📦 EXPORT
    //--------------------------------------------------
    return {
        initRealtimeChart,
        setInitialData,
        initSearch,
        renderUniverseUI,
        addToWatchlist,
        updateCandle,
        startRealtime,
        startRealtimeFake,
        stopRealtime,
        destroy
    }

})()