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
    let quoteInterval = null


    document.querySelectorAll(".tf-selector button").forEach(btn => {
    btn.onclick = () => {

        // update UI
        document.querySelectorAll(".tf-selector button")
            .forEach(b => b.classList.remove("active"))

        btn.classList.add("active")

        // update state
        activeTimeframe = btn.dataset.tf
        setTimeframe(activeTimeframe)
        stopQuotePolling()
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
}
function updateLTPLine(ltp) {

    if (!ltpLine || !ltp) return

    ltpLine.applyOptions({
        price: ltp
    })
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
    initGEXGradientChart();
    initVegaChart();
    initVegaSkewChart();
    initOIChart();
    initOIChangeChart();
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

                if (currentSecurityId) {
                    subscribe(currentSecurityId);
                } else {
                    console.warn("⚠️ No securityId yet");
                }
            };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        console.log("Tick:", data.securityId, "Active:", currentSecurityId);

        // ✅ Keep ONLY ONE check (you had duplicate)
        //if (String(data.securityId) !== String(currentSecurityId)) return;

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

    // 🔥 SPECIAL CASE: DAILY TF
    if (activeTimeframe === "1d") {
        currentCandle.close = tick.ltp
        currentCandle.high = Math.max(currentCandle.high, tick.ltp)
        currentCandle.low = Math.min(currentCandle.low, tick.ltp)

        updateCandle(currentCandle)
        return
    }

    // ⬇️ existing logic
    const ts = Math.floor(tick.timestamp)
    const price = tick.ltp
    const bucket = getBucket(ts)

    if (currentBucket !== bucket) {
        if (currentCandle) {
            onCandleClose(currentCandle);
        }

        currentBucket = bucket

        currentCandle = {
            time: bucket,
            open: price,
            high: price,
            low: price,
            close: price
        }
        console.log({
                tf: activeTimeframe,
                currentBucket,
                tickTime: Math.floor(tick.timestamp),
            });
        if (!currentCandle) return;

        updateCandle(currentCandle)
        return
    }

    currentCandle.high = Math.max(currentCandle.high, price)
    currentCandle.low = Math.min(currentCandle.low, price)
    currentCandle.close = price

    updateCandle(currentCandle)
}
function onCandleClose(candle) {
    // ❌ skip 1m timeframe
    if (activeTimeframe === "1m") return;

    console.log("🕒 Candle closed:", candle, "TF:", activeTimeframe);
    console.log("🕒 Candle closed:", candle);

    // 🔥 run heavy logic here
    updateOptionChain(activeStock, currentSecurityId);
}
function subscribe(securityId) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
        type: "switch",
        securityId: String(securityId)
    }));

    console.log("📡 Subscribed to:", securityId);
}
function changeSecurity(securityId) {
    currentSecurityId = String(securityId);

    subscribe(currentSecurityId);
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
        stopQuotePolling()

        setActiveStock(selected)
    }
}

function setActiveStock(symbol) {
    stopSafeUpdateLoop(); // 🔥 prevent leak


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
     startSafeUpdateLoop({
        symbol,
        security_id,
        interval: 3 * 60 * 1000 // N minutes
    })
}
function drawGEXLadder(gammaLadder) {

    const overlay = document.getElementById("gex-overlay");
    if (!overlay || !candleSeries) return;

    overlay.innerHTML = "";

    const spot = currentSpot;
    console.log("drawGEXLadder spot:", currentSpot);
    if (!spot) return;

    const maxGEX = Math.max(...gammaLadder.map(d => Math.abs(d.gex))) || 1;

    gammaLadder.forEach(d => {

        // 🔥 filter near price
        if (Math.abs(d.strike - spot)/spot > 0.20) return;

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
///////////////////////////////////
////update every n periods
//////////////////////////////////
async function updateOptionChain(symbol, security_id) {

    const params = new URLSearchParams({
        underlying_security: symbol,
        tf: activeTimeframe
    });

    const request = ++requestId;

    try {
        const res = await authFetch(
            `${API}/option-chain/${security_id}?${params}`
        );

        const optionChain = await res.json();

        // 🔥 stale protection
        if (request !== requestId) return;

        let ocToUse = isValidOC(optionChain)
            ? (lastValidOC = optionChain)
            : lastValidOC;

        if (!ocToUse) return;

        const result = processOptionChain(ocToUse);
        const flip = computeGammaFlip(result.gammaLadder);

        lastGammaLadder = result.gammaLadder;
        lastGEXGradient = result.gexGradient;

        const ivData = extractIVData(ocToUse);

        requestAnimationFrame(() => {
            drawGEXLadder(result.gammaLadder);
            drawGammaFlip(flip);
            renderGEXGradientEChart(result.gexGradient);
            renderVegaLadder(result.vegaLadder);
            renderVegaSkew(result.vegaSkew);
            plotIVChart("iv-smile-panel", ivData);
            plotIVStructure("iv-structure-panel", ivData.data, ivData.spot);
            renderOI(result.rows);
            renderOIChange(result.rows);
        });

    } catch (e) {
        console.error("OC update error:", e);
    }
}
let updateLoopRunning = false;

async function startSafeUpdateLoop({ symbol, security_id, interval = 60000 }) {

    if (updateLoopRunning) return;
    updateLoopRunning = true;

    while (updateLoopRunning) {

        const start = Date.now();

        await updateOptionChain(symbol, security_id);

        const elapsed = Date.now() - start;
        const delay = Math.max(0, interval - elapsed);

        await new Promise(res => setTimeout(res, delay));
    }
}
function stopSafeUpdateLoop() {
    updateLoopRunning = false;
}
function setTimeframe(tf) {
    const map = {
        "1m": 60,
        "5m": 300,
        "15m": 900,
        "1h": 3600
    }

    timeframeSec = map[tf] || 60
}
async function pollCandle() {


    try {
    const res = await authFetch(
        `${API}/historical/${security_id}?${params}`
    ) }catch (e) {
        console.error("❌ loadStock error:", e);
    }

    const data = await res.json()

    handleTick({
        ltp: data.price,
        timestamp: Date.now() / 1000
    })
}
let candleInterval = null;

function startCandlePolling(interval = 2000) {

    // prevent duplicates
    if (candleInterval) return;

    candleInterval = setInterval(() => {
        pollCandle();
    }, interval);

    console.log("▶️ Candle polling started");
}
function stopCandlePolling() {
    if (candleInterval) {
        clearInterval(candleInterval);
        candleInterval = null;
        console.log("⏹ Candle polling stopped");
    }
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
        changeSecurity(security_id);
        console.log("📡 Loading:", symbol, activeTimeframe);

        const [histRes, ocRes] = await Promise.all([
            authFetch(`${API}/historical/${security_id}?${params}`),
            authFetch(`${API}/option-chain/${security_id}?${params}`)
        ]);
        const historical = await histRes.json();
         // ----------------------------
        // ✅ ALWAYS RENDER CHART
        // ----------------------------
        if (historical.status === "success" || ("close" in historical)) {

            console.log("hist data fetched");

            if (activeTimeframe === "1d") {
                renderChart(historical.data, activeTimeframe, security_id,  symbol);
            } else {
                renderChart(historical, activeTimeframe, security_id,  symbol);
            }
        }

        const optionChain = await ocRes.json();





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
                lastGEXGradient = result.gexGradient;
                const ivData = extractIVData(ocToUse);
                console.log('ivdata', ivData.data)
//                const { gradient, curvature } = computeIVStructure(ivData.data);





                // 🔥 DELAY DRAWING
                setTimeout(() => {

                    drawGEXLadder(result.gammaLadder);
                    drawGammaFlip(flip);
                    renderGEXGradientEChart(result.gexGradient);
                    renderVegaLadder(result.vegaLadder);
                    renderVegaSkew(result.vegaSkew);
                    plotIVChart("iv-smile-panel", ivData);
                    plotIVStructure(
                        "iv-structure-panel",
                        ivData.data,
                        ivData.spot
                    );
                    renderOI(result.rows);
                    renderOIChange(result.rows);

                }, 0);

    const regime = getGammaRegime(currentSpot, flip);

    console.log("Regime:", regime);
     // 🔥 Ignore stale responses
        if (currentRequest !== requestId) {
            console.warn("⚠️ Stale response ignored");
            return;
        }
}


        // ----------------------------
        resetRealtimeState();
//        startWebSocket();

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

function renderChart(data, tf, security_id, symbol) {

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
    // 🔥 ADD THIS
    chart.timeScale().getVisibleRange();

    // 🔥 force intraday rendering
    chart.applyOptions({
        timeScale: {
            timeVisible: !isDaily,
            secondsVisible: tf === "1m"
        }
    })
    const lastCandle = unique[unique.length - 1];
    currentCandle = { ...lastCandle };   // 🔥 REQUIRED
    currentBucket = lastCandle.time;
    const spot = lastCandle?.close;
    currentSpot = spot;

    console.log("📍 Spot (from chart):", spot);
    // 🔥 START POLLING HERE
    startQuotePolling({
        security_id: security_id,
        symbol: symbol,
        candles,
        interval: 2000  // every 3 sec
    })

}
/////////////////////////////////
///LTP Quote/////
/////////////////////////////
function extractSpotFromQuote(response) {

    const quote = extractQuoteNode(response)

    return quote?.last_price || null
}
function extractQuoteNode(response) {

    let node = response

    // 🔥 unwrap nested "data" layers dynamically
    while (node && node.data) {
        node = node.data
    }

    // now node = { NSE_EQ: {...} } OR { IDX_I: {...} }

    if (!node) return null

    const exchangeKey = Object.keys(node)[0]
    const exchangeData = node[exchangeKey]

    const securityKey = Object.keys(exchangeData)[0]

    return exchangeData[securityKey]
}
function resolveSpot(newSpot, candles) {

    if (newSpot && newSpot > 0) {
        currentSpot = newSpot
        console.log("📍 Spot (from quote):", currentSpot)
        return
    }

    if (currentSpot) {
        console.log("📍 Spot (fallback: previous):", currentSpot)
        return
    }

    const lastCandle = candles?.[candles.length - 1]
    const fallbackSpot = lastCandle?.close

    if (fallbackSpot) {
        currentSpot = fallbackSpot
        console.log("📍 Spot (from chart):", currentSpot)
    }
}
function startQuotePolling({security_id, symbol, candles, interval = 5000 }) {

    // clear existing loop
    if (quoteInterval) {
        clearInterval(quoteInterval)
    }
    console.log('Quotesmbol:', symbol)

    quoteInterval = setInterval(async () => {
        try {
        const params = new URLSearchParams({
                underlying_security: symbol
            });
            const res = await authFetch(
                `${API}/quote/${security_id}?${params}`
            )

            const data = await res.json()
            console.log("QuoteData:", data)

            const newSpot = extractSpotFromQuote(data)

            resolveSpot(newSpot, candles)
            // 🔥 THIS drives the right-side label
            updateLTPLine(newSpot)
            handleTick({
                ltp: newSpot,
                timestamp: Date.now() / 1000
            });

            // 🔥 OPTIONAL: trigger updates
            // updateIVChart(currentSpot)
            // updateGammaChart(currentSpot)

        } catch (err) {
            console.error("Quote fetch error:", err)

            // fallback on failure
            resolveSpot(null, candles)
        }

    }, interval)
}
function stopQuotePolling() {
    if (quoteInterval) {
        clearInterval(quoteInterval)
        quoteInterval = null
    }
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

 //----------------------------------
 //----Other Charts----------
 //-------------------------------
 let gexGradientChart = null;

function initGEXGradientChart() {
    const el = document.getElementById("gex-gradient-panel");
    if (!el) return;

    if (gexGradientChart) {
        gexGradientChart.dispose();
    }

    gexGradientChart = echarts.init(el);

    const option = {
        backgroundColor: "#111",
        grid: {
            left: 50,
            right: 20,
            top: 10,
            bottom: 30
        },
        xAxis: {
            type: "value",
            name: "Gradient",
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },
        yAxis: {
            type: "value",
            name: "Strike",
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },
        series: [{
            type: "bar",
            data: []
        }]
    };

    gexGradientChart.setOption(option);
}
function renderGEXGradientEChart(gexGradient) {

    if (!gexGradientChart || !gexGradient) return;

    const spot = currentSpot;

    // 🔹 Step 1: filter
    const range = currentSpot * 0.20; // 3%

        const filtered = gexGradient.filter(v =>
            !spot || Math.abs(v.strike - spot) <= range
        );


    // 🔹 Step 2: sort
    filtered.sort((a, b) => a.strike - b.strike);

    // 🔹 Step 3: x-axis (strikes)
    const strikes = filtered.map(g => g.strike);

    // ✅ Step 4: REPLACE gradients with styled data
    const data = filtered.map(g => ({
        value: g.gradient,
        itemStyle: {
            color: g.gradient > 0 ? "#00bfff" : "#ff0066"
        }
    }));

    // 🔹 Step 5: render
    gexGradientChart.setOption({
        xAxis: {
            type: "category",
            data: strikes
        },
        yAxis: {
            type: "value"
        },
        series: [{
            type: "line",
            data: data,
            smooth: true,
            areaStyle: { opacity: 0.2 },
            lineStyle: { width: 2 },

            markLine: {
                data: [{ yAxis: 0 }],
                lineStyle: {
                    color: "#FFD700"
                }
            },
        }],
        tooltip: {
                trigger: "axis",
                axisPointer: {
                    type: "cross"
                },
                backgroundColor: "#222",
                borderColor: "#555",
                textStyle: {
                    color: "#fff"
                },
                formatter: function (params) {
                    const p = params[0];  // single series

                    const strike = p.axisValue;
                    const gradient = p.data.value;

                    return `
                        <b>Strike:</b> ${strike}<br/>
                        <b>Gradient:</b> ${gradient.toFixed(2)}
                    `;
                }
            },
           grid: {
          left: 40,
          right: 20,
          top: 20,
          bottom: 80   // 👈 increase this
        },
        dataZoom: [{type: "inside"}, {type: "slider",height: 30,
    bottom: 10 } ]
    });
}
let vegaChart = null;

function initVegaChart() {
    const el = document.getElementById("vega-ladder-panel");
    if (!el) return;

    if (vegaChart) {
        vegaChart.dispose();
    }

    vegaChart = echarts.init(el);

    vegaChart.setOption({
        backgroundColor: "#111",
        grid: { left: 50, right: 20, top: 10, bottom: 30 },

        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            textStyle: { color: "#fff" }
        },

        xAxis: {
            type: "category",
            name: "Strike",
            axisLine: { lineStyle: { color: "#888" } },
            axisLabel: { color: "#AAA" }
        },

        yAxis: {
            type: "value",
            name: "Vega",
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },

        series: [{
            type: "bar",
            data: []
        }]
    });
}
function renderVegaLadder(vegaLadder) {

    if (!vegaChart || !vegaLadder) return;

    const spot = currentSpot;

    // 🔥 focus near spot
    const range = currentSpot * 0.20; // 3%

        const filtered = vegaLadder.filter(v =>
            !spot || Math.abs(v.strike - spot) <= range
        );

    // 🔥 sort by strike
    filtered.sort((a, b) => a.strike - b.strike);

    const strikes = filtered.map(v => v.strike);

    const data = filtered.map(v => ({
        value: v.vega,
        itemStyle: {
            color: v.vega > 0 ? "#ffa500" : "#00ffcc"
        }
    }));

    vegaChart.setOption({
        xAxis: {
            data: strikes
        },
        series: [{
            data: data
        }],
        grid: {
          left: 40,
          right: 20,
          top: 20,
          bottom: 80   // 👈 increase this
        },
        dataZoom: [{type: "inside"}, {type: "slider",height: 30,
    bottom: 10 } ]
    });
}

let vegaSkewChart = null;

function initVegaSkewChart() {
    const el = document.getElementById("vega-skew-panel");
    if (!el) return;

    if (vegaSkewChart) {
        vegaSkewChart.dispose();
    }

    vegaSkewChart = echarts.init(el);

    vegaSkewChart.setOption({
        backgroundColor: "#111",
        grid: { left: 50, right: 20, top: 10, bottom: 30 },

        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            textStyle: { color: "#fff" }
        },

        xAxis: {
            type: "category",
            name: "Strike",
            axisLine: { lineStyle: { color: "#888" } },
            axisLabel: { color: "#AAA" }
        },

        yAxis: {
            type: "value",
            name: "Vega",
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },

        series: [{
            type: "line",
            data: []
        }]
    });
}
function renderVegaSkew(vegaSkew) {

    if (!vegaSkewChart || !vegaSkew) return;

    const spot = currentSpot;

    // 🔥 focus near spot
    const range = currentSpot * 0.08; // 3%

        const filtered = vegaSkew.filter(v =>
            !spot || Math.abs(v.strike - spot) <= range
        );

    // 🔥 sort by strike
    filtered.sort((a, b) => a.strike - b.strike);

    const strikes = filtered.map(v => v.strike);

    const data = filtered.map(v => ({
        value: v.vega,
        itemStyle: {
            color: v.vega > 0 ? "#ffa500" : "#00ffcc"
        }
    }));

    vegaSkewChart.setOption({
        xAxis: {
            data: strikes
        },
        series: [{
            data: data
        }],
        grid: {
          left: 40,
          right: 20,
          top: 20,
          bottom: 80   // 👈 increase this
        },
        dataZoom: [{type: "inside"}, {type: "slider",height: 30,
    bottom: 10 } ]
    });
}
function plotIVChart(containerId, ivPayload) {

    const { data, spot } = ivPayload

    if (!Array.isArray(data) || data.length === 0) {
        console.warn("No IV data")
        return
    }

    const chart = echarts.init(document.getElementById(containerId))

    const strikes = data.map(d => d.strike)
    const ivValues = data.map(d => d.iv)

    const option = {
        grid: { left: 50, right: 20, top: 20, bottom: 70 },

        tooltip: {
            trigger: 'axis',
            formatter: p => {
                const d = p[0]
                return `Strike: ${d.axisValue}<br>IV: ${d.data.toFixed(2)}`
            }
        },

        xAxis: {
            type: 'category',
            data: strikes,
            name: 'Strike'
        },

        yAxis: {
            type: 'value',
            name: 'IV'
        },

        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 10 }
        ],

        series: [
            {
                name: 'IV (OTM)',
                type: 'line',
                data: ivValues,
                smooth: true,
                showSymbol: false,

                // 🔥 Highlight ATM (spot)
                markLine: {
                    symbol: 'none',
                    data: [
                        { xAxis: spot }
                    ],
                    label: {
                        formatter: 'Spot'
                    }
                }
            }
        ]
    }

    chart.setOption(option)
}
function plotIVStructure(containerId, ivData, spot) {

    if (!Array.isArray(ivData) || ivData.length < 3) {
        console.warn("Not enough IV data")
        return
    }

    const chart = echarts.init(document.getElementById(containerId))

    const { gradient, curvature } = computeIVStructure(ivData)

    const strikes = ivData.map(d => d.strike)

    const option = {
        grid: { left: 60, right: 60, top: 20, bottom: 70 },

        tooltip: { trigger: 'axis' },

        legend: {
            data: ['IV Gradient', 'IV Curvature']
        },

        xAxis: {
            type: 'category',
            data: strikes,
            name: 'Strike'
        },

        yAxis: [
            {
                type: 'value',
                name: '∂IV/∂K',
                position: 'left'
            },
            {
                type: 'value',
                name: '∂²IV/∂K²',
                position: 'right'
            }
        ],

        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],

        series: [
            {
                name: 'IV Gradient',
                type: 'line',
                data: gradient,
                smooth: true,
                yAxisIndex: 0
            },
            {
                name: 'IV Curvature',
                type: 'line',
                data: curvature,
                smooth: true,
                yAxisIndex: 1
            },
            {
                // 🔥 optional: mark spot
                type: 'line',
                markLine: {
                    symbol: 'none',
                    data: [{ xAxis: spot }],
                    label: { formatter: 'Spot' }
                }
            }
        ]
    }

    chart.setOption(option)
}
let oiChart = null;

function initOIChart() {
    const el = document.getElementById("oi-panel");
    if (!el) return;

    if (oiChart) oiChart.dispose();

    oiChart = echarts.init(el);

    oiChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },
        legend: { data: ["Call OI", "Put OI"] },

        xAxis: {
            type: "category",
            name: "Strike"
        },

        yAxis: {
            type: "value",
            name: "OI"
        },

        series: [
            { name: "Call OI", type: "bar", data: [] },
            { name: "Put OI", type: "bar", data: [] }
        ]
    });
}
function renderOI(rows) {
    if (!oiChart || !rows) return;

    const spot = currentSpot;
    const range = spot * 0.20;

    const filtered = rows.filter(r =>
        !spot || Math.abs(r.strike - spot) <= range
    );

    const strikes = filtered.map(r => r.strike);

    const callOI = filtered.map(r => r.ce_oi);
    const putOI = filtered.map(r => r.pe_oi);

    oiChart.setOption({
        xAxis: { data: strikes },
        series: [
            { name: "Call OI", data: callOI },
            { name: "Put OI", data: putOI }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}
let oiChangeChart = null;

function initOIChangeChart() {
    const el = document.getElementById("oi-change-panel");
    if (!el) return;

    if (oiChangeChart) oiChangeChart.dispose();

    oiChangeChart = echarts.init(el);

    oiChangeChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },
        legend: { data: ["Call del-OI", "Put del-OI"] },

        xAxis: {
            type: "category",
            name: "Strike"
        },

        yAxis: {
            type: "value",
            name: "del-OI"
        },

        series: [
            { name: "Call del-OI", type: "bar", data: [] },
            { name: "Put del-OI", type: "bar", data: [] }
        ]
    });
}
function renderOIChange(rows) {
    if (!oiChangeChart || !rows) return;

    const spot = currentSpot;
    const range = spot * 0.20;

    const filtered = rows.filter(r =>
        !spot || Math.abs(r.strike - spot) <= range
    );

    const strikes = filtered.map(r => r.strike);

    const callChange = filtered.map(r => r.ce_oi_change);
    const putChange = filtered.map(r => r.pe_oi_change);

    oiChangeChart.setOption({
        xAxis: { data: strikes },
        series: [
            { name: "Call del-OI", data: callChange },
            { name: "Put del-OI", data: putChange }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
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

            // EXISTING
            ce_gamma: Number(ce.greeks?.gamma || 0),
            pe_gamma: Number(pe.greeks?.gamma || 0),

            ce_oi: Number(ce.oi || 0),
            pe_oi: Number(pe.oi || 0),

            // 🔥 ADD THIS
            ce_oi_change: Number(ce.oi_change || ce.change_in_oi || ce.oi - ce.previous_oi || 0),
            pe_oi_change: Number(pe.oi_change || pe.change_in_oi || pe.oi - pe.previous_oi || 0),

            ce_vega: Number(ce.greeks?.vega || 0),
            pe_vega: Number(pe.greeks?.vega || 0)
        });
    });

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
function computeVegaSkew(rows) {
    return rows.map(r => {
        const net_oi = r.ce_oi - r.pe_oi
        const v_skew = ((r.ce_vega + r.pe_vega)/2 ) * net_oi

        return {
            strike: r.strike,
            vega: v_skew
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
            const vegaSkew = computeVegaSkew(rows);
            const gexGradient = computeGEXGradient(gammaLadder);

            return {
                rows,
                gammaLadder,
                netGEX,
                vegaLadder,
                vegaSkew,
                gexGradient
            };
}
function extractIVData(apiResponse) {

    const oc = apiResponse?.data?.data?.oc
    const spot = apiResponse?.data?.data?.last_price

    if (!oc || !spot) {
        console.error("Invalid data structure", apiResponse)
        return []
    }

    const result = []

    for (const strikeKey in oc) {

        const strike = parseFloat(strikeKey)
        const ce = oc[strikeKey].ce
        const pe = oc[strikeKey].pe

        const callIV = ce?.implied_volatility || 0
        const putIV = pe?.implied_volatility || 0

        // 🔥 YOUR LOGIC HERE
        let iv = strike >= spot ? callIV : putIV

        // fallback if chosen side is bad
        if (iv === 0) {
            iv = callIV || putIV
        }

        // skip garbage
        if (!iv || iv <= 0) continue

        result.push({
            strike,
            iv
        })
    }

    // sort strikes
    result.sort((a, b) => a.strike - b.strike)

    return { data: result, spot }
}
function computeIVStructure(ivData) {

    const gradient = []
    const curvature = []

    for (let i = 0; i < ivData.length; i++) {

        // Edge handling
        if (i === 0 || i === ivData.length - 1) {
            gradient.push(null)
            curvature.push(null)
            continue
        }

        const prev = ivData[i - 1]
        const curr = ivData[i]
        const next = ivData[i + 1]

        const dK = next.strike - prev.strike

        // 🔹 First derivative (central diff)
        const grad = (next.iv - prev.iv) / dK

        // 🔹 Second derivative (curvature)
        const curv =
            (next.iv - 2 * curr.iv + prev.iv) /
            Math.pow(next.strike - curr.strike, 2)

        gradient.push(grad)
        curvature.push(curv)
    }

    return { gradient, curvature }
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
        stopQuotePolling,
        destroy
    }

})()