import { FeatureEngine } from "../scripts/models/FeatureEngine.js";
import { RRPModel } from "../scripts/models/RRPModel.js";
import { GammaEngine } from "../scripts/engines/GammaEngine.js";
import { GammaEncoder } from "../scripts/encoders/GammaEncoder.js";
import { VolEngine } from "../scripts/engines/VolEngine.js";
import { marketBuffer, updateMarketBuffer, resetMarketBuffer } from "../scripts/buffers/marketBuffer.js";
import { netGEXBuffer, resetNetGEXBuffer , updateNetGEXBuffer} from "../scripts/buffers/netGEXBuffer.js";
import {gammaBuffer, updateGammaBuffer, resetGammaBuffer}  from "../scripts/buffers/gammaBuffer.js";
import {netGEXChart, initNetGEXChart, updateNetGEXChart }  from "../scripts/uicomponents/netGEXBufferplots.js";
import {volFeatureBuffer, resetVolFeatureBuffer, updateVolFeatureBuffer} from "../scripts/buffers/volFeatureBuffer.js";
import {initIVStructureChart, updateIVStructureChart, resetIVStructureChart, plotIVChart,
plotIVStructure, ivChart,
ivData, hvData,skewData, curvatureData ,
callSkewData , putSkewData } from "../scripts/uicomponents/ivStructureChart.js";
import { marketState } from "../scripts/buffers/marketStateBuffer.js";
import {initMicroChart, updateMicroChart, microChart} from "../scripts/uicomponents/microPriceChart.js";
import {initImbalanceChart, updateImbalanceChart, imbalanceChart} from "../scripts/uicomponents/imbalanceChart.js";
import {initFlowChart, updateFlowChart, flowChart} from "../scripts/uicomponents/flowDirectionChart.js";
import {initLBAChart, updateLBAChart, lbaChart} from "../scripts/uicomponents/lbaChart.js";
import {initAlphaChart, updateAlphaChart, alphaChart} from "../scripts/uicomponents/alphaChart.js";
import {initRRPChart, renderRRP, rrpChart} from "../scripts/uicomponents/rrpChart.js";
import {initOIChart, initOIChangeChart, renderOI, renderOIChange,
oiChart, oiChangeChart} from "../scripts/uicomponents/oiChart.js";
import {initVegaChart, initVegaSkewChart, renderVegaLadder, renderVegaSkew,
vegaChart, vegaSkewChart} from "../scripts/uicomponents/vegaChart.js";
import {toISTDate} from "../scripts/utils/timeUtils.js";
import {initGEXGradientChart, renderGEXGradientEChart, gexGradientChart} from "../scripts/uicomponents/gexGradientChart.js";
import {isValidOC, processOptionChain, extractOC } from "../scripts/utils/ocUtils.js";
import {computeGammaLadder, computeNetGEX, computeGammaFlip, computeGEXGradient,
computeVegaLadder, computeVegaSkew} from "../scripts/services/optionChainService.js";

import {getGammaRegime} from "../scripts/logics/gammaState.js";

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
    let socketSecurityId = null;
    let currentSecurityName = null;
    let ltpLine = null;
    let isLoading = false;
    let gammaFlipLine = null;  // ✅ ADD THIS
    let lastGammaLadder = null;
    let currentSpot = null;
    let prevClose = null;
    let quoteInterval = null;


    // =========================
    // RRP ENGINE INSTANCE
    // =========================
    // =========================
    // GLOBAL MARKET STATE
    // =========================

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
    initNetGEXChart("netgex-panel");
    initIVStructureChart("iv-structure-detailed");
    initMicroChart("microChart");
    initImbalanceChart("imbalanceChart");
    initFlowChart("flowChart");
    initLBAChart("lbaChart");
    initAlphaChart("alpha-panel");   // 🔥 ADD THIS
    initRRPChart("rrpChart");   // ✅ ADD THIS
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
    initGEXGradientChart("gex-gradient-panel");
    initVegaChart("vega-ladder-panel");
    initVegaSkewChart("vega-skew-panel");
    initOIChart("oi-panel");
    initOIChangeChart("oi-change-panel");


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



///GEX Buffer



//Web Socket
//let ws = null;

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
function computeHVFromSpotPrevClose(spot, prevClose, currentTimestamp, marketOpenTimestamp) {
    console.log('spot, prevClose, currentTimestamp, marketOpenTimestamp', spot, prevClose, currentTimestamp, marketOpenTimestamp)

    if (!spot || !prevClose || spot <= 0 || prevClose <= 0) return null
    console.log('here')

    // =========================
    // 1. LOG RETURN
    // =========================
    const r = Math.log(spot / prevClose)

    // =========================
    // 2. TIME FRACTION
    // =========================
    const elapsedMs = currentTimestamp - marketOpenTimestamp

    if (!elapsedMs || elapsedMs <= 0) return null

    const elapsedSeconds = elapsedMs / 1000

    // Indian market ~ 6.25 hours
    const SECONDS_PER_DAY = 6.25 * 3600

    const t = elapsedSeconds / SECONDS_PER_DAY

    if (t <= 0) return null

    // =========================
    // 3. ANNUALIZED HV
    // =========================
    const hv = Math.abs(r) / Math.sqrt(t) * Math.sqrt(252)

    return hv * 100
}

function extractVolFeatures(timestamp, snapshot, marketBuffer) {
    let spot = snapshot.spot
    const strikes = snapshot.strikes

    if (!strikes || strikes.length === 0) return null

    // =========================
    // 1. FIND ATM
    // =========================
    let atm = null
    let minDiff = Infinity

    for (const s of strikes) {
        const diff = Math.abs(s.strike - spot)
        if (diff < minDiff) {
            minDiff = diff
            atm = s
        }
    }

    if (!atm || atm.call_iv == null || atm.put_iv == null) {
        console.warn("Invalid ATM")
        return null
    }

    const atm_iv = (atm.call_iv + atm.put_iv) / 2

    // =========================
    // 2. SELECT WINDOW
    // =========================
    let windowStrikes = strikes.filter(
        s => s.strike >= spot * 0.95 && s.strike <= spot * 1.05
    )

    // Fallback to nearest strikes
    if (windowStrikes.length < 5) {
        const sortedByDistance = [...strikes].sort(
            (a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot)
        )
        windowStrikes = sortedByDistance.slice(0, 25)
    }

    if (windowStrikes.length < 5) return null

    // =========================
    // 3. PREPARE DATA (NORMALIZED)
    // =========================
    const data = []

    for (const s of windowStrikes) {
        const iv = ((s.call_iv + s.put_iv) / 2) / 100
        if (!isFinite(iv)) continue

        // 🔥 normalized strike axis
        const x = (s.strike - spot) / spot

        data.push({ x, y: iv })
    }

    if (data.length < 5) return null

    // =========================
    // 4. QUADRATIC FIT
    // =========================
    function quadraticFit(data) {
        let Sx = 0, Sx2 = 0, Sx3 = 0, Sx4 = 0
        let Sy = 0, Sxy = 0, Sx2y = 0
        let n = data.length

        for (const { x, y } of data) {
            const x2 = x * x

            Sx += x
            Sx2 += x2
            Sx3 += x2 * x
            Sx4 += x2 * x2

            Sy += y
            Sxy += x * y
            Sx2y += x2 * y
        }

        function det(a, b, c, d, e, f, g, h, i) {
            return a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g)
        }

        const D = det(n, Sx, Sx2, Sx, Sx2, Sx3, Sx2, Sx3, Sx4)
        if (Math.abs(D) < 1e-12) return null

        const Dc = det(Sy, Sx, Sx2, Sxy, Sx2, Sx3, Sx2y, Sx3, Sx4)
        const Db = det(n, Sy, Sx2, Sx, Sxy, Sx3, Sx2, Sx2y, Sx4)
        const Da = det(n, Sx, Sy, Sx, Sx2, Sxy, Sx2, Sx3, Sx2y)

        return {
            c: Dc / D,
            b: Db / D,
            a: Da / D
        }
    }

    const fit = quadraticFit(data)
    if (!fit) return null

    const { a, b, c } = fit

    // =========================
    // 5. INTERPRETABLE FEATURES
    // =========================

    // 🔥 curvature (smile strength)
    const curvature = a

    // 🔥 skew (tilt)
    const skew = b

    // 🔥 angle version (optional)
    const skew_angle = Math.atan(b) * (180 / Math.PI)

    // =========================
    // 6. LEGACY SLOPE (KEEP FOR BACKWARD COMPAT)
    // =========================
    function computeSlope(data, key) {
        if (!data || data.length < 2) return 0

        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
        let n = 0

        for (const d of data) {
            const x = d.strike
            const y = d[key]
            if (!isFinite(x) || !isFinite(y)) continue

            sumX += x
            sumY += y
            sumXY += x * y
            sumXX += x * x
            n++
        }

        if (n < 2) return 0

        const denom = n * sumXX - sumX * sumX
        if (denom === 0) return 0

        return (n * sumXY - sumX * sumY) / denom
    }

    const callSide = windowStrikes.filter(s => s.strike >= spot && isFinite(s.call_iv))
    const putSide = windowStrikes.filter(s => s.strike <= spot && isFinite(s.put_iv))

    const call_skew = computeSlope(callSide, "call_iv") * (spot / 1000)
    const put_skew = computeSlope(putSide, "put_iv") * (spot / 1000)

    // =========================
    // 7. HV
    // =========================
    const marketOpenTimestamp = new Date().setHours(9, 15, 0, 0)
    const hv = computeHVFromSpotPrevClose(
    currentSpot,
    prevClose,
    timestamp,
    marketOpenTimestamp
        )
    console.log('hv', hv)

    // =========================
    // FINAL OUTPUT
    // =========================
    const result = {
        atm_iv,

        // 🔥 new features
        skew,              // quadratic skew (b)
        curvature,         // smile strength (a)
        skew_angle,

        // legacy
        call_skew,
        put_skew,

        hv,
        ltp: spot,
        timestamp
    }

//    console.log("Vol Features (Upgraded):", result)

    return result
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

function fillIV(strikes) {
    for (let i = 1; i < strikes.length - 1; i++) {

        // Fill CALL IV
        if (strikes[i].call_iv == null) {
            const left = strikes[i - 1].call_iv
            const right = strikes[i + 1].call_iv

            if (left != null && right != null) {
                strikes[i].call_iv = (left + right) / 2
            }
        }

        // Fill PUT IV
        if (strikes[i].put_iv == null) {
            const left = strikes[i - 1].put_iv
            const right = strikes[i + 1].put_iv

            if (left != null && right != null) {
                strikes[i].put_iv = (left + right) / 2
            }
        }
    }
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
    const rawOC = ocPayload?.oc
    const oc = extractOC(rawOC)

    const ts = ocPayload?.ts ?? timestamp
    const spot = Number(ocPayload?.last_price)

//    console.log('ts:', ts)
//    console.log('spot:', spot)

    if (!oc || !spot || isNaN(spot)) {
        console.warn("Invalid OC payload")
        return null
    }
//    console.log("TOTAL STRIKES IN OC:", Object.keys(oc).length)

    const strikes = []

    for (const strikeKey in oc) {

        const strike = parseFloat(strikeKey)
        if (isNaN(strike)) continue

        const row = oc[strikeKey]
        if (!row) continue

        const ce = row.ce || {}
        const pe = row.pe || {}

        let call_iv = Number(ce.implied_volatility)
        let put_iv = Number(pe.implied_volatility)

//        if (!isFinite(call_iv) || call_iv <= 0 || call_iv > 5) call_iv = null
//        if (!isFinite(put_iv) || put_iv <= 0 || put_iv > 5) put_iv = null
//
//        if (!call_iv && !put_iv) continue
//
//        if (call_iv == null) call_iv = put_iv
//        if (put_iv == null) put_iv = call_iv

        strikes.push({
            strike,
            call_iv,
            put_iv,
            call_gamma: ce.greeks?.gamma ?? null,
            put_gamma: pe.greeks?.gamma ?? null,
            call_delta: ce.greeks?.delta ?? null,
            put_delta: pe.greeks?.delta ?? null
        })
    }

    if (strikes.length === 0) {
        console.warn("No valid strikes after cleaning")
        return null
    }
//    console.log('Strikes before process:', strikes)

    strikes.sort((a, b) => a.strike - b.strike)
    // 🔥 FILL MISSING IV HERE
    fillIV(strikes)

    const snapshot = { spot, strikes }

    // =========================
    // 2. FEATURE EXTRACTION
    // =========================
    const features = extractVolFeatures(ts, snapshot, marketBuffer)

    if (!features) return null
    updateIVStructureChart(features)

//    console.log('features:', features)

    // =========================
    // 3. UPDATE BUFFER
    // =========================
    updateVolFeatureBuffer(volFeatureBuffer, features)

    // =========================
    // 4. COMPUTE STATE
    // =========================
    if (!volFeatureBuffer.filled && volFeatureBuffer.index < 1) {
        return null
    }
//    console.log('volatility feature buffer', volFeatureBuffer)

    if (volFeatureBuffer.index === 0) return null

    const volState = volEngine.computeState({
        volFeatureBuffer
    })

//    console.log('volState:', volState)

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
    if (ws) {
        ws.close();   // 🔥 ADD THIS
        ws = null;
    }

//    stopWebSocket(); // prevent duplicates

    ws = new WebSocket("ws://localhost:8001/ws");

    ws.onopen = () => {
//                console.log("✅ WS connected");

                if (currentSecurityId) {
                    if (currentSecurityName == 'NIFTY')
                        socketSecurityId = 66691
                    else if (currentSecurityName == 'BANKNIFTY')
                        socketSecurityId = 66688
                    else
                        socketSecurityId = currentSecurityId

                    subscribe(socketSecurityId, currentSecurityName);
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
        if (String(data.securityId) !== String(socketSecurityId)) return;
        updateMarketBuffer(data);

        handleTick(data);
//        console.log("WS tick", data.ltp, marketBuffer.index);
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

        if (!currentCandle) {
                currentCandle = {
                    time: Math.floor(tick.timestamp),
                    open: tick.ltp,
                    high: tick.ltp,
                    low: tick.ltp,
                    close: tick.ltp
                };
            }
//        console.log({
//                tf: activeTimeframe,
//                currentBucket,
//                tickTime: Math.floor(tick.timestamp),
//            });
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

//    console.log("📡 Subscribed to:", securityId);
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
//    resetSocketCharts();      // ✅ ADD
    resetMarketBuffer();
    resetGammaBuffer();
    resetVolFeatureBuffer();
    resetIVStructureChart();
    resetNetGEXBuffer();   // ✅ ADD THIS
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
        interval: 0.1 * 60 * 1000 // N minutes
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

        updateNetGEXBuffer(netGEXBuffer, {
                timestamp: ts,
                net_gex: result.netGEX,
                call_gex: result.gammaLadder
                    .filter(x => x.gex > 0)
                    .reduce((s, x) => s + x.gex, 0),

                put_gex: result.gammaLadder
                    .filter(x => x.gex < 0)
                    .reduce((s, x) => s + x.gex, 0),

                gamma_flip: flip,
                spot: currentSpot
            });

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

//        console.log("Gamma State:", gammaState);



        const gammaVector = gammaEncoder.encode(gammaState);

//        console.log("Gamma Vector:", gammaVector);
        updateGammaBuffer(ts, gammaState, gammaVector);
        const lastStates = getRecentGammaStates(10);
        const lastVectors = getRecentGammaVectors(10);

//        console.log("Recent Gamma States:", lastStates);
//        console.log("Recent Gamma Vectors:", lastVectors);



        // 🔥 NEW PIPELINE
       const volState = processVolatilitySnapshot({
        ocPayload: {
            ts,
            last_price: currentSpot,
            oc: ocToUse
                },
                marketBuffer,
                volFeatureBuffer,
                volEngine
            })

            if (volState) {
//                console.log("Vol State:", volState)
            }
            updateNetGEXChart(netGEXBuffer);




        requestAnimationFrame(() => {
            drawGEXLadder(result.gammaLadder);
            drawGammaFlip(flip);
            renderGEXGradientEChart(result.gexGradient, currentSpot);
            renderVegaLadder(result.vegaLadder, currentSpot);
            renderVegaSkew(result.vegaSkew, currentSpot);
            plotIVChart("iv-smile-panel", ivData);
            plotIVStructure("iv-structure-panel", ivData.data, ivData.spot);
            renderOI(result.rows, currentSpot);
            renderOIChange(result.rows, currentSpot);
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

//                console.log("Gamma State:", gammaState);
                const gammaVector = gammaEncoder.encode(gammaState);

//                console.log("Gamma Vector:", gammaVector);
                updateGammaBuffer(ts, gammaState, gammaVector);


//               // 🔥 NEW PIPELINE
//               const volState = processVolatilitySnapshot({
//                ocPayload: {
//                    ts,
//                    last_price: currentSpot,
//                    oc: ocToUse
//                        },
//                        marketBuffer,
//                        volFeatureBuffer,
//                        volEngine
//                    })

//                    if (volState) {
//                        console.log("Vol State:", volState)
//                    }
//                    updateNetGEXBuffer(netGEXBuffer, {
//                            timestamp: ts,
//                            net_gex: result.netGEX,
//                            call_gex: result.gammaLadder
//                                .filter(x => x.gex > 0)
//                                .reduce((s, x) => s + x.gex, 0),
//
//                            put_gex: result.gammaLadder
//                                .filter(x => x.gex < 0)
//                                .reduce((s, x) => s + x.gex, 0),
//
//                            gamma_flip: flip,
//                            spot: currentSpot
//                        });
//                    updateNetGEXChart(netGEXBuffer);

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
                    renderGEXGradientEChart(result.gexGradient, currentSpot);
                    renderVegaLadder(result.vegaLadder, currentSpot);
                    renderVegaSkew(result.vegaSkew, currentSpot);
                    plotIVChart("iv-smile-panel", ivData);
                    plotIVStructure(
                        "iv-structure-panel",
                        ivData.data,
                        ivData.spot
                    );
                    renderOI(result.rows, currentSpot);
                    renderOIChange(result.rows, currentSpot);
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
let cachedPrevClose = null
function extractPrevClose(quote) {
    if (!quote) return null
//    console.log('quote', quote)

    const close = quote?.ohlc?.close
//    console.log('close', close)

    if (!close || !isFinite(close) || close <= 0) {
        console.warn("Invalid previous close")
        return null
    }

    return close
}
function getPrevClose(res) {
   if (cachedPrevClose) return cachedPrevClose
    const quote = extractQuoteNode(res)

    const close = extractPrevClose(quote)
    if (close) cachedPrevClose = close

    return cachedPrevClose
}
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
            prevClose = getPrevClose(data);

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













//---------------------------------
//Helper Functions------------
//---------------------------------







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



let alphaLoop = null;

function startAlphaLoop() {
    if (alphaLoop) return;

    alphaLoop = setInterval(() => {
        updateAlphaChart(marketBuffer);
        updateMicroChart(marketBuffer);       // 🔥 ADD
        updateImbalanceChart(marketBuffer);   // 🔥 ADD
        updateFlowChart(marketBuffer);
        updateLBAChart(marketBuffer);
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
//    console.log('logI:', logI)
//    console.log('logdP:', logdP)

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
        stopRealtime,
        stopQuotePolling,
        destroy
    }

})()
window.RealtimeRenderer = RealtimeRenderer;