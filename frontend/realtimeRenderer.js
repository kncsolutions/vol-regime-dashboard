import { FeatureEngine } from "./FeatureEngine.js";
import { RRPModel } from "./RRPModel.js";
import { GammaEngine } from "./GammaEngine.js";
import { GammaEncoder } from "./GammaEncoder.js";
import { VolEngine } from "./VolEngine.js";



const RealtimeRenderer = (() => {

    let chart = null
    let candleSeries = null
    let realtimeInterval = null
    let container = null

    // 🔥 NEW STATE
    let universe = new Map()   // all stocks from API
    let watchlist = new Map()  // selected stocks
    let activeTimeframe = "1d"

    let ws = null;
    let currentSecurityId = null;
    let currentSecurityName = null;
    let ltpLine = null;
    let isLoading = false;
    let gammaFlipLine = null;  // ✅ ADD THIS
    let lastGammaLadder = null;
    let currentSpot = null;
    let quoteInterval = null;
    const volFeatureBuffer = {
    size: 1000,
    index: 0,
    filled: false,

    timestamp: new Array(1000),

    atm_iv: new Array(1000),
    call_skew: new Array(1000),
    put_skew: new Array(1000),
    hv: new Array(1000),

    ltp: new Array(1000) // optional reuse
};

    const marketBuffer = {
    size: 1000,
    index: 0,
    filled: false,

    ltp: new Array(1000),
    ltq: new Array(1000),
    bid: new Array(1000),
    ask: new Array(1000),
    microprice: new Array(1000),
    timestamp: new Array(1000),
    };
    marketBuffer.imbalance = new Array(1000);
    marketBuffer.flow = new Array(1000);

    let alphaChart = null;
    let microChart = null;
    let imbalanceChart = null;
    let flowChart = null;
    let lbaChart = null;
    let rrpChart = null;

    // =========================
    // RRP ENGINE INSTANCE
    // =========================
    // =========================
    // GLOBAL MARKET STATE
    // =========================
    const marketState = {
        netGEX: 0,
        gexStd: 1,
        adv: 1e7,
        gexHistory: []
    };
    const featureEngine = new FeatureEngine();
    const rrpModel = new RRPModel();

    const rrpSeries = [];

    const reflexivityState = {
    I_series: [],
    price_series:[],
    dI_series: [],
    beta_series: [],
    phi_series: [],
    window: 20
        };

    const gammaEngine = new GammaEngine();
    const gammaEncoder = new GammaEncoder();
    const gammaBuffer = {
    size: 30,
    index: 0,
    filled: false,

    states: new Array(30),   // raw states
    vectors: new Array(30),   // encoded vectors (for ML later)
    timestamps: new Array(30)
};

const volEngine = new VolEngine();



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
function resetSocketCharts() {

    console.log("🧹 Resetting socket charts...");

    // 1. Reset circular buffer
    marketBuffer.index = 0;
    marketBuffer.filled = false;

    marketBuffer.ltp.fill(undefined);
    marketBuffer.bid.fill(undefined);
    marketBuffer.ask.fill(undefined);
    marketBuffer.microprice.fill(undefined);
    marketBuffer.imbalance.fill(undefined);
    marketBuffer.timestamp.fill(undefined);

    // 2. Reset RRP
    rrpSeries.length = 0;

    // 3. Clear charts
    microChart?.clear();
    imbalanceChart?.clear();
    lbaChart?.clear();
    alphaChart?.clear();
    rrpChart?.clear();

    // 4. Reset candle aggregation
    currentCandle = null;
    currentBucket = null;
}
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
    initMicroChart();
    initImbalanceChart();
    initFlowChart();
    initLBAChart();
     initAlphaChart();   // 🔥 ADD THIS
     initRRPChart();   // ✅ ADD THIS
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
//let ws = null;
function updateMarketBuffer(data) {
    const i = marketBuffer.index;

    // 🔥 EXTRACT LEVEL 1
    const level1 = data.depth?.[0];

    if (!level1) return;

    const bid = level1.bid_price;
    const ask = level1.ask_price;
    const bidQty = level1.bid_qty || 1;
    const askQty = level1.ask_qty || 1;

    // 🛡️ guard
    if (!bid || !ask || isNaN(bid) || isNaN(ask)) return;

    // 🔹 Microprice
    const micro =
        (ask * bidQty + bid * askQty) / (bidQty + askQty);

    // 🔹 Imbalance
    const imbalance =
        (bidQty - askQty) / (bidQty + askQty);
        // 🔹 Flow
    const flow = imbalance * data.ltq;


    marketBuffer.ltp[i] = data.ltp;
    marketBuffer.ltq[i] = data.ltq;
    marketBuffer.bid[i] = bid;
    marketBuffer.ask[i] = ask;
    marketBuffer.microprice[i] = micro;
    marketBuffer.imbalance[i] = imbalance;
    marketBuffer.flow[i] = flow;
    marketBuffer.timestamp[i] = data.ltt;

    marketBuffer.index++;

    if (marketBuffer.index >= marketBuffer.size) {
        marketBuffer.index = 0;
        marketBuffer.filled = true;
    }
}
function getMicropriceTrend(lookback = 10) {
    const size = marketBuffer.size;
    const i = marketBuffer.index;

    if (!marketBuffer.filled && i < lookback) return 0;

    const curr = marketBuffer.microprice[(i - 1 + size) % size];
    const prev = marketBuffer.microprice[(i - 1 - lookback + size) % size];

    return curr - prev;
}
function getImbalanceSignal(window = 20) {
    const size = marketBuffer.size;
    const i = marketBuffer.index;

    let sum = 0;
    let count = 0;

    for (let j = 0; j < window; j++) {
        const idx = (i - 1 - j + size) % size;

        const val = marketBuffer.imbalance[idx];
        if (val === undefined) break;

        sum += val;
        count++;
    }

    return count > 0 ? sum / count : 0;
}
function getAlphaSignal() {
    const trend = getMicropriceTrend(10);
    const imbalance = getImbalanceSignal(20);

    // normalize
    const trendNorm = trend / (marketBuffer.ltp[marketBuffer.index - 1] || 1);

    const signal = 0.6 * trendNorm + 0.4 * imbalance;

    return {
        trend,
        imbalance,
        signal
    };
}
function getMicropriceVelocity() {
    return getMicropriceTrend(5) - getMicropriceTrend(15);
}
function getBuffer() {
    if (!marketBuffer.filled) {
        return {
            ltp: marketBuffer.ltp.slice(0, marketBuffer.index),
            bid: marketBuffer.bid.slice(0, marketBuffer.index),
            ask: marketBuffer.ask.slice(0, marketBuffer.index),
            microprice: marketBuffer.microprice.slice(0, marketBuffer.index),
        };
    }

    // 🔁 reorder circular buffer
    const i = marketBuffer.index;

    return {
        ltp: [...marketBuffer.ltp.slice(i), ...marketBuffer.ltp.slice(0, i)],
        bid: [...marketBuffer.bid.slice(i), ...marketBuffer.bid.slice(0, i)],
        ask: [...marketBuffer.ask.slice(i), ...marketBuffer.ask.slice(0, i)],
        microprice: [
            ...marketBuffer.microprice.slice(i),
            ...marketBuffer.microprice.slice(0, i)
        ],
    };
}
function getWeightedImbalance(window = 20) {

    let sum = 0;
    let weightSum = 0;

    for (let j = 0; j < window; j++) {
        const idx = (marketBuffer.index - 1 - j + marketBuffer.size) % marketBuffer.size;

        const val = marketBuffer.imbalance[idx];
        if (val === undefined) break;

        const w = Math.exp(-j / 5); // decay

        sum += val * w;
        weightSum += w;
    }

    return weightSum > 0 ? sum / weightSum : 0;
}
function getNormalizedVelocity(short = 5, long = 15) {

    const shortTrend = getMicropriceTrend(short);
    const longTrend = getMicropriceTrend(long);

    const price = marketBuffer.ltp[marketBuffer.index - 1] || 1;

    return (shortTrend - longTrend) / price;
}
function getFlowSignals() {

    const size = marketBuffer.size;
    const i = marketBuffer.index;

    if (i < 2 && !marketBuffer.filled) {
        return null; // 🔥 IMPORTANT
    }

    const imbalance = getWeightedImbalance(20);
    const velocity = getNormalizedVelocity(5, 15);

    const priceNow = currentSpot;
    const pricePrev = marketBuffer.ltp[
        (i - 2 + size) % size
    ];

    if (!priceNow || !pricePrev) return null;

    return {
        imbalance,
        velocity,
        priceNow,
        pricePrev
    };
}
function updateGammaBuffer(timestamp, state, vector = null) {

    const i = gammaBuffer.index;

    gammaBuffer.states[i] = state;
    gammaBuffer.vectors[i] = vector;
    gammaBuffer.timestamps[i] = timestamp;

    gammaBuffer.index = (i + 1) % gammaBuffer.size;

    if (gammaBuffer.index === 0) {
        gammaBuffer.filled = true;
    }
}
function getRecentGammaStates(n = 30) {

    const size = gammaBuffer.size;
    const i = gammaBuffer.index;

    const result = [];

    for (let j = 0; j < n; j++) {

        const idx = (i - 1 - j + size) % size;

        const val = gammaBuffer.states[idx];

        if (val === undefined) break;

        result.push(val);
    }

    return result.reverse(); // oldest → newest
}
function getRecentGammaVectors(n = 30) {

    const size = gammaBuffer.size;
    const i = gammaBuffer.index;

    const result = [];

    for (let j = 0; j < n; j++) {

        const idx = (i - 1 - j + size) % size;

        const val = gammaBuffer.vectors[idx];

        if (val === undefined) break;

        result.push(val);
    }

    return result.reverse();
}
//--------------------------------
//---Creation of Volatility Buffer
//-----------------------------------
function buildVolSnapshot(ocPayload) {

    const oc = ocPayload?.oc
    const spot = ocPayload?.last_price

    if (!oc || !spot) {
        console.warn("Invalid OC payload for snapshot", ocPayload)
        return null
    }

    const strikes = []

    for (const strikeKey in oc) {

        const strike = Number(strikeKey)
        const row = oc[strikeKey]

        const ce = row?.ce || {}
        const pe = row?.pe || {}

        let call_iv = Number(ce.implied_volatility || 0)
        let put_iv = Number(pe.implied_volatility || 0)

        // 🔥 CRITICAL CLEANING (YOU NEED THIS)
        // Your data has garbage like IV = 0 or absurd values
        if (call_iv <= 0 || call_iv > 5) call_iv = null
        if (put_iv <= 0 || put_iv > 5) put_iv = null

        // skip if both invalid
        if (!call_iv && !put_iv) continue

        strikes.push({
            strike,
            call_iv: call_iv || put_iv, // fallback
            put_iv: put_iv || call_iv
        })
    }

    // 🔥 MUST SORT
    strikes.sort((a, b) => a.strike - b.strike)

    if (strikes.length === 0) {
        console.warn("No valid IV data")
        return null
    }

    return {
        spot,
        strikes
    }
}
function extractVolFeatures(timestamp, snapshot, marketBuffer) {
    const spot = snapshot.spot

    // 1. Find ATM strike
    let atm = null
    let minDiff = Infinity

    for (const strike of snapshot.strikes) {
        const diff = Math.abs(strike.strike - spot)
        if (diff < minDiff) {
            minDiff = diff
            atm = strike
        }
    }

    // 2. ATM IV
    const atm_iv = (atm.call_iv + atm.put_iv) / 2

    // 3. Skew (simple version)
    const call_skew = atm.call_iv - snapshot.strikes.find(s => s.strike > spot)?.call_iv || 0
    const put_skew = snapshot.strikes.find(s => s.strike < spot)?.put_iv - atm.put_iv || 0

    // 4. HV from market buffer
    const hv = computeHVFromBuffer(marketBuffer)

    return {
        atm_iv,
        call_skew,
        put_skew,
        hv,
        ltp: spot,
        timestamp: timestamp
    }
}
function computeHVFromBuffer(buffer, window = 50) {
    if (!buffer.filled && buffer.index < window) return null

    let returns = []

    for (let i = 1; i < window; i++) {
        const idx1 = (buffer.index - i + buffer.size) % buffer.size
        const idx2 = (buffer.index - i - 1 + buffer.size) % buffer.size

        const p1 = buffer.ltp[idx1]
        const p2 = buffer.ltp[idx2]

        if (p1 && p2) {
            returns.push(Math.log(p1 / p2))
        }
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length

    return Math.sqrt(variance) * Math.sqrt(252) // annualized
}
function updateVolFeatureBuffer(buffer, features) {
    const i = buffer.index

    buffer.timestamp[i] = features.timestamp
    buffer.atm_iv[i] = features.atm_iv
    buffer.call_skew[i] = features.call_skew
    buffer.put_skew[i] = features.put_skew
    buffer.hv[i] = features.hv
    buffer.ltp[i] = features.ltp

    buffer.index = (i + 1) % buffer.size
    if (buffer.index === 0) buffer.filled = true
}

function processVolatilitySnapshot({
    timestamp,
    ocPayload,
    marketBuffer,
    volFeatureBuffer,
    volEngine
}) {

    // =========================
    // 1. BUILD SNAPSHOT
    // =========================
    const oc = ocPayload?.oc
    const spot = ocPayload?.last_price

    if (!oc || !spot) {
        console.warn("Invalid OC payload")
        return null
    }

    const strikes = []

    for (const strikeKey in oc) {

        const strike = Number(strikeKey)
        const row = oc[strikeKey]

        const ce = row?.ce || {}
        const pe = row?.pe || {}

        let call_iv = Number(ce.implied_volatility || 0)
        let put_iv = Number(pe.implied_volatility || 0)

        // 🔥 CLEAN DATA
        if (call_iv <= 0 || call_iv > 5) call_iv = null
        if (put_iv <= 0 || put_iv > 5) put_iv = null

        if (!call_iv && !put_iv) continue

        strikes.push({
            strike,
            call_iv: call_iv || put_iv,
            put_iv: put_iv || call_iv
        })
    }

    if (strikes.length === 0) {
        console.warn("No valid strikes")
        return null
    }

    // 🔥 SORT
    strikes.sort((a, b) => a.strike - b.strike)

    const snapshot = {
        spot,
        strikes
    }

    // =========================
    // 2. FEATURE EXTRACTION
    // =========================
    const features = extractVolFeatures(
        timestamp,
        snapshot,
        marketBuffer
    )

    if (!features) return null

    // =========================
    // 3. UPDATE BUFFER
    // =========================
    updateVolFeatureBuffer(volFeatureBuffer, features)

    // =========================
    // 4. COMPUTE STATE
    // =========================
    if (!volFeatureBuffer.filled && volFeatureBuffer.index < 20) {
        return null
    }

    const volState = volEngine.computeState({
        volFeatureBuffer
    })

    return volState
}
function getPriceHistoryFromBuffer(n = 100) {

    const result = [];

    const size = marketBuffer.size;
    const i = marketBuffer.index;
    const filled = marketBuffer.filled;

    // how many valid points exist
    const available = filled ? size : i;

    const count = Math.min(n, available);

    for (let j = 0; j < count; j++) {

        const idx = (i - 1 - j + size) % size;

        const price = marketBuffer.ltp[idx];

        if (price === undefined) break;

        result.push(price);
    }

    return result.reverse(); // oldest → newest
}
//Web socket----------------------
function startWebSocket() {
    if(ws) return;

    stopWebSocket(); // prevent duplicates

    ws = new WebSocket("ws://localhost:8001/ws");

    ws.onopen = () => {
                console.log("✅ WS connected");

                if (currentSecurityId) {
                    subscribe(currentSecurityId, currentSecurityName);
                } else {
                    console.warn("⚠️ No securityId yet");
                }
            };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
//        console.log(data)

//        console.log("Tick:", data.securityId, "Active:", currentSecurityId);
//        console.log("MARKET STATE:", marketState);

        // ✅ Keep ONLY ONE check (you had duplicate)
        if (String(data.securityId) !== String(currentSecurityId)) return;
        updateMarketBuffer(data);

        handleTick(data);
        const features = featureEngine.update(data);
        if (!features) return;

        // =========================
        // INJECT MARKET STATE
        // =========================
        features.netGEX = marketState.netGEX;
        features.adv    = marketState.adv;
        features.gexStd = marketState.gexStd;

        // =========================
        // SAFETY CHECK (IMPORTANT)
        // =========================
        if (!features.netGEX || !features.gexStd) {
            return;
        }

        const rrp = rrpModel.compute(features);
        if (!rrp) return;

        rrpSeries.push({
            time: data.timestamp || Date.now(),
            value: rrp.final
        });

        if (rrpSeries.length > 300) rrpSeries.shift();

        renderRRP(rrpSeries);

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
function subscribe(securityId, symbol) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
        type: "switch",
        securityId: String(securityId),
        securityName: symbol
    }));

    console.log("📡 Subscribed to:", securityId);
}
function changeSecurity(securityId, symbol) {
    currentSecurityId = String(securityId);
    currentSecurityName = symbol;

    subscribe(currentSecurityId, currentSecurityName);
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
//    currentSpot = null;
    stopSafeUpdateLoop(); // 🔥 prevent leak
    stopQuotePolling();
    stopAlphaLoop();          // ✅ ADD
    resetSocketCharts();      // ✅ ADD
//    resetReflexivityState()


    const input = document.getElementById("stockSelectchart")

    activeStock = symbol
    input.value = symbol

    localStorage.setItem("selectedStock", symbol)

    const stock = stockMap[symbol]

    // 🚀 Now you have everything cleanly
    const security_id = stock.security_id
    // 🔥 ADD THIS
    currentSecurityId = String(security_id);
    currentSecurityName = symbol
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
function resetReflexivityState() {
    reflexivityState.I_series.length = 0;
    reflexivityState.price_series.length = 0;
    reflexivityState.dI_series.length = 0;
    reflexivityState.beta_series.length = 0;
    reflexivityState.phi_series.length = 0;
}
function drawGEXLadder(gammaLadder) {

    const overlay = document.getElementById("gex-overlay");
    if (!overlay || !candleSeries) return;

    overlay.innerHTML = "";

    const spot = currentSpot;
    //console.log("drawGEXLadder spot:", currentSpot);
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
let lastGEXGradient = null;
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
        const ts = Date.now()

        const result = processOptionChain(ocToUse);
        const flip = computeGammaFlip(result.gammaLadder);

        lastGammaLadder = result.gammaLadder;
        lastGEXGradient = result.gexGradient;

        const ivData = extractIVData(ocToUse);
        const { beta, phi } = updateReflexivityMetrics(result);

        const crashRisk = computeCrashRisk(beta, phi, result.netGEX);

        const regime_from_beta = getMarketRegime(beta, phi);



        console.log("β:", beta, "φ:", phi, "Risk:", crashRisk, regime_from_beta);

        const flow = getFlowSignals();

        const gammaState = gammaEngine.computeState({
            result,
            marketState,
            spot: currentSpot,
            flip,
            flow   // 🔥 NEW
        });

        console.log("Gamma State:", gammaState);



        const gammaVector = gammaEncoder.encode(gammaState);

        console.log("Gamma Vector:", gammaVector);
        updateGammaBuffer(ts, gammaState, gammaVector);
        const lastStates = getRecentGammaStates(10);
        const lastVectors = getRecentGammaVectors(10);

        console.log("Recent Gamma States:", lastStates);
        console.log("Recent Gamma Vectors:", lastVectors);



        // 🔥 NEW PIPELINE
       const volState = processVolatilitySnapshot({
        ocPayload: {
            ts,
            last_price: currentSpot,
            oc: ocToUse.data.data.oc
                },
                marketBuffer,
                volFeatureBuffer,
                volEngine
            })

            if (volState) {
                console.log("Vol State:", volState)
            }




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
            renderReflexivityChart();
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

// =========================
// UPDATE MARKET STATE
// =========================
function updateMarketState(result) {

    if (!result) return;

    // Net GEX
    marketState.netGEX = result.netGEX || 0;

    // Maintain rolling history
    marketState.gexHistory.push(marketState.netGEX);
    if (marketState.gexHistory.length > 200) {
        marketState.gexHistory.shift();
    }

    // Rolling STD
    marketState.gexStd = computeRollingStd(marketState.gexHistory);

    // ADV (daily liquidity proxy)
    marketState.adv = result.adv || 1e7;
}

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
        changeSecurity(security_id, symbol);
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
        startWebSocket();
        startAlphaLoop();

        const optionChain = await ocRes.json();





        // ----------------------------
        // ✅ OPTION CHAIN HANDLING
        // ----------------------------
        let ocToUse = null;

        if (isValidOC(optionChain)) {
            lastValidOC = optionChain;
            ocToUse = optionChain;


            //console.log("OC KEYS:",
             //   Object.keys(optionChain?.data?.data?.oc || {})
            //);

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
                updateMarketState(result);
                const ts = Date.now();
                const flow = getFlowSignals();

                const gammaState = gammaEngine.computeState({
                    result,
                    marketState,
                    spot: currentSpot,
                    flip,
                    flow   // 🔥 NEW
                });

                console.log("Gamma State:", gammaState);
                const gammaVector = gammaEncoder.encode(gammaState);

                console.log("Gamma Vector:", gammaVector);
                updateGammaBuffer(ts, gammaState, gammaVector);


                // 🔥 NEW PIPELINE
               const volState = processVolatilitySnapshot({
                ocPayload: {
                    ts,
                    last_price: currentSpot,
                    oc: ocToUse.data.data.oc
                        },
                        marketBuffer,
                        volFeatureBuffer,
                        volEngine
                    })

                    if (volState) {
                        console.log("Vol State:", volState)
                    }

//               const { beta, phi } = updateReflexivityMetrics(result);
//
//                const crashRisk = computeCrashRisk(beta, phi, result.netGEX);
//
//                const regime_from_beta = getMarketRegime(beta, phi);
//
//
//
//                console.log("β:", beta, "φ:", phi, "Risk:", crashRisk, regime_from_beta);





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
                    renderReflexivityChart();

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
//        startWebSocket();
        resetRealtimeState();


    } catch (e) {
        console.error("❌ loadStock error:", e);
    }
}
function computeRollingStd(arr) {
    if (!arr || arr.length < 10) return 1;

    const mean =
        arr.reduce((a, b) => a + b, 0) / arr.length;

    const variance =
        arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;

    return Math.sqrt(variance) || 1;
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

    //console.log("📍 Spot (from chart):", spot);
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
        //console.log("📍 Spot (from quote):", currentSpot)
        return
    }

    if (currentSpot) {
        //console.log("📍 Spot (fallback: previous):", currentSpot)
        return
    }

    const lastCandle = candles?.[candles.length - 1]
    const fallbackSpot = lastCandle?.close

    if (fallbackSpot) {
        currentSpot = fallbackSpot
        //console.log("📍 Spot (from chart):", currentSpot)
    }
}
function startQuotePolling({security_id, symbol, candles, interval = 5000 }) {

    // clear existing loop
    if (quoteInterval) {
        clearInterval(quoteInterval)
    }
    //console.log('Quote symbol:', symbol)

    quoteInterval = setInterval(async () => {
        try {
        const params = new URLSearchParams({
                underlying_security: symbol
            });
            const res = await authFetch(
                `${API}/quote/${security_id}?${params}`
            )

            const data = await res.json()
            //console.log("QuoteData:", data)

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

    // ----------------------------
    // 1. Extract + Validate
    // ----------------------------
    const oc = extractOC(optionChain);

    if (!oc || Object.keys(oc).length === 0) {
        return { valid: false };
    }

    const rows = normalizeOC(oc);

    if (!rows || rows.length === 0) {
        return { valid: false };
    }

    // ----------------------------
    // 2. Core Calculations
    // ----------------------------
    const gammaLadder = computeGammaLadder(rows);
    const netGEX = computeNetGEX(gammaLadder);
    const vegaLadder = computeVegaLadder(rows);
    const vegaSkew = computeVegaSkew(rows);
    const gexGradient = computeGEXGradient(gammaLadder);

    // ----------------------------
    // 3. ADV (Notional Liquidity Proxy)
    // ----------------------------
    let rawADV = 0;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];

        const oi = (r.ce_oi || 0) + (r.pe_oi || 0);
        rawADV += oi * r.strike;
    }

    // normalize by number of strikes
    let adv = rawADV / rows.length;

    // safety floor (critical)
    adv = Math.max(adv, 1e6);

    // ----------------------------
    // 4. Data Quality Score (optional but powerful)
    // ----------------------------
    const confidence = Math.min(1, rows.length / 100);

    // ----------------------------
    // 5. Return Structured Result
    // ----------------------------
    return {
        valid: true,

        // core
        rows,
        gammaLadder,
        netGEX,
        gexGradient,
        vegaLadder,
        vegaSkew,

        // 🔥 critical for RRP
        adv,

        // 🔥 optional upgrade
        confidence
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
//----------------------------------
//----Price microstructure charts-
//-----------------------------------
function initMicroChart() {
    const el = document.getElementById("microChart");
    if (!el) return;

    if (microChart) microChart.dispose();

    microChart = echarts.init(el);

    microChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },

        legend: { data: ["Microprice", "LTP"] },

        xAxis: { type: "category", data: [] },
        yAxis: { type: "value", scale: true },

        series: [
            { name: "Microprice", type: "line", data: [], smooth: true },
            { name: "LTP", type: "line", data: [], smooth: true }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}
function initImbalanceChart() {
    const el = document.getElementById("imbalanceChart");
    if (!el) return;

    if (imbalanceChart) imbalanceChart.dispose();

    imbalanceChart = echarts.init(el);

    imbalanceChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },

        xAxis: { type: "category", data: [] },

        yAxis: {
            type: "value",
            min: -1,
            max: 1
        },

        series: [{
            name: "Imbalance",
            type: "line",
            data: [],
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}
function initFlowChart() {
    const el = document.getElementById("flowChart");
    if (!el) return;

    if (flowChart) flowChart.dispose();

    flowChart = echarts.init(el);

    flowChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },

        xAxis: { type: "category", data: [] },

        yAxis: {
            type: "value",
            min: -1,
            max: 1
        },

        series: [{
            name: "Flow",
            type: "line",
            data: [],
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}
function initLBAChart() {
    const el = document.getElementById("lbaChart");
    if (!el) return;

    if (lbaChart) lbaChart.dispose();

    lbaChart = echarts.init(el);

    lbaChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },

        legend: { data: ["LTP", "Bid", "Ask"] },

        xAxis: { type: "category", data: [] },
        yAxis: { type: "value", scale: true },

        series: [
            { name: "LTP", type: "line", data: [], smooth: true },
            { name: "Bid", type: "line", data: [], smooth: true },
            { name: "Ask", type: "line", data: [], smooth: true }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}
function initRRPChart() {
    const el = document.getElementById("rrpChart");
    if (!el) return;

    if (rrpChart) rrpChart.dispose();

    rrpChart = echarts.init(el);

    rrpChart.setOption({
        backgroundColor: "#111",

        grid: {
            left: 40,
            right: 20,
            top: 20,
            bottom: 80   // ✅ REQUIRED
        },

        tooltip: { trigger: "axis" },

        xAxis: {
            type: "category",
            data: []
        },

        yAxis: {
            type: "value",
            min: 0,
            max: 1
        },

        series: [{
            name: "RRP",
            type: "line",
            data: [],
            smooth: true
        }],

        dataZoom: [
            {
                type: 'inside'
            },
            {
                type: 'slider',
                height: 25,
                bottom: 10   // inside grid now
            }
        ]
    });
}
function renderRRP(series) {
    if (!rrpChart) return;
    if (rrpChart.isDisposed?.()) return;
    if (!rrpChart._model) return;

    if (!Array.isArray(series) || series.length === 0) return;

    const x = [];
    const y = [];

    for (let i = 0; i < series.length; i++) {
        const t = series[i]?.time;
        const v = series[i]?.value;

        // 🔥 HARD FILTER
        if (!isFinite(v) || v == null) continue;

        x.push(i);        // OR use time (see below)
        y.push(v);
    }

    // 🚨 MUST MATCH
    if (x.length === 0 || x.length !== y.length) return;

    rrpChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",
            min: 0,
            max: 1
        },
        // ✅ TOOLTIP (UPGRADED)
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
                const p = params[0];

                const value = p.data;
                const idx = p.dataIndex;

                return `
                    <b>Index:</b> ${idx}<br/>
                    <b>RRP:</b> ${value.toFixed(4)}
                `;
            }
        },
        series: [{
            name: "RRP",
            type: "line",
            data: y,
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}
function updateMicroChart() {
    if (!microChart || microChart.isDisposed?.()) return;
    if (!microChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 10) return;

    const x = [];
    const micro = [];
    const ltp = [];

    for (let i = 0; i < len; i++) {
        const m = marketBuffer.microprice[i];
        const l = marketBuffer.ltp[i];

        // 🔥 STRICT VALIDATION
        if (
            m == null || l == null ||
            !isFinite(m) || !isFinite(l)
        ) continue;

        x.push(i);
        micro.push(m);
        ltp.push(l);
    }

    // 🚨 HARD CHECK (CRITICAL)
    if (
        x.length === 0 ||
        x.length !== micro.length ||
        x.length !== ltp.length
    ) return;

    microChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",
            scale: true   // 🔥 THIS is the key
        },
        series: [
            {
                name: "Microprice",
                type: "line",
                data: micro,
                smooth: true
            },
            {
                name: "LTP",
                type: "line",
                data: ltp,
                smooth: true
            }
        ],

        // ✅ FIXED TOOLTIP (IMPORTANT)
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            borderColor: "#555",
            textStyle: { color: "#fff" },
            formatter: function (params) {

                let microVal = null;
                let ltpVal = null;

                params.forEach(p => {
                    if (p.seriesName === "Microprice") microVal = p.data;
                    if (p.seriesName === "LTP") ltpVal = p.data;
                });

                return `
                    <b>Index:</b> ${params[0].dataIndex}<br/>
                    <b>Micro:</b> ${microVal?.toFixed(2)}<br/>
                    <b>LTP:</b> ${ltpVal?.toFixed(2)}
                `;
            }
        },

        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ]
    });
}
function updateImbalanceChart() {
    if (!imbalanceChart) return;
    if (imbalanceChart.isDisposed?.()) return;
    if (!imbalanceChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 10) return;

    const x = [];
    const data = [];

    for (let i = 0; i < len; i++) {
        const v = marketBuffer.imbalance[i];

        // 🔥 HARD FILTER (CRITICAL)
        if (v == null || isNaN(v) || !isFinite(v)) continue;

        x.push(i);
        data.push(v);
    }

    // 🚨 MUST match lengths
    if (data.length === 0 || x.length !== data.length) return;

    imbalanceChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",
            min: -1,
            max: 1
        },
        // ✅ TOOLTIP (UPGRADED)
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
                const p = params[0];

                const value = p.data;
                const idx = p.dataIndex;

                return `
                    <b>Index:</b> ${idx}<br/>
                    <b>Imbalance:</b> ${value.toFixed(4)}
                `;
            }
        },
        series: [{
            name: "Imbalance",
            type: "line",
            data: data,
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}
function updateFlowChart() {
    if (!flowChart) return;
    if (flowChart.isDisposed?.()) return;
    if (!flowChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 10) return;

    const x = [];
    const data = [];

    for (let i = 0; i < len; i++) {
        const v = marketBuffer.flow[i];

        // 🔥 HARD FILTER (CRITICAL)
        if (v == null || isNaN(v) || !isFinite(v)) continue;

        x.push(i);
        data.push(v);
    }

    // 🚨 MUST match lengths
    if (data.length === 0 || x.length !== data.length) return;

    flowChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",
            min: -1,
            max: 1
        },
        // ✅ TOOLTIP (UPGRADED)
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
                const p = params[0];

                const value = p.data;
                const idx = p.dataIndex;

                return `
                    <b>Index:</b> ${idx}<br/>
                    <b>Flow:</b> ${value.toFixed(4)}
                `;
            }
        },
        series: [{
            name: "Flow",
            type: "line",
            data: data,
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}
function updateLBAChart() {
    if (!lbaChart) return;
    if (lbaChart.isDisposed?.()) return;
    if (!lbaChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 10) return;

    const x = [];
    const ltp = [];
    const bid = [];
    const ask = [];

    for (let i = 0; i < len; i++) {
        const l = marketBuffer.ltp[i];
        const b = marketBuffer.bid[i];
        const a = marketBuffer.ask[i];

        // 🔥 HARD FILTER (ALL SERIES MUST BE VALID TOGETHER)
        if (
            l == null || b == null || a == null ||
            !isFinite(l) || !isFinite(b) || !isFinite(a)
        ) continue;

        x.push(i);
        ltp.push(l);
        bid.push(b);
        ask.push(a);
    }

    // 🚨 CRITICAL: ALL SERIES MUST MATCH LENGTH
    if (
        x.length === 0 ||
        x.length !== ltp.length ||
        x.length !== bid.length ||
        x.length !== ask.length
    ) return;

    lbaChart.setOption({
        xAxis: {
            type: "category",
            data: x
        },
        yAxis: {
            type: "value",
            scale: true
        },
         // ✅ LEGEND
        legend: {
            data: ["LTP", "Best Bid", "Best Ask"],
            top: 10,
            textStyle: {
                color: "#DDD"
            }
        },
         // ✅ TOOLTIP (VERY IMPORTANT)
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
                let output = "";

                params.forEach(p => {
                    const name = p.seriesName;
                    const value = p.data;

                    output += `<b>${name}:</b> ${value?.toFixed?.(2) ?? value}<br/>`;
                });

                return output;
            }
        },
        series: [
            { name: "LTP", type: "line", data: ltp },
            { name: "Bid", type: "line", data: bid },
            { name: "Ask", type: "line", data: ask }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}
//RRP Model
function computeRRPFromRealtime(data) {

    const spot = data.spot || data.ltp;

    // =========================
    // YOUR EXISTING STRUCTURES
    // =========================
    const vwap = data.vwap || data.gammaFlip || spot;
    const netGEX = data.netGEX || 0;

    // -------------------------
    // VOL (you may already compute this)
    // -------------------------
    const sigmaEWMA = data.sigmaEWMA || 1;
    const sigmaShort = data.sigmaShort || 1;
    const sigmaLong = data.sigmaLong || 1;

    // -------------------------
    // MOMENTUM
    // -------------------------
    const prevPrice = window.prevPrice || spot;
    window.prevPrice = spot;

    // -------------------------
    // GEX NORMALIZATION
    // -------------------------
    const adv = data.adv || 1e7;
    const gexStd = data.gexStd || 1;

    // -------------------------
    // MICROSTRUCTURE (hook into imbalance)
    // -------------------------
    const absorptionSignal =
        data.imbalance < 0.1 ? 1 : 0;

    // =========================
    // COMPUTE RRP
    // =========================
    return rrpModel.compute({
        price: spot,
        center: vwap,
        sigmaEWMA,
        netGEX,
        adv,
        gexStd,
        pricePrev: prevPrice,
        sigmaShort,
        sigmaLong,
        microstructureSignal: absorptionSignal
    });
}
//Alpha Chart
function initAlphaChart() {
    const el = document.getElementById("alpha-panel");
    if (!el) return;

    if (alphaChart) alphaChart.dispose();

    alphaChart = echarts.init(el);

    alphaChart.setOption({
        backgroundColor: "#111",
        grid: { left: 40, right: 20, top: 20, bottom: 30 },

        tooltip: { trigger: "axis" },

        xAxis: {
            type: "category",
            data: []
        },

        yAxis: {
            type: "value"
        },

        series: [{
            name: "Alpha",
            type: "line",
            data: [],
            smooth: true
        }],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 30 }
        ],
    });
}
function computeAlphaSeries() {
    const size = marketBuffer.size;
    const len = marketBuffer.filled ? size : marketBuffer.index;

    const alpha = [];

    for (let i = 0; i < len; i++) {

        const micro = marketBuffer.microprice[i];
        const prev = i > 10 ? marketBuffer.microprice[i - 10] : micro;

        const trend = micro - prev;
        const imbalance = marketBuffer.imbalance[i] || 0;

        // 🔥 SCALE IT
        const signal = (0.6 * trend + 0.4 * imbalance) * 1000;

        alpha.push(signal);
    }

    return alpha;
}
function updateAlphaChart() {
    if (!alphaChart) return;

    // 🔥 CRITICAL FIX
    if (alphaChart.isDisposed?.()) return;

    // 🔥 ADD THIS (VERY IMPORTANT)
    if (!alphaChart._model) return;

    const len = marketBuffer.filled ? marketBuffer.size : marketBuffer.index;
    if (len < 20) return;

    const x = Array.from({ length: len }, (_, i) => i);
    const alphaSeries = computeAlphaSeries();

    alphaChart.setOption({
        xAxis: { type: "category", data: x },
        yAxis: { type: "value" },
        series: [{
            name: "Alpha",
            type: "line",
            data: alphaSeries,
            smooth: true
        }],
         // ✅ TOOLTIP (UPGRADED)
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
                const p = params[0];

                const value = p.data;
                const idx = p.dataIndex;

                return `
                    <b>Index:</b> ${idx}<br/>
                    <b>Alpha:</b> ${value.toFixed(4)}
                `;
            }
        },
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}
let alphaLoop = null;

function startAlphaLoop() {
    if (alphaLoop) return;

    alphaLoop = setInterval(() => {
        updateAlphaChart();
        updateMicroChart();       // 🔥 ADD
        updateImbalanceChart();   // 🔥 ADD
        updateFlowChart();
        updateLBAChart();
    }, 100); // 10 FPS
}
function stopAlphaLoop() {
    if (alphaLoop) {
        clearInterval(alphaLoop);
        alphaLoop = null;
    }
}
//---------------------------------------
//-------------Risk
////////////////////////////////////
function computeBeta() {
    const { I_series, price_series, window } = reflexivityState;

    if (I_series.length < window + 2) return null;

    const EPS = 1e-8;

    let logI = [];
    let logdP = [];

    for (let i = I_series.length - window; i < I_series.length - 1; i++) {

        // skip duplicates
        if (I_series[i] === I_series[i+1]) continue;

        const I = Math.abs(I_series[i]);

        // normalized return (IMPORTANT)
        const dP = Math.abs(
            (price_series[i+1] - price_series[i]) / price_series[i]
        );

        // filter noise
        if (I > 0 && dP > 1e-5) {
            logI.push(Math.log(I));
            logdP.push(Math.log(dP + EPS));
        }
    }
    console.log('logI:', logI)
    console.log('logdP:', logdP)

    // minimum data requirement
    if (logI.length < 8) return null;

    const meanX = logI.reduce((a,b)=>a+b,0)/logI.length;
    const meanY = logdP.reduce((a,b)=>a+b,0)/logdP.length;

    let num = 0, den = 0, varY = 0;

    for (let i = 0; i < logI.length; i++) {
        const dx = logI[i] - meanX;
        const dy = logdP[i] - meanY;

        num += dx * dy;
        den += dx * dx;
        varY += dy * dy;
    }

    // 🔴 critical guard
    if (den < 1e-5) return null;

    const beta = num / den;

    // compute correlation (confidence)
    const rho = num / Math.sqrt(den * varY);

    // reject weak relationship
    if (Math.abs(rho) < 0.2) return null;

    // clamp beta to realistic range
    return Math.max(-2, Math.min(beta, 2));
}
function computePhi(dataPoint) {
    // expects:
    // dataPoint.gamma
    // dataPoint.volume
    // dataPoint.oi_change

    const gammaFlow = Math.abs(dataPoint.gamma * dataPoint.volume);
    const oiFlow = Math.abs(dataPoint.gamma * dataPoint.oi_change);

    if (gammaFlow === 0) return 0;

    return Math.min(1, oiFlow / gammaFlow);
}
function updateReflexivityMetrics(data) {
    if (currentSpot == null) return;

    const I = Math.abs(data.netGEX || 0);  // your gamma exposure
    const P = currentSpot;
    console.log('I:', I)
    const lastI = reflexivityState.I_series.at(-1);
    const lastP = reflexivityState.price_series.at(-1);

    if (lastI === I && lastP === P) {
        return { beta: null, phi: null }; // 🔥 prevent duplicate push
    }

    reflexivityState.I_series.push(I);
    reflexivityState.price_series.push(P);

    if (reflexivityState.I_series.length > 200) {
        reflexivityState.I_series.shift();
        reflexivityState.price_series.shift();
    }

    // Compute beta
    const beta = computeBeta();

    if (beta !== null) {
        reflexivityState.beta_series.push(beta);
    }

    // Compute phi
    const phi = computePhi(data);

    reflexivityState.phi_series.push(phi);

    if (reflexivityState.beta_series.length > 200) {
        reflexivityState.beta_series.shift();
        reflexivityState.phi_series.shift();
    }

    return { beta, phi };
}
function renderReflexivityChart() {
    const chart = echarts.init(document.getElementById('reflexivityChart'));

    chart.setOption({
        xAxis: {
            type: 'category',
            data: reflexivityState.beta_series.map((_, i) => i)
        },
        yAxis: [
            { type: 'value', name: 'β' },
            { type: 'value', name: 'φ', min: 0, max: 1 }
        ],
        series: [
            {
                name: 'β (Reflexivity)',
                type: 'line',
                data: reflexivityState.beta_series,
                smooth: true
            },
            {
                name: 'φ (Retention)',
                type: 'line',
                yAxisIndex: 1,
                data: reflexivityState.phi_series,
                smooth: true
            }
        ]
    });
}
function computeCrashRisk(beta, phi, I) {
    if (!beta || !phi) return 0;

    return phi * Math.pow(I, beta - 1);
}
function getMarketRegime(beta, phi) {

    if (beta > 1.2 && phi > 0.5) {
        return "🔥 HIGH RISK (Gamma Squeeze / Crash)";
    }

    if (beta > 1.0 && phi > 0.3) {
        return "⚠️ Reflexive Regime";
    }

    return "✅ Stable";
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
window.RealtimeRenderer = RealtimeRenderer;