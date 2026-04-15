/**
 * ============================================================
 * 📦 Market Buffer Module
 * ============================================================
 *
 * Description:
 * High-performance in-memory FIFO buffer for real-time market
 * microstructure data. Acts as a shared state across the system.
 *
 * Version: 1.0.0
 * License: MIT (see LICENSE file)
 *
 * Developed by: Pallav Nandi Chaudhuri
 * ============================================================
 */


// ============================================================
// 📦 MARKET BUFFER (SINGLETON)
// ============================================================
// Centralized state container for real-time tick data.
//
// 🔥 Architecture Role:
// WebSocket → Buffer → Feature Engine → Models → Charts
//
// 🔥 Design Principles:
// - Fixed-size buffer (1000 points)
// - Shared singleton across modules
// - Optimized for real-time streaming
// - Avoids reallocation (low GC pressure)
//
// ⚠️ IMPORTANT:
// - Do NOT reinitialize this object after import
// - Always mutate or reset using provided utilities
//
export const marketBuffer = {

    // --------------------------------------------------
    // ⚙️ BUFFER CONFIGURATION
    // --------------------------------------------------
    size: 1000,        // Maximum number of data points stored
    index: 0,          // Write pointer (used for circular logic if enabled)
    filled: false,     // Indicates buffer has reached full capacity

    // --------------------------------------------------
    // 📊 CORE MARKET DATA
    // --------------------------------------------------
    ltp: new Array(1000),   // Last Traded Price
    ltq: new Array(1000),   // Last Traded Quantity

    bid: new Array(1000),   // Best bid price (Level 1)
    ask: new Array(1000),   // Best ask price (Level 1)

    // --------------------------------------------------
    // 🧠 MICROSTRUCTURE FEATURES
    // --------------------------------------------------
    microprice: new Array(1000),  
    // Weighted mid-price:
    // (ask * bidQty + bid * askQty) / (bidQty + askQty)

    imbalance: new Array(1000),   
    // Order book imbalance:
    // (bidQty - askQty) / (bidQty + askQty)

    flow: new Array(1000),        
    // Signed order flow proxy:
    // imbalance * traded quantity (ltq)
    returns: new Float64Array(1000),   // 🔥 ADD THIS

    // --------------------------------------------------
    // ⏱️ TIME
    // --------------------------------------------------
    timestamp: new Array(1000),  
    // Exchange timestamp (or tick time)
};


export function updateMarketBuffer(data) {
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

    const size = marketBuffer.size;

    // 🚨 SHIFT LEFT (drop index 0)
    for (let i = 0; i < size - 1; i++) {
        marketBuffer.ltp[i] = marketBuffer.ltp[i + 1];
        marketBuffer.ltq[i] = marketBuffer.ltq[i + 1];
        marketBuffer.bid[i] = marketBuffer.bid[i + 1];
        marketBuffer.ask[i] = marketBuffer.ask[i + 1];
        marketBuffer.microprice[i] = marketBuffer.microprice[i + 1];
        marketBuffer.imbalance[i] = marketBuffer.imbalance[i + 1];
        marketBuffer.flow[i] = marketBuffer.flow[i + 1];
        marketBuffer.returns[i] = marketBuffer.returns[i + 1];
        marketBuffer.timestamp[i] = marketBuffer.timestamp[i + 1];
    }

    // ✅ INSERT at last position
    const last = size - 1;

    marketBuffer.ltp[last] = data.ltp;
    marketBuffer.ltq[last] = data.ltq;
    marketBuffer.bid[last] = bid;
    marketBuffer.ask[last] = ask;
    marketBuffer.microprice[last] = micro;
    marketBuffer.imbalance[last] = imbalance;
    marketBuffer.flow[last] = flow;
    // 🔹 Compute return
    if (last > 0 && marketBuffer.ltp[last - 1]) {
        const prev = marketBuffer.ltp[last - 1];
        const curr = marketBuffer.ltp[last];

        // Option 1: Log return (recommended)
        marketBuffer.returns[last] = Math.log(curr / prev);

        // Option 2: Simple return (if needed)
        // marketBuffer.returns[last] = (curr - prev) / prev;
    } else {
        marketBuffer.returns[last] = 0;
    }
    marketBuffer.timestamp[last] = data.ltt;

    // 🟢 mark filled
    marketBuffer.filled = true;
}


// ============================================================
// 🔄 RESET MARKET BUFFER
// ============================================================
// Clears buffer contents without reallocating memory.
//
// 🔥 Why this is critical:
// - Prevents garbage collection overhead
// - Maintains object reference (important for UI + engines)
// - Enables fast switching (symbol / timeframe)
//
// 🔥 When to use:
// - On symbol change
// - On timeframe change
// - On system reset
//
// ⚠️ Behavior:
// - Mutates existing buffer (does NOT create new one)
// - Safe to call multiple times
//
export function resetMarketBuffer() {

    // Reset buffer state
    marketBuffer.index = 0;
    marketBuffer.filled = false;

    // Efficiently clear all array fields
    Object.keys(marketBuffer).forEach(key => {

        // Only reset array-based properties
        if (Array.isArray(marketBuffer[key])) {

            // Fill with undefined to avoid false signals
            // (better than 0 for trading logic)
            marketBuffer[key].fill(undefined);
        }
    });
}