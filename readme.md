# Quant Pipeline — Development Log

## Overview

Today's development focused on transforming the initial websocket ingestion prototype into a multi-symbol streaming quant analytics engine capable of:

* ingesting live market ticks
* fetching option-chain states
* computing microstructure features
* computing volatility and gamma analytics
* building instability signals
* aggregating streaming snapshots
* persisting structured market-state data into CSV

The system architecture evolved from a simple single-symbol prototype into a stateful multi-symbol streaming market analytics pipeline.

---

# Current Architecture

```text
Dhan Feed
    ↓
FastAPI WebSocket Server
    ↓
Quant Pipeline Tick Stream
    ↓
Tick + Option Chain Merge
    ↓
Feature Engine
    ↓
Snapshot Buffer
    ↓
Aggregated Snapshot
    ↓
CSV Persistence
```

---

# Directory Structure

```text
quant_pipeline/
│
├── config/
│   └── stocks.csv
│
├── core/
│   ├── websocket_client.py
│   ├── option_chain_fetcher.py
│   ├── tick_cache.py
│   ├── scheduler.py
│   ├── snapshot_buffer.py
│   └── dhan_client.py
│
├── features/
│   ├── microstructure.py
│   ├── gamma_metrics.py
│   ├── skew_metrics.py
│   ├── flow_metrics.py
│   ├── volatility.py
│   └── instability.py
│
├── storage/
│   ├── csv_writer.py
│   └── schema.py
│
├── models/
│   ├── tick.py
│   └── option_chain.py
│
└── main.py
```

---

# Major Development Milestones

## 1. Multi-Symbol WebSocket Subscription Engine

### Problem

Original websocket architecture only supported:

```text
single symbol switching
```

which worked for GUI interaction but failed for multi-stock analytics.

### Solution

Extended websocket server to support:

```text
additive subscriptions
```

without breaking frontend compatibility.

### Final Design

Two subscription models now coexist:

| Component | Behavior                              |
| --------- | ------------------------------------- |
| switch    | frontend GUI                          |
| subscribe | quant pipeline multi-symbol ingestion |

### Result

The quant engine can now subscribe to multiple instruments simultaneously while the GUI retains original functionality.

---

# 2. Tick Streaming and Merge Engine

Implemented:

* live websocket tick ingestion
* per-symbol tick caching
* asynchronous merge loop
* option-chain synchronization

### Merge Flow

```text
live tick
    +
latest option chain
    ↓
compute snapshot
```

---

# 3. Option Chain Rate-Limited Scheduler

### Constraint

Dhan option-chain endpoint allows:

```text
4 requests / 30 seconds
```

### Solution

Implemented rolling sequential scheduler:

```text
1 request every 7.5 seconds
```

instead of parallel asyncio.gather() bursts.

### Benefits

* prevents API throttling
* naturally staggered chain states
* more stable analytics

---

# 4. DataFrame-Native Option Chain Pipeline

## Previous State

Feature functions expected:

```text
raw JSON dicts
```

## New State

Normalized all option-chain responses into:

```text
Pandas DataFrames
```

### Benefits

* vectorized analytics
* cleaner feature computation
* scalable processing
* easier visualization

### Current Schema

```text
strike
call_price
call_oi
call_oi_change
call_delta
call_theta
put_price
put_oi
put_oi_change
put_delta
put_theta
gamma
vega
iv
expiry_date
```

---

# 5. Market Microstructure Engine

Implemented advanced depth-aware market microstructure analytics.

## Spread

```text
spread = ask - bid
```

## Depth-5 Imbalance

Measures liquidity asymmetry across top 5 orderbook levels.

## Depth-5 Microprice

Weighted fair-value estimate using:

* bid prices
* ask prices
* liquidity weights

## Flow

Implemented as:

```text
flow = imbalance × LTQ
```

which approximates directional execution pressure.

## dS

Implemented as:

```text
dS = microprice_t - microprice_(t-1)
```

which acts as a latent fair-value drift signal.

---

# 6. Gamma Exposure Analytics

Implemented:

* strike-wise gamma ladder
* call GEX
* put GEX
* net GEX
* gamma flip

## Current Formulation

```text
callGEX = gamma × call_oi
putGEX  = gamma × put_oi
netGEX  = callGEX - putGEX
```

## Gamma Flip

Computed as:

```text
strike where cumulative GEX changes sign
```

### Interpretation

| Regime            | Meaning                      |
| ----------------- | ---------------------------- |
| spot > gamma flip | stabilizing dealer hedging   |
| spot < gamma flip | destabilizing dealer hedging |

---

# 7. IV Surface Analytics

Implemented:

* ATM IV extraction
* call skew
* put skew
* IV surface gradients

## ATM IV

Computed as:

```text
IV of strike closest to spot
```

## Skew

Computed using:

```text
∂IV / ∂K
```

rather than simple OTM-ATM differences.

This captures:

* surface topology
* directional IV structure
* convexity changes

---

# 8. Approximate Historical Volatility

Implemented streaming HV proxy using:

```text
HV = |log(LTP / PrevClose)| × sqrt(256)
```

### Inputs

* current LTP
* previous day close

### Purpose

Provides online realized-volatility approximation without requiring OHLC history windows.

---

# 9. Instability Engine (I1 / I2 / I3)

Implemented streaming instability-state engine.

## I1

Measures divergence between:

* flow anomaly
* return anomaly

using rolling z-score normalization.

### Interpretation

| I1       | Meaning                                |
| -------- | -------------------------------------- |
| positive | liquidity stronger than price move     |
| negative | price moving without liquidity support |

## I2

Measures:

```text
first derivative of instability
```

## I3

Measures:

```text
second derivative / instability acceleration
```

### Important Architectural Fix

Instability engines are now maintained:

```text
per symbol
```

to prevent cross-symbol contamination.

---

# 10. Snapshot Buffer and Aggregation Layer

Implemented rolling snapshot buffers.

## Purpose

Avoid storing noisy raw instantaneous states.

## Aggregation Method

Implemented:

```text
1σ filtered rolling mean
```

which:

* suppresses spikes
* removes unstable outliers
* stabilizes feature persistence

### Pipeline

```text
raw snapshot
    ↓
rolling buffer
    ↓
filtered aggregation
    ↓
CSV persistence
```

---

# 11. CSV Persistence

Snapshots now store:

```text
time
ltp
gammaFlip
imbalance
microprice
spread
flow
dS
IV
callSkew
putSkew
netGEX
callGEX
putGEX
I1
I2
I3
```

---

# Important Architectural Learnings

## 1. Stateful Systems Require Per-Symbol Isolation

Shared temporal engines corrupt multi-symbol analytics.

All streaming state must be isolated:

```text
symbol → independent state machine
```

---

## 2. DataFrame-Native Analytics Simplify Quant Pipelines

Transitioning from raw dicts to DataFrames significantly simplified:

* GEX computation
* skew computation
* IV extraction
* vectorized feature operations

---

## 3. Streaming Analytics Differ from Batch Analytics

Correct ordering matters:

```text
raw signals
    ↓
instability engine
    ↓
aggregation
```

NOT:

```text
aggregation
    ↓
instability
```

because aggregation suppresses variance.

---

## 4. Market Closed-State Behavior

Observed repeated rows due to:

* frozen ticks
* unchanged option chains

which is expected behavior after market close.

---

# Current System Capabilities

The engine can now:

✅ ingest live ticks

✅ subscribe to multiple stocks simultaneously

✅ fetch and normalize option chains

✅ compute market microstructure features

✅ compute GEX structure

✅ compute IV and skew structure

✅ compute instability dynamics

✅ aggregate streaming states

✅ persist market-state snapshots into CSV

---

# Next Development Targets

## Immediate

* improve snapshot aggregation operators
* add duplicate tick suppression
* improve depth validation
* add EWMA smoothing
* add online volatility estimators

## Medium-Term

* hidden-state modeling
* Kalman filters
* HMM regime estimation
* stochastic latent-state inference
* probabilistic market-state transitions

## Long-Term Vision

Transform pipeline into:

```text
Streaming Probabilistic Market Intelligence Engine
```

with:

* online state estimation
* regime detection
* latent liquidity inference
* dealer-position dynamics
* stochastic instability propagation

---

# Suggested Git Commit

```text
feat: implement multi-symbol streaming quant snapshot engine
```

---

# Warning and Usage Disclaimer

This project is currently intended for:

* quant research
* market microstructure learning
* experimentation
* educational exploration
* probabilistic market-state analysis

It is NOT production-ready and should NOT be used for:

* live trading
* automated execution
* financial decision-making
* risk-sensitive deployment
* production alpha generation

The system is still under active development and may contain:

* modeling inaccuracies
* unstable signals
* synchronization issues
* incomplete validation
* incorrect assumptions under real market conditions

Use this project strictly as a:

```text
quant learning and research tool
```

For more information, collaboration, or research discussions, contact the project author.
Developed by Pallav Nandi Chaudhuri

This project was built through iterative quantitative research, systems engineering, and LLM-assisted development workflows focused on market microstructure and probabilistic market-state analytics.

