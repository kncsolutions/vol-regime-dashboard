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
