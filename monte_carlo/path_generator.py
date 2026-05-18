import numpy as np

from monte_carlo.historical_analyzer import (
    HistoricalAnalyzer
)

from monte_carlo.local_regime import (
    LocalRegimeDetector
)

from monte_carlo.trajectory_dynamics import (
    TrajectoryDynamics
)

from monte_carlo.interaction_engine import (
    InteractionEngine
)

from monte_carlo.probabilistic_walk import (
    ProbabilisticWalk
)

from monte_carlo.persistence_engine import (
    PersistenceEngine
)

from monte_carlo.latent_pressure import (
    LatentPressureEngine
)

from monte_carlo.state_transition_matrix import (
    StateTransitionMatrix
)

from monte_carlo.participant_response import (
    ParticipantResponse
)

class PathGenerator:

    def __init__(
        self,
        process,
        impact_model,
        dt_model,
        scaler,
        window_size=200
    ):

        self.process = process
        self.impact = impact_model
        self.dt_model = dt_model
        self.scaler = scaler

        self.window_size = window_size

        # ==========================================
        # Stateless Engines
        # ==========================================
        self.history_analyzer = HistoricalAnalyzer()

        self.local_regime = LocalRegimeDetector()

        self.trajectory_dynamics = TrajectoryDynamics()

        self.interaction_engine = InteractionEngine()

        self.probabilistic_walk = ProbabilisticWalk()

        self.state_transition_matrix = (
            StateTransitionMatrix()
        )

        self.participant_response = (
            ParticipantResponse()
        )

    # =====================================================
    # MAIN PATH GENERATION
    # =====================================================
    def generate(
        self,
        X0,
        S0,
        steps,
        gamma_flip
    ):

        # ==========================================
        # PATH-LOCAL STATEFUL ENGINES
        # ==========================================
        persistence_engine = PersistenceEngine()

        latent_pressure_engine = LatentPressureEngine()

        participant_response_engine = (
            ParticipantResponse()
        )

        # ==========================================
        # Initial State
        # ==========================================
        X = X0.copy()

        S = float(S0)

        anchor = float(S0)

        path = np.zeros(steps)

        dt_path = np.zeros(steps)

        history_buffer = []
        # ==========================================
        # Trend Persistence Memory
        # ==========================================
        trend_persistence = 0.0
        # ==========================================
        # Previous Transition Memory
        # ==========================================
        previous_transition_state = {

            "transition_entropy": 0.5,

            "next_regime": "neutral",

            "transition_probabilities": {}
        }

        # ==========================================
        # Convexity Stress Memory
        # ==========================================
        convexity_stress = 0.0

        # ==========================================
        # Dealer Stabilization Memory
        # ==========================================
        dealer_memory = 0.5
        # ==========================================
        # Ecological Equilibrium
        # ==========================================
        equilibrium_price = float(S0)

        # ==========================================
        # Regime Interpolation Memory
        # ==========================================
        blended_regime = "neutral"

        regime_blend_alpha = 0.0

        # ==========================================
        # Diagnostics
        # ==========================================
        large_return_count = 0

        shock_count = 0

        regime_flip_count = 0

        previous_regime = None

        # =================================================
        # MAIN LOOP
        # =================================================
        for i in range(steps):

            # =================================================
            # 1. Time Step
            # =================================================
            dt = self.dt_model.sample()

            dt = np.clip(dt, 0.01, 5.0)

            # =================================================
            # 2. Feature Evolution
            # =================================================
            X = self.process.step(X, dt)

            X = np.nan_to_num(
                X,
                nan=0.0,
                posinf=0.0,
                neginf=0.0
            )

            # =================================================
            # 3. Historical Buffer
            # =================================================
            history_buffer.append(X.copy())

            if len(history_buffer) > self.window_size:
                history_buffer.pop(0)

            history_matrix = np.array(history_buffer)

            # =================================================
            # 4. Historical Analysis
            # =================================================
            history_state = (
                self.history_analyzer.analyze(
                    history_matrix
                )
            )

            # =================================================
            # 5. Current State
            # =================================================
            current_state = {

                "imbalance":
                    X[0] if len(X) > 0 else 0.0,

                "spread":
                    abs(X[1]) if len(X) > 1 else 0.0,

                "IV":
                    abs(X[2]) if len(X) > 2 else 0.0,

                "HV":
                    abs(X[3]) if len(X) > 3 else 0.0,

                "netGEX":
                    X[4] if len(X) > 4 else 0.0,

                "flow":
                    X[5] if len(X) > 5 else 0.0,

                "distance_to_flip":
                    abs(S - gamma_flip)
                    / max(gamma_flip, 1e-6)
            }

            # =================================================
            # 6. Distance Metrics
            # =================================================
            distance_factor = (
                abs(S - anchor)
                / max(anchor, 1e-6)
            )

            # =================================================
            # 7. Regime Detection
            # =================================================
            regime_state = (
                self.local_regime.detect(
                    history_state,
                    current_state
                )
            )

            detected_regime = (
                regime_state["regime"]
            )

            # regime flip tracking
            if previous_regime is not None:

                if detected_regime != previous_regime:
                    regime_flip_count += 1

            previous_regime = detected_regime

            # =================================================
            # 8. Adaptive Dynamics
            # =================================================
            dynamics_state = (
                self.trajectory_dynamics.compute(
                    history_state,
                    regime_state,
                    current_state
                )
            )

            adaptive_drift = (
                dynamics_state["drift"]
            )

            adaptive_volatility = (
                dynamics_state["volatility"]
            )

            adaptive_momentum = (
                dynamics_state["momentum"]
            )

            adaptive_shock_prob = (
                dynamics_state["shock_probability"]
            )

            stability_strength = (
                dynamics_state["stability_strength"]
            )

            # =================================================
            # 9. Interaction Engine
            # =================================================
            interaction_state = (
                self.interaction_engine.evaluate(
                    history_state,
                    regime_state,
                    current_state
                )
            )

            drift_multiplier = (
                interaction_state["drift_multiplier"]
            )

            volatility_multiplier = (
                interaction_state[
                    "volatility_multiplier"
                ]
            )

            momentum_multiplier = (
                interaction_state[
                    "momentum_multiplier"
                ]
            )

            shock_multiplier = (
                interaction_state[
                    "shock_multiplier"
                ]
            )

            stability_multiplier = (
                interaction_state[
                    "stability_multiplier"
                ]
            )

            interaction_labels = (
                interaction_state[
                    "interaction_labels"
                ]
            )

            # =================================================
            # 10. Persistence Engine
            # =================================================
            persistence_state = (
                persistence_engine.update(
                    regime_state,
                    interaction_state,
                    history_state
                )
            )

            # =================================================
            # 11. Latent Pressure
            # =================================================
            latent_pressure_state = (
                latent_pressure_engine.update(
                    history_state,
                    regime_state,
                    interaction_state,
                    persistence_state,
                    current_state
                )
            )
            latent_pressure = (
                latent_pressure_state[
                    "latent_pressure"
                ]
            )
            # =================================================
            # PARTICIPANT RESPONSE
            # =================================================

            participant_state = (
                participant_response_engine.evaluate(
                    current_state,
                    regime_state,
                    interaction_state,
                    latent_pressure_state,
                    persistence_state,
                    previous_transition_state
                )
            )
            risk_appetite = (
                participant_state[
                    "risk_appetite"
                ]
            )

            panic_level = (
                participant_state[
                    "panic_level"
                ]
            )

            trend_following = (
                participant_state[
                    "trend_following"
                ]
            )

            liquidity_support = (
                participant_state[
                    "liquidity_support"
                ]
            )

            hedging_pressure = (
                participant_state[
                    "hedging_pressure"
                ]
            )

            dealer_stabilization = (
                participant_state[
                    "dealer_stabilization"
                ]
            )
            # ==========================================
            # Dealer Stabilization Memory
            # ==========================================

            dealer_memory = (

                    0.90 * dealer_memory

                    +

                    0.10 * dealer_stabilization

            )

            dealer_memory = np.clip(
                dealer_memory,
                0.0,
                1.5
            )
            # ==========================================
            # Adaptive Equilibrium Update
            # ==========================================

            equilibrium_price = (

                    0.97 * equilibrium_price

                    +

                    0.03 * S

            )

            reflexivity_index = (
                participant_state[
                    "reflexivity_index"
                ]
            )


            behavioral_regime = (
                participant_state[
                    "behavioral_regime"
                ]
            )

            # =================================================
            # STATE TRANSITION MATRIX
            # =================================================

            transition_state = (
                self.state_transition_matrix.compute(
                    regime_state,
                    persistence_state,
                    latent_pressure_state,
                    interaction_state,
                    participant_state
                )
            )
            previous_transition_state = transition_state

            next_regime = (
                transition_state[
                    "next_regime"
                ]
            )

            transition_entropy = (
                transition_state[
                    "transition_entropy"
                ]
            )
            transition_probabilities = (
                transition_state[
                    "transition_probabilities"
                ]
            )
            # ==========================================
            # Ecological Reconvergence
            # ==========================================

            reconvergence_strength = (

                    0.02

                    +

                    0.08 *

                    dealer_memory

            )

            reconvergence_strength *= (

                    1

                    -

                    0.50 * transition_entropy
            )

            reconvergence_strength *= (

                    1

                    -

                    0.30 * convexity_stress
            )

            reconvergence_strength = np.clip(
                reconvergence_strength,
                0.005,
                0.12
            )
            # ==========================================
            # Regime Blend Strength
            # ==========================================


            max_transition_prob = max(
                transition_probabilities.values()
            )

            regime_blend_alpha = (

                    0.12 * transition_entropy

                    +

                    0.10 * latent_pressure

                    +

                    0.18 * (
                            1 - max_transition_prob
                    )

            )

            regime_blend_alpha = np.clip(
                regime_blend_alpha,
                0.01,
                0.12
            )
            # ==========================================
            # Regime Migration
            # ==========================================

            if np.random.rand() < regime_blend_alpha:
                blended_regime = next_regime




            # ==========================================
            # Convexity Stress Update
            # ==========================================

            convexity_input = (

                    hedging_pressure

                    *

                    (
                            1 +
                            panic_level
                    )

            )

            convexity_stress = (

                    0.94 * convexity_stress

                    +

                    0.06 * convexity_input

            )

            convexity_stress = np.clip(
                convexity_stress,
                0.0,
                3.0
            )
            # =================================================
            # Reflexive Trend Persistence Memory
            # =================================================

            trend_persistence = (

                    0.92 * trend_persistence

                    +

                    0.08 * reflexivity_index

            )

            trend_persistence = np.clip(
                trend_persistence,
                0.0,
                2.0
            )

            # =================================================
            # 12. Scale Features
            # =================================================
            X_scaled = (
                self.scaler.transform(
                    X.reshape(1, -1)
                )[0]
            )

            # =================================================
            # 13. Base Return Prediction
            # =================================================
            ret = self.impact.predict(X_scaled)

            ret = float(np.squeeze(ret))

            if not np.isfinite(ret):
                ret = 0.0

            # =================================================
            # 14. Probabilistic Walk
            # =================================================
            walk_state = (
                self.probabilistic_walk.generate_return(
                    base_return=ret,
                    dynamics_state=dynamics_state,
                    interaction_state=interaction_state,
                    regime_state=regime_state,
                    distance_factor=distance_factor
                )
            )

            candidate_return = (
                walk_state["return"]
            )

            walk_components = (
                walk_state["components"]
            )

            # =================================================
            # 15. Return Blending
            # =================================================
            ret = (
                0.9 * ret
                +
                0.1 * candidate_return
            )

            ret += (
                0.1 *
                history_state["drift_bias"]
            )

            # =================================================
            # 16. Volatility Construction
            # =================================================

            vol = (
                    adaptive_volatility *
                    np.sqrt(
                        volatility_multiplier
                    )
            )

            # -----------------------------------------
            # Regime-Based Scaling
            # -----------------------------------------
            if blended_regime in  [
                "stable",
                "mean_reverting"
            ]:

                vol *= 0.7


            elif blended_regime in  [
                "reflexive_instability",
                "gamma_squeeze",
                "volatility_expansion"
            ]:

                vol *= 1.5

            # -----------------------------------------
            # Participant Panic Coupling
            # -----------------------------------------
            vol *= (
                    1 +
                    0.25 * panic_level
            )

            # -----------------------------------------
            # Liquidity Dampening
            # -----------------------------------------
            vol /= (
                    1 +
                    0.20 * liquidity_support
            )

            # -----------------------------------------
            # Entropy Amplification
            # -----------------------------------------
            vol *= (
                    1 +
                    0.15 * transition_entropy
            )

            # -----------------------------------------
            # Numerical Safety
            # -----------------------------------------
            vol = np.clip(
                vol,
                0.0005,
                0.03
            )

            # =================================================
            # 17. Return Clipping
            # =================================================

            ret = np.clip(
                ret,
                -3 * vol,
                3 * vol
            )

            # =================================================
            # 18. Momentum Injection
            # =================================================

            momentum_strength = (

                    adaptive_momentum *

                    momentum_multiplier *

                    np.exp(
                        -5 * distance_factor
                    )
            )
            # -----------------------------------------
            # Trend Persistence Coupling
            # -----------------------------------------
            momentum_strength *= (

                    1 +

                    0.15 *
                    trend_persistence

            )
            # -----------------------------------------
            # Momentum Fatigue
            # -----------------------------------------
            momentum_fatigue = np.tanh(
                abs(S - anchor)
                / max(anchor, 1e-6)
            )

            momentum_strength *= (
                    1 -
                    0.25 * momentum_fatigue
            )



            # -----------------------------------------
            # Panic Suppression
            # -----------------------------------------
            momentum_strength *= (

                    1 /

                    (
                            1 +
                            0.20 * panic_level
                    )
            )

            # -----------------------------------------
            # Final Momentum Injection
            # -----------------------------------------
            ret += (

                    0.10 *

                    momentum_strength *

                    ret
            )

            # =================================================
            # 19. Stability Force
            # =================================================

            stability_force = (

                    -stability_strength *

                    stability_multiplier *

                    np.tanh(

                        (
                                S - anchor
                        )

                        /

                        max(anchor, 1e-6)
                    )
            )

            # -----------------------------------------
            # Dealer Stabilization
            # -----------------------------------------
            stability_force *= (

                    1 +

                    0.30 *
                    dealer_memory
            )

            # -----------------------------------------
            # Liquidity Reinforcement
            # -----------------------------------------
            stability_force *= (

                    1 +

                    0.15 *
                    liquidity_support
            )

            # -----------------------------------------
            # Apply Stability
            # -----------------------------------------
            ret += stability_force
            # ==========================================
            # Ecological Reconvergence Force
            # ==========================================

            price_dislocation = (
                    S -
                    equilibrium_price
            )

            reconvergence_force = (

                    reconvergence_strength

                    *

                    price_dislocation

                    /

                    equilibrium_price
            )

            ret -= reconvergence_force

            # =================================================
            # 20. Shock Model
            # =================================================

            shock_prob = (

                    adaptive_shock_prob *

                    shock_multiplier *

                    np.exp(
                        -2 * distance_factor
                    )
            )

            # -----------------------------------------
            # Convexity Shock Amplification
            # -----------------------------------------
            shock_prob *= (

                    1 +

                    0.12 *
                    convexity_stress

            )
            # -----------------------------------------
            # Shock Clustering
            # -----------------------------------------
            shock_prob *= (

                    1 +

                    0.10 *
                    latent_pressure

            )

            # -----------------------------------------
            # Panic Amplification
            # -----------------------------------------
            shock_prob *= (

                    1 +

                    0.25 *
                    panic_level
            )

            # -----------------------------------------
            # Entropy Amplification
            # -----------------------------------------
            shock_prob *= (

                    1 +

                    0.15 *
                    transition_entropy
            )

            # -----------------------------------------
            # Numerical Safety
            # -----------------------------------------
            shock_prob = np.clip(
                shock_prob,
                0.0001,
                0.08
            )

            # -----------------------------------------
            # Shock Event
            # -----------------------------------------
            if np.random.rand() < shock_prob:
                shock_count += 1

                shock_scale = (

                        vol *

                        np.sqrt(
                            volatility_multiplier
                        ) *

                        (
                                1 +
                                0.30 * reflexivity_index
                        )
                )
                # -----------------------------------------
                # Convexity Tail Widening
                # -----------------------------------------
                shock_scale *= (

                        1 +

                        0.15 *
                        convexity_stress

                )

                shock = np.random.normal(
                    0,
                    shock_scale
                )


                # -------------------------------------
                # Shock Clipping
                # -------------------------------------
                shock = np.clip(
                    shock,
                    -4 * vol,
                    4 * vol
                )

                ret += shock

                # =================================================
                # 21. Final Safety Layer
                # =================================================
                ret = np.clip(
                    ret,
                    -0.02,
                    0.02
                )
                # -----------------------------------------
                # Downside Convexity Bias
                # -----------------------------------------
                if current_state["netGEX"]  < 0:
                    shock -= (
                            abs(shock)
                            *
                            0.10 *
                            convexity_stress
                    )

                if not np.isfinite(ret):
                    ret = 0.0

            # =================================================
            # 22. Adaptive Anchor
            # =================================================
            anchor = (
                0.995 * anchor
                +
                0.005 * S
            )

            # =================================================
            # 23. Log-Price Update
            # =================================================
            S = S * np.exp(ret)

            S = np.clip(
                S,
                1e-3,
                1e6
            )

            # =================================================
            # 24. Save Path
            # =================================================
            path[i] = S

            dt_path[i] = dt

            # =================================================
            # 25. Diagnostics
            # =================================================
            if abs(ret) > 0.01:
                large_return_count += 1

            # =================================================
            # 26. Debug Output
            # =================================================
            if i % 100 == 0:

                print()

                print(f"[Step {i}]")

                print(
                    f"Regime={detected_regime} "
                    f"Score={regime_state['score']:.2f}"
                )

                print(
                    f"Adaptive Drift="
                    f"{adaptive_drift:.6f} "
                    f"Adaptive Vol="
                    f"{adaptive_volatility:.6f}"
                )

                print(
                    f"Interactions="
                    f"{interaction_labels}"
                )

                print(
                    f"Candidate Return="
                    f"{candidate_return:.6f}"
                )

                print(
                    f"Persistence="
                    f"{persistence_state['persistence_score']:.3f}"
                )

                print(
                    f"Latent Pressure="
                    f"{latent_pressure_state['latent_pressure']:.3f}"
                )
                print(
                    f"Transition -> "
                    f"Next={next_regime} "
                    f"Entropy={transition_entropy:.3f}"
                )
                print(
                    f"TrendPersistence="
                    f"{trend_persistence:.3f}"
                )
                print(
                    f"ConvexityStress="
                    f"{convexity_stress:.3f}"
                )

                top_transitions = sorted(

                    transition_probabilities.items(),

                    key=lambda x: x[1],

                    reverse=True

                )[:3]

                print(
                    f"Top Transition Probs="
                    f"{top_transitions}"
                )
                print(
                    f"Behavior -> "
                    f"Risk={risk_appetite:.3f} "
                    f"Panic={panic_level:.3f}"
                )
                print(
                    f"Trend={trend_following:.3f} "
                    f"Liquidity={liquidity_support:.3f}"
                )
                print(
                    f"Hedging={hedging_pressure:.3f} "
                    f"Dealer={dealer_stabilization:.3f}"
                )
                print(
                    f"Reflexivity="
                    f"{reflexivity_index:.3f} "
                    f"BehavioralRegime="
                    f"{behavioral_regime}"
                )
                print(
                    f"DealerMemory="
                    f"{dealer_memory:.3f}"
                )
                print(
                    f"Reconvergence="
                    f"{reconvergence_force:.6f} "
                    f"Equilibrium="
                    f"{equilibrium_price:.2f}"
                )
                print(
                    f"BlendAlpha="
                    f"{regime_blend_alpha:.3f} "
                    f"BlendedRegime="
                    f"{blended_regime}"
                )

        # =====================================================
        # FINAL DIAGNOSTICS
        # =====================================================
        print("\n=== PATH DIAGNOSTICS ===")

        print(
            f"Large Return Frequency: "
            f"{large_return_count / steps:.4f}"
        )

        print(
            f"Regime Flip Frequency: "
            f"{regime_flip_count / steps:.4f}"
        )

        print(
            f"Shock Frequency: "
            f"{shock_count / steps:.4f}"
        )

        return path, dt_path

    # =====================================================
    # Initial Regime
    # =====================================================
    def _get_regime(self, X):

        netGEX = (
            X[2]
            if len(X) > 2 else 0
        )

        if netGEX > 0:
            return "long_gamma"

        return "short_gamma"

    # =====================================================
    # Flip Probability
    # =====================================================
    def _flip_probability(
        self,
        S,
        flip,
        scale=50
    ):

        distance = abs(S - flip)

        prob = np.exp(
            -distance / scale
        )

        return np.clip(
            prob,
            0.0,
            1.0
        )