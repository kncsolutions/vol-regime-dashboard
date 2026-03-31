const RealtimeRenderer = (() => {

    let chart = null
    let candleSeries = null
    let realtimeInterval = null
    let container = null

    // 🔥 NEW STATE
    let universe = new Map()   // all stocks from API
    let watchlist = new Map()  // selected stocks
    let activeTimeframe = "1d"

    let ws = null
    let currentSecurityId = null;
    let ltpLine = null;
    let isLoading = false;
    let gammaFlipLine = null;  // ✅ ADD THIS
    let lastGammaLadder = null;
    let currentSpot = null;


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
    ltpLine = candleSeries.createPriceLine({
    price: 0,
    color: "#FFD700",
    lineWidth: 2,
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
}
function drawGammaFlip(flipPrice) {
    if (!candleSeries || !flipPrice) return;

    // remove old line
    if (gammaFlipLine) {
        candleSeries.removePriceLine(gammaFlipLine);
    }

    gammaFlipLine = candleSeries.createPriceLine({
        price: flipPrice,
        color: "#FFD700",
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: "Gamma Flip"
    });
}
function getGammaRegime(spot, flip) {
    return spot > flip ? "LONG" : "SHORT";
}
function prepareGEXHistogram(gammaLadder) {
    return gammaLadder.map(d => ({
        x: d.strike,
        y: d.gex
    }));
}
function findClosestStrike(gammaLadder, spot) {
    return gammaLadder.reduce((prev, curr) =>
        Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot)
            ? curr
            : prev
    );
}
function computeConvexity(gexGradient) {
    return gexGradient.reduce((sum, g) => sum + Math.abs(g.gradient), 0);
}
function computeAmplification(netGEX) {
    return netGEX < 0 ? "HIGH" : "LOW";
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
//Web Socket

function startWebSocket() {

    stopWebSocket(); // prevent duplicates

    ws = new WebSocket("ws://localhost:8001/ws");

    ws.onopen = () => {
        console.log("✅ WS connected");
    };

    // ✅ PUT YOUR CODE HERE
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Tick:", data.securityId, "Active:", currentSecurityId);
        console.log("WS DATA:\n", JSON.stringify(data, null, 2));
         // 🔥 filter by active stock
        if (String(data.securityId) !== String(currentSecurityId)) return;

        // 🔥 filter by active stock
        if (data.securityId !== currentSecurityId) return;

        handleTick(data);
    };

    ws.onclose = () => {
        console.warn("WS closed, reconnecting...");
        setTimeout(startWebSocket, 2000);
    };

    ws.onerror = (err) => {
        console.error("WS error:", err);
    };
}

function stopWebSocket() {
    if (ws) {
        ws.close()
        ws = null
    }
}
let currentCandle = null
let currentBucket = null
let timeframeSec = 60  // default 1m

function getBucket(ts) {
    return Math.floor(ts / timeframeSec) * timeframeSec
}

function handleTick(tick) {
    if (!tick.ltp || !tick.timestamp) return

    const ts = Math.floor(tick.timestamp)
    const price = tick.ltp

    const bucket = getBucket(ts)

    // 🔹 NEW CANDLE
    if (currentBucket !== bucket) {
        currentBucket = bucket

        currentCandle = {
            time: bucket,
            open: price,
            high: price,
            low: price,
            close: price
        }
        if (tick.ltp) {
            updateLTPLine(tick.ltp);
        }

        updateCandle(currentCandle)
        return
    }

    // 🔹 UPDATE EXISTING
    currentCandle.high = Math.max(currentCandle.high, price)
    currentCandle.low = Math.min(currentCandle.low, price)
    currentCandle.close = price

    updateCandle(currentCandle)
}

function updateLTPLine(price) {
    if (!ltpLine) return;

    ltpLine.applyOptions({
        price: price
    });
}
    //--------------------------------------------------
    // 📋 UNIVERSE UI (CLICK TO SELECT)
    //--------------------------------------------------
    function initSearch(universe) {
    const input = document.getElementById("stock-search")

    if (!input) return

    input.oninput = () => {
    renderUniverseUI(universe)
};
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
    // 🔥 ADD THIS
    currentSecurityId = String(security_id);
    const lotSize = stock.lotSize

    console.log("Selected:", symbol, security_id, lotSize)

    // 👇 This is your real pipeline trigger
    loadStockforCharting({
        symbol,
        security_id,
        lotSize
    })
}
function drawGEXLadder(gammaLadder) {

    const overlay = document.getElementById("gex-overlay");
    if (!overlay || !candleSeries) return;

    overlay.innerHTML = "";

    const spot = currentSpot;
    if (!spot) return;

    const maxGEX = Math.max(...gammaLadder.map(d => Math.abs(d.gex))) || 1;

    gammaLadder.forEach(d => {

        // 🔥 filter near price
        if (Math.abs(d.strike - spot) > 50) return;

        const y = candleSeries.priceToCoordinate(d.strike);

        if (y === null) return;

        const width = (Math.abs(d.gex) / maxGEX) * 120;

        const bar = document.createElement("div");

        bar.style.position = "absolute";
        bar.style.top = `${y}px`;
        bar.style.height = "3px";
        bar.style.width = `${width}px`;
        bar.style.left = "50%";
        bar.style.zIndex = "10";

        bar.style.transform = d.gex > 0
            ? "translateX(0)"
            : "translateX(-100%)";

        bar.style.background = d.gex > 0
            ? "#00ff9c"
            : "#ff4d4f";

        overlay.appendChild(bar);
        overlay.title = "Gamma Exposure";
    });
}
function updateGEXTitle(gammaLadder) {
    const el = document.getElementById("gex-title");
    if (!el || !gammaLadder) return;

    const max = Math.max(...gammaLadder.map(d => Math.abs(d.gex)));

    el.innerText = `GEX Ladder (max: ${max.toFixed(0)})`;
}
let listenersAttached = false;

function attachGEXListeners() {

    if (listenersAttached) return;
    listenersAttached = true;

    const redraw = () => {
        if (lastGammaLadder && currentSpot) {
            drawGEXLadder(lastGammaLadder);
        }
    };

    // ✅ zoom / pan
    chart.timeScale().subscribeVisibleTimeRangeChange(redraw);

    // ✅ more precise zoom tracking
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);

    // ✅ optional (smooth updates)
    chart.subscribeCrosshairMove(redraw);
}
function isValidOC(optionChain) {
    const oc = optionChain?.data?.data?.oc;

    return oc && Object.keys(oc).length > 0;
}
let requestId = 0;
let lastValidOC = null;

async function loadStockforCharting({ symbol, security_id, lotSize }) {
    if (isLoading) {
        console.warn("⏳ Skipping duplicate load");
        return;
    }

    const currentRequest = ++requestId;

    const params = new URLSearchParams({
        underlying_security: symbol,
        tf: activeTimeframe
    });

    try {
        console.log("📡 Loading:", symbol, activeTimeframe);

        const [histRes, ocRes] = await Promise.all([
            authFetch(`${API}/historical/${security_id}?${params}`),
            authFetch(`${API}/option-chain/${security_id}?${params}`)
        ]);
//,authFetch(`${API}/quote/${security_id}?${params}`
        const historical = await histRes.json();
         // ----------------------------
        // ✅ ALWAYS RENDER CHART
        // ----------------------------
        if (historical.status === "success" || ("close" in historical)) {

            console.log("hist data fetched");

            if (activeTimeframe === "1d") {
                renderChart(historical.data, activeTimeframe);
            } else {
                renderChart(historical, activeTimeframe);
            }
        }
//         const quote = await quoteRes.json();

//        const spot =
//            quote?.data?.[security_id]?.last_price;
//
//        console.log("📍 Spot:", quoteRes);

        const optionChain = await ocRes.json();


        // 🔥 Ignore stale responses
        if (currentRequest !== requestId) {
            console.warn("⚠️ Stale response ignored");
            return;
        }
        console.log('here')

        // ----------------------------
        // ✅ OPTION CHAIN HANDLING
        // ----------------------------
        let ocToUse = null;

        if (isValidOC(optionChain)) {
            lastValidOC = optionChain;
            ocToUse = optionChain;

            console.log("OC KEYS:",
                Object.keys(optionChain?.data?.data?.oc || {})
            );

        } else {
            console.warn("⚠️ Invalid OC, using last valid");

            if (!lastValidOC) {
                console.warn("❌ No fallback OC available");
            } else {
                ocToUse = lastValidOC;
            }
        }

        // 🔥 Process only if we have valid OC
        if (ocToUse) {
    const result = processOptionChain(ocToUse);

    const flip = computeGammaFlip(result.gammaLadder);

    lastGammaLadder = result.gammaLadder;
//    lastGammaLadder = result.gammaLadder;

    updateGEXTitle(result.gammaLadder);

    // 🔥 DELAY DRAWING
    requestAnimationFrame(() => {
        drawGEXLadder(result.gammaLadder);
        drawGammaFlip(flip);
    });

    const regime = getGammaRegime(currentSpot, flip);

    console.log("Regime:", regime);
}


        // ----------------------------
        resetRealtimeState();
        //startWebSocket();

    } catch (e) {
        console.error("❌ loadStock error:", e);
    }
}

function resetRealtimeState() {
    currentCandle = null
    currentBucket = null
}

function toISTDate(ts) {
    const date = new Date(ts * 1000)

    return date.toLocaleDateString("en-CA", {   // YYYY-MM-DD format
        timeZone: "Asia/Kolkata"
    })
}
function toISTDateTimeIntraday(ts) {
    // If timestamp is in seconds → convert to ms
    if (ts < 1e12) ts = ts * 1000;

    const date = new Date(ts);

    // Convert to IST using Intl
    const options = {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    };

    const parts = new Intl.DateTimeFormat("en-GB", options)
        .formatToParts(date);

    const get = (type) => parts.find(p => p.type === type).value;

    return `${get("year")}-${get("month")}-${get("day")} ` +
           `${get("hour")}:${get("minute")}:${get("second")}`;
}

function toChartDate(ts) {
    if (ts < 1e12) ts *= 1000;

    // IMPORTANT: use UTC ISO, not IST
    return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD
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
    // 🔥 force chart to recalc scale
    chart.timeScale().fitContent();

    // 🔥 force intraday rendering
    chart.applyOptions({
        timeScale: {
            timeVisible: !isDaily,
            secondsVisible: tf === "1m"
        }
    })
    const lastCandle = unique[unique.length - 1];
    const spot = lastCandle?.close;
    currentSpot = spot;

    console.log("📍 Spot (from chart):", spot);
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
//---------------------------------
//Helper Functions------------
//---------------------------------
function computeGammaFlip(gammaLadder) {
    for (let i = 1; i < gammaLadder.length; i++) {
        const prev = gammaLadder[i - 1];
        const curr = gammaLadder[i];

        if (prev.gex < 0 && curr.gex > 0) {
            return curr.strike;
        }
    }
    return null;
}
function extractOC(optionChain) {
    return optionChain?.data?.data?.oc || {};
}
    function normalizeOC(oc) {
    const rows = [];

    Object.entries(oc).forEach(([strikeStr, value]) => {
        const strike = Number(strikeStr);

        const ce = value.ce || {};
        const pe = value.pe || {};

        rows.push({
            strike,

            ce_gamma: Number(ce.greeks?.gamma || 0),
            pe_gamma: Number(pe.greeks?.gamma || 0),

            ce_oi: Number(ce.oi || 0),
            pe_oi: Number(pe.oi || 0),

            ce_vega: Number(ce.greeks?.vega || 0),
            pe_vega: Number(pe.greeks?.vega || 0)
        });
    });

    // sort by strike
    rows.sort((a, b) => a.strike - b.strike);

    return rows;
}
    function computeGammaLadder(rows) {
    return rows.map(r => {
        const ce_gex = r.ce_gamma * r.ce_oi;
        const pe_gex = -r.pe_gamma * r.pe_oi; // puts negative

        return {
            strike: r.strike,
            gex: ce_gex + pe_gex
        };
    });
}
    function computeNetGEX(gammaLadder) {
    return gammaLadder.reduce((sum, r) => sum + r.gex, 0);
}
    function computeVegaLadder(rows) {
    return rows.map(r => {
        const ce_v = r.ce_vega * r.ce_oi;
        const pe_v = r.pe_vega * r.pe_oi;

        return {
            strike: r.strike,
            vega: ce_v + pe_v
        };
    });
}
    function computeGEXGradient(gammaLadder) {
    const gradient = [];

    for (let i = 1; i < gammaLadder.length; i++) {
        const prev = gammaLadder[i - 1];
        const curr = gammaLadder[i];

        const dGEX = curr.gex - prev.gex;
        const dS = curr.strike - prev.strike;

        gradient.push({
            strike: curr.strike,
            gradient: dGEX / dS
        });
    }

    return gradient;
}
    function processOptionChain(optionChain) {

    const oc = extractOC(optionChain);

    const rows = normalizeOC(oc);

    const gammaLadder = computeGammaLadder(rows);
    const netGEX = computeNetGEX(gammaLadder);
    const vegaLadder = computeVegaLadder(rows);
    const gexGradient = computeGEXGradient(gammaLadder);

    return {
        rows,
        gammaLadder,
        netGEX,
        vegaLadder,
        gexGradient
    };
}

    //--------------------------------------------------
    // 📦 EXPORT
    //--------------------------------------------------
    return {
        initRealtimeChart,
        setInitialData,
        initSearch,
        renderUniverseUI,
        updateCandle,
        startRealtime,
        startRealtimeFake,
        stopRealtime,
        destroy
    }

})()