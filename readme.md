# Quant Pipeline — Development Log
# Recursive Probabilistic Market Ecology Framework
# Microstructure Engine

A probabilistic latent-state market microstructure research framework for:

- online market-state inference
- order-flow geometry
- entropy-conditioned forecasting
- stochastic path simulation
- probabilistic regime transitions
- adaptive normalization
- semantic signal generation

The engine combines:

- market microstructure analytics
- latent-state clustering
- transition probability geometry
- entropy topology
- stochastic forecasting
- online probabilistic inference

---

# Core Features

## Market Data Pipeline

- websocket ingestion
- rolling feature computation
- parquet persistence
- online state updates

---

## Microstructure Features

The engine computes several market microstructure variables:

### Order Flow Imbalance (OFI)

```text
OFI_t = BuyPressure_t - SellPressure_t
```

---

### Microprice

```text
MicroPrice_t =
(
AskPrice_t * BidVolume_t
+
BidPrice_t * AskVolume_t
)
/
(
BidVolume_t + AskVolume_t
)
```

---

### Realized / Historical Volatility

```text
HV_t = sqrt(
summation( (r_i - mean(r))^2 ) / N
)
```

---

### Inventory / Imbalance States

```text
I1, I2, I3
```

represent multi-level market imbalance geometry.

---

# Latent State Engine

The framework performs latent-state inference using clustering.

## State Assignment

```text
S_t ∈ {0,1,2,...,K}
```

where:

- S_t = latent market regime
- K = number of inferred regimes

---

## Transition Geometry

The engine estimates:

```text
P(S_t+1 | S_t)
```

through empirical transition matrices.

---

## Transition Entropy

Entropy is computed directly from transition topology:

```text
H(S_t) =
-summation(
p_i * log2(p_i)
)
```

This measures:

- regime uncertainty
- transition disorder
- market instability
- persistence collapse

---

# Clustering Methodology

The latent-state inference layer uses:

## MiniBatchKMeans

for online-scalable market regime discovery.

---

## Objective Function

The clustering process minimizes:

```text
J =
summation(
|| x_i - mu_k ||^2
)
```

where:

- x_i = feature vector
- mu_k = cluster centroid
- J = within-cluster variance

---

## Feature Geometry

The clustering engine operates on:

```text
X_t =
[
OFI_t,
MicroPrice_t,
HV_t,
I1_t,
I2_t,
I3_t
]
```

after normalization.

---

## Why MiniBatchKMeans

MiniBatchKMeans was selected because it provides:

- low-latency updates
- scalable online learning
- efficient streaming compatibility
- memory-efficient clustering
- real-time regime adaptation

This is important for:

- websocket-driven inference
- live market-state tracking
- online latent geometry evolution

---

## Latent Regime Interpretation

The clustering engine infers:

```text
S_t = Cluster(X_t)
```

where:

```text
S_t ∈ {0,1,2,...,K}
```

Each cluster represents a probabilistic market microstructure regime.

Examples include:

- liquidity compression
- directional imbalance
- volatility expansion
- mean-reversion geometry
- dealer inventory transition

---

## Future Research Directions

Planned extensions include:

- online incremental clustering
- probabilistic soft clustering
- Hidden Markov Models (HMM)
- Variational latent embeddings
- manifold regime topology
- entropy-constrained clustering
- transition-aware clustering geometry

# Conditional Return Geometry

For each latent state:

```text
E[dS_t+1 | S_t]
```

and

```text
Std[dS_t+1 | S_t]
```

are estimated empirically.

This enables:

- regime-conditioned forecasting
- volatility-aware path simulation
- probabilistic return geometry

---

# Monte Carlo Simulation

The engine generates probabilistic future paths.

## Return Sampling

```text
dS_t ~ Normal(
mu_state,
sigma_state
)
```

---

## State Evolution

```text
S_t+1 ~ P(S_t+1 | S_t)
```

---

## Cumulative Path

```text
Path_t =
summation(dS_i)
```

---

# Semantic Signal Layer

The architecture supports future semantic regime interpretation.

Examples:

- stable accumulation
- panic transition
- volatility expansion
- dealer unwind
- entropy compression

---

# Normalization Modes

The engine supports multiple normalization geometries.

## Global Normalization

```text
x_norm =
(x - global_mean)
/
global_std
```

---

## Local Normalization

```text
x_norm =
(x - rolling_mean)
/
rolling_std
```

---

## Hybrid Normalization

Combines:

- structural stability
- local adaptability
- online robustness

---

# GUI System

The project includes a PySide6-based GUI controller for:

- online state visualization
- regime monitoring
- Monte Carlo inspection
- entropy tracking
- probabilistic forecasting

---

# Current Research Areas

## Online Adaptive Transitions

Future transition modeling:

```text
P_t(
S_t+1 |
S_t,
OFI_t,
HV_t,
Entropy_t
)
```

---

## Latent Geometry Refinement

Research focus includes:

- entropy geometry
- persistence topology
- state manifold structure
- probabilistic embeddings

---

## Confidence-Weighted Forecasting

Future direction:

```text
Forecast =
summation(
w_i * Path_i
)
```

where:

```text
w_i = confidence(path_i)
```

---

# Sub directory Structure

```text
microstructure-engine/
│
├── market_engine/
│   ├── clustering/
│   ├── features/
│   ├── monte_carlo/
│   ├── signals/
│   ├── persistence/
│   ├── normalization/
│   ├── gui/
│   └── tests/
│
├── data/
│   ├── parquet/
│   ├── clusters/
│   └── states/
│
├── backtest/
│
├── notebooks/
│
└── README.md
```

---

# How To Use

## 1. Clone Repository

```bash
git clone <repository-url>
cd microstructure-engine
```

---

## 2. Create Environment

```bash
conda create -n microstructure python=3.11
conda activate microstructure
```

---

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 4. Start Data Engine

```bash
python -m market_engine.websocket.stream
```

---

## 5. Run Clustering Pipeline

```bash
python -m market_engine.clustering.cluster_states
```

---

## 6. Run Monte Carlo Engine

```bash
python -m market_engine.monte_carlo.montecarlo_engine
```

---

## 7. Run Integrity Tests

```bash
python -m market_engine.tests.test_montecarlo_integrity
```

---

## 8. Launch GUI

```bash
python -m market_engine.gui.main
```

---

# Research Goals

The long-term objective is to build:

## A Probabilistic Market Intelligence Engine

capable of:

- online latent-state inference
- probabilistic market forecasting
- entropy-aware regime analysis
- semantic state interpretation
- adaptive transition geometry
- risk-aware stochastic simulation

---

# Technologies Used

- Python
- NumPy
- Pandas
- PyArrow
- Scikit-learn
- PySide6
- WebSockets
- Parquet
- MiniBatchKMeans

---

# Development Notes

This project is an evolving research-oriented probabilistic market microstructure framework.

The architecture combines:

- quantitative finance
- market microstructure
- stochastic processes
- latent-state modeling
- probabilistic simulation
- entropy geometry



---
##
# Stochastic Volatility Engine

## Overview

`stochastic-vol-engine` is a probabilistic market microstructure research framework designed to study:

* volatility regime dynamics
* dealer positioning transitions
* convexity expansion
* stochastic state evolution
* local manifold geometry
* empirical market-state diffusion

The system combines:

* weighted K-Nearest Neighbors (KNN)
* stochastic regime conditioning
* transition entropy estimation
* empirical Markov transition matrices
* local covariance geometry
* Monte Carlo manifold simulation

The architecture is designed around:

[
P(X_{t+1} \mid X_t)
]

rather than simplistic directional prediction.

The framework focuses on:

* implied volatility evolution
* skew diffusion
* dealer gamma exposure topology
* liquidity stress
* convexity persistence
* probabilistic regime transitions

---

# Core Philosophy

Instead of predicting:

```text
price direction
```

this engine models:

[
P(
Regime_{t+1}
\mid
Regime_t,
IV_t,
Skew_t,
Flow_t
)
]

and eventually:

[
P(
X_{t+1}
\mid
X_t
)
]

where:

[
X_t =
[
IV,
Skew,
Flow,
GEX,
Spread,
Imbalance,
dS
]
]

This transforms the system into:

# stochastic market-state topology inference

rather than ordinary machine learning.

---

# Current System Capabilities

| Layer                              | Status   |
| ---------------------------------- | -------- |
| Feature manifold retrieval         | Complete |
| Weighted KNN probability engine    | Complete |
| Dealer regime conditioning         | Complete |
| Convexity edge estimation          | Complete |
| Transition probability estimation  | Complete |
| Regime persistence modeling        | Complete |
| Transition entropy estimation      | Complete |
| Empirical Markov transition matrix | Complete |
| Local covariance geometry          | Complete |
| Local stochastic drift estimation  | Complete |
| Monte Carlo state simulation       | Complete |
| Experiment summary logging         | Complete |

---

# Market Data Structure

The engine expects CSV input with columns similar to:

```text
<time
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
I3>
```

Derived features include:

* skew differential
* regime labels
* future convexity edge
* transition states
* stochastic state differentials

---

# Dealer Regime Conditioning

The framework separates market states into:

* positive_gex
* negative_gex

This allows independent local manifold estimation under:

## Positive GEX

Typically associated with:

* dealer stabilization
* compressed volatility
* liquidity support
* lower entropy
* convexity suppression

## Negative GEX

Typically associated with:

* dealer destabilization
* volatility expansion
* liquidity fragmentation
* convexity clustering
* tail amplification

---

# Weighted KNN Probability Engine

Local analog probabilities are estimated using:

[
w_i = \frac{1}{d_i + \epsilon}
]

Weighted probability:

[
P =
\frac{
\sum w_i Y_i
}{
\sum w_i
}
]

This creates:

* local manifold conditioning
* distance-sensitive inference
* empirical analog retrieval

rather than rigid global models.

---

# Transition Dynamics

The engine estimates:

[
P(
Regime_{t+1}
\mid
X_t
)
]

using empirical local topology.

Supported transitions:

| Transition          | Meaning                  |
| ------------------- | ------------------------ |
| positive → positive | stable dealer pinning    |
| positive → negative | convexity expansion risk |
| negative → positive | volatility compression   |
| negative → negative | instability persistence  |

---

# Transition Entropy

Entropy is computed as:

[
H =
---

\sum p_i \log p_i
]

Interpretation:

| Entropy | Meaning                 |
| ------- | ----------------------- |
| Low     | ordered market topology |
| High    | unstable manifold       |
| Rising  | transition instability  |

This becomes a measure of:

# market-state disorder

---

# Empirical Transition Matrix

The engine estimates:

[
T=
\begin{bmatrix}
P(P\to P) & P(P\to N) \
P(N\to P) & P(N\to N)
\end{bmatrix}
]

This acts as:

# empirical dealer-state Markov dynamics

---

# Local Stochastic Drift

For each local neighborhood:

[
\Delta X = X_{t+1} - X_t
]

The framework estimates:

[
\mu(X_t)
]

and:

[
\Sigma(X_t)
]

where:

* drift represents local state evolution
* covariance represents stochastic uncertainty

This allows:

* IV diffusion estimation
* skew evolution
* GEX topology propagation
* liquidity stress modeling

---

# Monte Carlo Manifold Simulation

The framework performs:

# empirical bootstrap diffusion

rather than Gaussian assumption-based simulation.

Simulation paths evolve through:

[
X_{t+1}
=======

X_t
+
\Delta X
]

where:

[
\Delta X
]

is sampled from local empirical neighbor dynamics.

Generated outputs:

* IV path simulations
* skew path simulations
* GEX evolution
* liquidity evolution
* Monte Carlo moments
* covariance geometry

Saved automatically as PNG files.

---

# Project Structure

```text
stochastic-vol-engine/
│
├── backend/
│   └── config.py
│
├── offline_viewer/
│   ├── main_window.py
│   └── result_widget.py
│
├── quant_pipeline/
│   ├── preprocessing.py
│   ├── feature_engineering.py
│   ├── label_generation.py
│   ├── scaling_engine.py
│   ├── knn_engine.py
│   ├── probability_engine.py
│   ├── pipeline_runner.py
│   ├── summary_engine.py
│   └── plot_engine.py
│
├── monte_carlo/
│   └── monte_carlo_engine.py
│
├── monte_carlo_output_knn_based/
│   └── <csv_name>/
│       ├── positive_gex/
│       ├── negative_gex/
│       └── <csv_name>_summary.txt
│
└── training_data/
```

---

# Generated Outputs

Each experiment generates:

## Monte Carlo Path Images

Examples:

* IV_paths.png
* skew_diff_paths.png
* netGEX_paths.png
* spread_paths.png

## Statistical Summary

Saved as:

```text
<csv_name>_summary.txt
```

Includes:

* transition matrix
* entropy history
* covariance eigenvalues
* regime duration statistics
* Monte Carlo moments
* local drift
* feature dispersion
* convexity statistics

---

# Experiment Logging

The framework automatically stores:

| Metric                 | Purpose                |
| ---------------------- | ---------------------- |
| timestamp              | reproducibility        |
| parameter values       | experiment tracking    |
| entropy history        | instability monitoring |
| covariance eigenvalues | manifold geometry      |
| regime durations       | persistence analysis   |
| Monte Carlo moments    | path diagnostics       |

---

# Mathematical Interpretation

The system approximates:

[
X_{t+1}
=======

X_t
+
\mu(X_t)
+
\Sigma(X_t)\epsilon
]

where:

| Component     | Meaning                   |
| ------------- | ------------------------- |
| (\mu(X_t))    | local empirical drift     |
| (\Sigma(X_t)) | local covariance geometry |
| (\epsilon)    | stochastic market shock   |

This effectively creates:

# local stochastic manifold diffusion

---

# Future Research Directions

Potential extensions:

* weighted covariance estimation
* regime-conditioned bootstrap
* hidden Markov topology
* volatility surface diffusion
* convexity cascade modeling
* stochastic liquidity stress testing
* semi-Markov persistence modeling
* regime hazard estimation
* eigenstructure instability tracking
* multiscale entropy modeling

---

# Research Orientation

This framework is designed as:

# a stochastic market microstructure research environment

rather than:

```text
retail directional prediction system
```

The primary objective is:

* probabilistic state evolution
* convexity topology analysis
* dealer regime dynamics
* empirical stochastic geometry

---

# Streaming Quant Pipeline Integration

The stochastic volatility engine is integrated into a broader recursive probabilistic market ecology framework focused on:

* live market-state ingestion
* option-chain synchronization
* convexity-aware analytics
* ecological regime persistence
* adaptive stochastic simulation
* recursive instability propagation

The upstream streaming architecture constructs probabilistic market-state histories which are later consumed by the stochastic volatility engine.

---

# Recursive Probabilistic Market Ecology

The broader framework evolved from:

```text
single-symbol websocket prototype
```

into:

```text
recursive adaptive probabilistic market ecology
```

The architecture models:

* nonlinear stochastic systems
* participant reflexivity
* adaptive attractor dynamics
* metastable regime occupancy
* convexity-sensitive transitions
* ecological persistence memory

---

# High-Level Integrated Architecture

```text
Live Market Feed
        ↓
Streaming Tick Engine
        ↓
Option Chain Synchronization
        ↓
Feature Extraction Layer
        ↓
Microstructure Analytics
        ↓
Instability Engine
        ↓
Probabilistic State Construction
        ↓
Stochastic Volatility Engine
        ↓
Recursive Ecological Simulation
        ↓
Adaptive Monte Carlo Ecology
        ↓
Persistent Ecological Storage
```

---

# Streaming Feature Layer

The upstream streaming infrastructure computes:

## Market Microstructure

* bid-ask spread
* liquidity imbalance
* microprice
* latent fair-value drift
* execution flow

## Volatility Topology

* ATM IV
* call skew
* put skew
* surface gradients
* realized-volatility approximation

## Dealer Convexity Structure

* net GEX
* call GEX
* put GEX
* gamma flip
* convexity imbalance

## Recursive Instability Metrics

* instability divergence
* instability velocity
* instability acceleration

These become the probabilistic state variables used by the stochastic volatility engine.

---

# Ecological Monte Carlo Framework

The simulation layer evolved beyond:

```text
classical geometric Brownian motion
```

The framework now behaves as:

```text
recursive adaptive probabilistic ecology
```

The simulator recursively evolves:

* metastable occupancy
* regime migration
* participant reflexivity
* convexity amplification
* entropy-aware transitions
* adaptive reconvergence

---

# Adaptive Attractor Geometry

The simulator models:

* local instability
* recursive divergence
* liquidity stabilization
* ecological reconvergence
* bounded occupancy migration

This produces:

```text
bounded metastable ecological fields
```

rather than:

```text
independent random walks
```

---

# Participant Reflexivity

The broader ecology engine models:

* dealer stabilization
* panic amplification
* hedging intensity
* liquidity contraction
* recursive ecological feedback

This transforms the framework from:

```text
price-only stochastic evolution
```

into:

```text
participant-aware ecological simulation
```

---

# Integrated Research Direction

The combined framework is evolving toward:

```text
Recursive Probabilistic Market Intelligence System
```

focused on:

* probabilistic market-state topology
* adaptive hidden-state evolution
* convexity-aware stochastic systems
* metastable occupancy dynamics
* ecological transition structures
* entropy-aware regime migration
* recursive market reflexivity

---

# Development Philosophy

The project intentionally avoids:

```text
naive directional prediction
```

Instead the framework focuses on:

* stochastic state evolution
* probabilistic topology
* empirical manifold geometry
* adaptive ecological persistence
* nonlinear transition dynamics
* convexity propagation

---

# Integrated Project Status

The combined system currently supports:

✅ live market ingestion

✅ multi-symbol streaming

✅ option-chain synchronization

✅ microstructure analytics

✅ implied-volatility topology

✅ dealer convexity estimation

✅ instability-state construction

✅ weighted manifold inference

✅ stochastic regime dynamics

✅ entropy-aware transition modeling

✅ empirical Markov transition matrices

✅ local stochastic drift estimation

✅ covariance geometry inference

✅ Monte Carlo manifold simulation

✅ persistent experiment logging

---

# Disclaimer

This project is experimental research software intended for:

* quantitative research
* market microstructure analysis
* stochastic volatility experimentation
* probabilistic state modeling
* ecological simulation research

It is not financial advice or a production trading system.

## Adaptive Monte Carlo simulation based of statistical observation
## Mathematical Overview

This project is an experimental research-oriented quantitative market intelligence framework focused on:

* streaming market-state analytics
* probabilistic regime dynamics
* ecological market simulation
* recursive latent-state evolution
* convexity-aware stochastic systems
* participant reflexivity
* adaptive market-state persistence
* metastable probabilistic path generation

The architecture evolved from a websocket ingestion prototype into a recursive adaptive probabilistic market ecology system modeling nonlinear stochastic ecological dynamics.

The project combines:

* streaming market microstructure analytics
* option-chain state extraction
* instability propagation
* probabilistic regime transitions
* ecological Monte Carlo simulation
* adaptive attractor dynamics
* recursive participant modeling

The framework explores recursive stochastic ecological systems through:

* quantitative research
* market microstructure learning
* probabilistic market-state exploration
* hidden-state experimentation
* adaptive stochastic-system development
* educational exploration

---

# High-Level System Architecture

```text
Live Market Feed
        ↓
Streaming Tick Engine
        ↓
Option Chain Synchronization
        ↓
Feature Extraction Layer
        ↓
Microstructure Analytics
        ↓
Instability Engine
        ↓
Probabilistic State Construction
        ↓
Recursive Ecological Simulation
        ↓
Adaptive Monte Carlo Ecology
        ↓
Persistent Ecological Storage
```

---

# Mathematical System Topology

```text
Observed Market State
        ↓
Latent Feature Extraction
        ↓
Microstructure State Construction
        ↓
Convexity Topology Estimation
        ↓
Recursive Instability Propagation
        ↓
Probabilistic Regime Occupancy
        ↓
Participant Reflexivity Dynamics
        ↓
Entropy-Aware Transition Ecology
        ↓
Adaptive Attractor Evolution
        ↓
Recursive Metastable Simulation
        ↓
Persistent Ecological Memory
```

---

# Symbolic Project Structure

```text
project_root/
│
├── config/
│   ├── stocks.csv
│   ├── settings.py
│   └── environment.py
│
├── core/
│   ├── websocket_client.py
│   ├── option_chain_fetcher.py
│   ├── tick_cache.py
│   ├── scheduler.py
│   ├── snapshot_buffer.py
│   ├── dhan_client.py
│   └── state_manager.py
│
├── features/
│   ├── microstructure.py
│   ├── gamma_metrics.py
│   ├── skew_metrics.py
│   ├── flow_metrics.py
│   ├── volatility.py
│   ├── instability.py
│   ├── liquidity.py
│   └── entropy_metrics.py
│
├── monte_carlo/
│   ├── montecarlo.py
│   ├── path_generator.py
│   ├── trajectory_dynamics.py
│   ├── persistence_engine.py
│   ├── latent_pressure.py
│   ├── state_transition_matrix.py
│   ├── participant_response.py
│   ├── interaction_engine.py
│   ├── probabilistic_walk.py
│   ├── convergence.py
│   ├── diagnostics.py
│   └── visualization.py
│
├── storage/
│   ├── csv_writer.py
│   ├── report_exporter.py
│   ├── schema.py
│   └── persistence.py
│
├── visualization/
│   ├── path_plots.py
│   ├── volatility_plots.py
│   ├── distribution_plots.py
│   └── ecological_plots.py
│
├── models/
│   ├── tick.py
│   ├── option_chain.py
│   └── probabilistic_state.py
│
├── market_data/
│   ├── SYMBOL.csv
│   └── ...
│
├── monte_carlo_output/
│   ├── SYMBOL/
│   │   ├── SYMBOL_paths.png
│   │   ├── SYMBOL_distribution.png
│   │   ├── SYMBOL_bands.png
│   │   ├── SYMBOL_levels.png
│   │   ├── SYMBOL_report.csv
│   │   └── SYMBOL_report.json
│   └── ...
│
├── notebooks/
│   ├── experimentation.ipynb
│   └── research.ipynb
│
├── main.py
├── requirements.txt
└── README.md
```

---

# Streaming Probabilistic State Construction

## Purpose

The streaming layer is responsible for:

* ingesting live market ticks
* synchronizing option-chain states
* extracting market microstructure features
* computing instability metrics
* constructing probabilistic market states
* persisting ecological histories

---

# Current Streaming Architecture

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

# Core Mathematical Subsystems

## 1. Multi-Symbol Streaming Engine

The websocket infrastructure supports:

* additive subscriptions
* simultaneous multi-symbol ingestion
* independent symbol-state isolation
* asynchronous tick synchronization

This enables:

```text
parallel probabilistic market-state evolution
```

rather than single-symbol reactive streaming.

---

# 2. Option Chain Synchronization Layer

The option-chain engine maintains:

* rolling option snapshots
* asynchronous refresh scheduling
* strike-wise normalization
* DataFrame-native state representation

The architecture avoids API burst instability by introducing:

```text
staggered sequential synchronization
```

rather than parallel request flooding.

---

# 3. Feature Extraction Layer

## Microstructure Analytics

Implemented:

* bid-ask spread estimation
* liquidity imbalance
* microprice estimation
* execution-flow approximation
* latent fair-value drift

## Volatility Analytics

Implemented:

* ATM implied volatility
* skew topology
* surface gradients
* realized-volatility approximation
* convexity-sensitive volatility states

## Gamma Analytics

Implemented:

* strike-wise gamma exposure
* net GEX
* gamma-flip detection
* dealer-position approximation
* convexity imbalance estimation

---

# 4. Instability Engine

The instability engine constructs recursive streaming instability states.

The architecture models:

* liquidity-price divergence
* instability acceleration
* recursive stress propagation
* latent structural imbalance

The instability layer is maintained:

```text
per symbol
```

preventing cross-symbol contamination.

---

# 5. Snapshot Aggregation Layer

The system avoids persisting raw noisy instantaneous states.

Instead, it performs:

```text
recursive filtered aggregation
```

using:

* rolling buffers
* probabilistic filtering
* outlier suppression
* ecological smoothing

This creates:

* persistent probabilistic state histories
* stabilized market-state evolution
* reduced streaming noise

---

# 6. Persistent Ecological Storage

The infrastructure evolved from:

```text
session-based snapshots
```

into:

```text
persistent ecological histories
```

The system now maintains:

* append-only per-symbol CSV histories
* timestamped ecological persistence
* recursive Monte Carlo report accumulation
* bounded-memory chart overwriting

This infrastructure supports:

* long-memory calibration
* latent-state analysis
* ecological occupancy estimation
* adaptive probabilistic learning

---

# Probabilistic Ecological Monte Carlo Engine

## Overview

The simulation architecture evolved beyond classical geometric Brownian motion.

The engine now behaves as:

```text
recursive adaptive probabilistic ecology
```

rather than:

```text
independent stochastic diffusion
```

The simulator recursively evolves:

* metastable occupancy
* probabilistic regime migration
* participant reflexivity
* adaptive reconvergence
* convexity amplification
* entropy-aware transitions
* recursive ecological persistence

---

# Ecological Simulation Flow

```text
Observed Market State
        ↓
Latent Regime Detection
        ↓
Persistence Memory
        ↓
Transition Ecology
        ↓
Participant Reflexivity
        ↓
Convexity Amplification
        ↓
Adaptive Reconvergence
        ↓
Recursive Path Evolution
```

---

# Monte Carlo Subsystems

## persistence_engine.py

Models:

* regime duration memory
* transition resistance
* metastable persistence
* ecological stickiness

This prevents:

```text
memoryless hidden-state switching
```

and instead creates:

```text
adaptive probabilistic occupancy
```

---

## latent_pressure.py

Models:

* accumulated instability
* unresolved structural stress
* latent convexity pressure
* recursive stress propagation

This introduces:

* delayed instability release
* nonlinear volatility clustering
* recursive ecological stress memory

---

## state_transition_matrix.py

Implements:

* entropy-aware transition ecology
* probabilistic occupancy migration
* recursive regime blending
* metastable transition topology

Transition evolution depends on:

* persistence memory
* latent pressure
* convexity imbalance
* liquidity stabilization
* dealer ecology

---

## participant_response.py

Models adaptive participant behavior under evolving market conditions.

The participant layer captures:

* risk adaptation
* panic amplification
* hedging intensity
* liquidity contraction
* dealer stabilization
* reflexive ecological feedback

The system therefore evolves through:

```text
participant ecology
```

rather than:

```text
price-only stochastic evolution
```

---

## interaction_engine.py

Constructs nonlinear interactions between:

* liquidity
* convexity
* participant behavior
* instability propagation
* regime transitions

This introduces:

* recursive ecological coupling
* nonlinear amplification
* metastable interaction fields

---

## trajectory_dynamics.py

Implements recursive path evolution through:

* stochastic diffusion
* reflexive momentum
* ecological reconvergence
* adaptive drift
* latent-state migration
* convexity-sensitive shock propagation

The resulting trajectories behave like:

```text
bounded metastable ecological fields
```

rather than:

```text
classical independent random walks
```

---

# Adaptive Attractor Geometry

The simulator implements adaptive attractor geometry.

Trajectories evolve under:

* local instability
* recursive divergence
* liquidity stabilization
* adaptive ecological attraction

This introduces:

* metastable reconvergence
* recursive stabilization
* bounded occupancy divergence
* dynamic equilibrium migration

---

# Continuous Occupancy Migration

The simulation framework now supports:

```text
continuous occupancy migration
```

instead of:

```text
discrete regime jumps
```

Regime blending depends on:

* entropy topology
* latent ecological pressure
* transition occupancy
* convexity imbalance
* persistence dynamics

This significantly improves:

* regime continuity
* probabilistic realism
* metastable smoothness
* ecological trajectory continuity

---

# Convexity Amplification

Shock propagation is no longer independent Gaussian perturbation.

Instead, shocks recursively interact with:

* convexity imbalance
* gamma instability
* liquidity collapse
* participant panic
* dealer hedging stress

This creates:

* nonlinear downside amplification
* volatility expansion
* recursive shock ecology
* metastable instability propagation

---

# Adaptive Stochastic Ecological Systems

The project increasingly resembles:

```text
adaptive stochastic ecological simulation
```

rather than:

```text
traditional financial modeling
```

The architecture now includes:

* recursive latent-state systems
* adaptive occupancy evolution
* ecological attractor geometry
* participant reflexivity
* probabilistic migration
* entropy-aware metastability

---

# Current System Capabilities

The framework can now:

✅ ingest live ticks

✅ subscribe to multiple instruments simultaneously

✅ synchronize option-chain states

✅ compute market microstructure features

✅ estimate gamma exposure structures

✅ construct implied-volatility topology

✅ compute recursive instability metrics

✅ aggregate streaming probabilistic states

✅ persist ecological market histories

✅ simulate recursive latent-state evolution

✅ model participant reflexivity

✅ propagate convexity instability

✅ simulate entropy-aware transitions

✅ generate adaptive metastable trajectories

✅ model ecological reconvergence

✅ perform probabilistic occupancy migration

---

# Emerging Research Direction

The framework is evolving toward:

```text
Adaptive Probabilistic Market Ecology
```

with focus on:

* recursive market-state inference
* latent liquidity estimation
* metastable occupancy dynamics
* nonlinear ecological propagation
* probabilistic attractor systems
* adaptive hidden-state evolution

This shifts the framework away from:

```text
traditional forecasting
```

and toward:

```text
probabilistic market-state ecology
```

---

# Long-Term Vision

Transform the framework into:

```text
Recursive Probabilistic Market Intelligence System
```

capable of:

* online ecological inference
* adaptive hidden-state estimation
* recursive probabilistic simulation
* nonlinear instability propagation
* participant-behavior modeling
* stochastic attractor estimation
* ecological occupancy forecasting
* metastable market-state simulation

---

# Important Architectural Learnings

## Stateful Systems Require Isolation

All recursive engines must maintain:

```text
symbol → independent ecological state
```

Shared temporal engines corrupt probabilistic dynamics.

---

# Streaming Analytics Differ from Batch Analytics

Correct ordering matters.

The architecture follows:

```text
raw signals
    ↓
instability construction
    ↓
aggregation
    ↓
persistence
```

Aggregation before instability suppresses latent variance.

---

# Ecological Systems Require Long Memory

Recursive adaptive systems require:

* persistent histories
* latent-state continuity
* probabilistic occupancy memory
* adaptive ecological calibration

This motivated the transition toward:

```text
append-only ecological storage
```

---

# Current Development Status

The framework is currently:

* research-oriented
* experimental
* non-production
* under active development

The project may contain:

* modeling inaccuracies
* synchronization limitations
* probabilistic instability
* ecological overfitting
* incomplete validation

The system should NOT be used for:

* live trading
* production execution
* financial decision-making
* automated risk deployment

---

# Suggested Git Commit

```text
feat: implement recursive adaptive probabilistic ecological simulation framework
```

---

# Developer Notes

Developed through iterative quantitative research, systems engineering, probabilistic modeling, and recursive simulation experimentation.

The framework was designed to explore:

* hidden-state ecology
* adaptive stochastic systems
* market microstructure dynamics
* recursive probabilistic intelligence
* nonlinear market reflexivity

---

# Author

Pallav Nandi Chaudhuri

Research focus:

* market microstructure
* adaptive stochastic systems
* probabilistic market-state intelligence
* recursive ecological simulation
* convexity-aware latent-state modeling

## Overview

The  development published on 15th May 2026 focused on transforming the initial websocket ingestion prototype into a multi-symbol streaming quant analytics engine capable of:

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

