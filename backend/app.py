from flask import Flask, jsonify
from flask import request, abort
import firebase_admin
from firebase_admin import credentials, db, auth
import pandas as pd
from flask_cors import CORS
import numpy as np
import os

ALLOWED_USERS = [
    "pallavagt@gmail.com",
    "kncsolns@gmail.com"
]

cred = credentials.Certificate("breeze-credentials-firebase-adminsdk-u0aro-a51f03c53f.json")

firebase_admin.initialize_app(
    cred,
    {"databaseURL": 'https://breeze-credentials-default-rtdb.firebaseio.com/'}
)

auth_app = firebase_admin.initialize_app(
    credentials.Certificate("dhelm-vol-regime-dashboard-firebase-adminsdk-fbsvc-0ed653c644.json"),
    name="authApp"
)


def verify_token():
    header = request.headers.get("Authorization")

    if not header:
        abort(401)

    token = header.split(" ")[1]

    decoded = auth.verify_id_token(token, app=auth_app)
    print("Authenticated user:", decoded["email"])

    if decoded["email"] not in ALLOWED_USERS:
        abort(403)

    return decoded


# root_ref = db.reference("vol-regime-metrics-cleaned")

app = Flask(__name__)
CORS(app, supports_credentials=True)


def get_root():
    dbname = request.args.get("db", "cleaned")

    if dbname == "raw":
        return db.reference("vol-regime-metrics")

    return db.reference("vol-regime-metrics-cleaned")


@app.route("/")
def home():
    return {"status": "Volatility API running"}


@app.route("/api/stocks")
def stocks():
    user = verify_token()
    root_ref = get_root()
    data = root_ref.get()

    if not data:
        return jsonify([])

    return jsonify(list(data.keys()))


@app.route("/api/instability-map")
def instability_map():
    user = verify_token()
    root_ref = get_root()
    data = root_ref.get()

    results = []

    for symbol in data:

        metrics = data[symbol]["metrics"]

        df = pd.DataFrame(metrics).T
        df = df.sort_index()

        row = df.iloc[-1]

        spot = row.get("spot")
        gamma_zones = row.get("gamma_zones", {})

        flip = gamma_zones.get("gamma_flip")

        I1 = row.get("linear_instability_I1")
        I2 = row.get("convexity_instability_I2")

        amp = row.get("amplification_factor")

        if spot and flip:
            distance = (spot - flip) / flip * 100

            results.append({

                "symbol": symbol,
                "distance": distance,
                "I1": I1,
                "I2": I2,
                "amp": amp

            })

    return jsonify(results)


@app.route("/api/flipzone")
def flipzone():
    user = verify_token()
    root_ref = get_root()
    data = root_ref.get()

    results = []

    for symbol in data:

        metrics = data[symbol]["metrics"]

        df = pd.DataFrame(metrics).T
        df = df.sort_index()

        row = df.iloc[-1]

        spot = row.get("spot")
        gamma_zones = row.get("gamma_zones", {})

        flip = gamma_zones.get("gamma_flip")

        if spot and flip:

            distance = (spot - flip) / flip * 100

            if abs(distance) <= 2:
                results.append({

                    "symbol": symbol,
                    "distance": distance

                })

    return jsonify(results)


@app.route("/api/gamma-explosion")
def gamma_explosion():
    user = verify_token()
    root_ref = get_root()
    data = root_ref.get()

    results = []

    for symbol in data:

        symbol_data = data.get(symbol, {})
        metrics = symbol_data.get("metrics")

        if not metrics:
            continue

        df = pd.DataFrame(metrics).T
        df = df.sort_index()

        row = df.iloc[-1]

        spot = row.get("spot")
        gamma_zones = row.get("gamma_zones", {})
        flip = gamma_zones.get("gamma_flip")

        chain = row.get("option_chain")

        if not spot or not flip or not chain:
            continue

        # distance from flip
        distance = (spot - flip) / flip * 100

        # keep only ±2%
        if abs(distance) > 2:
            continue

        strikes = []
        gex = []

        for r in chain:
            if r.get("net_gex") is not None:
                strikes.append(r["strike"])
                gex.append(r["net_gex"])

        if len(gex) < 3:
            continue

        gradient = np.gradient(gex)

        explosion_score = float(np.max(gradient ** 2))

        results.append({

            "symbol": symbol,
            "distance": distance,
            "gamma_explosion_score": explosion_score

        })

    # sort by explosion score
    results = sorted(
        results,
        key=lambda x: x["gamma_explosion_score"],
        reverse=True
    )

    return jsonify(results)


@app.route("/api/convexity-radar")
def convexity_radar():
    user = verify_token()
    root_ref = get_root()
    data = root_ref.get()

    results = []

    for symbol in data:

        try:

            metrics = data[symbol]["metrics"]

            df = pd.DataFrame(metrics).T
            df = df.sort_index()

            row = df.iloc[-1]

            spot = row.get("spot")
            gamma_zones = row.get("gamma_zones", {})
            flip = gamma_zones.get("gamma_flip")

            chain = row.get("option_chain")

            if not chain:
                continue

            gamma_instability = 0
            vanna_pressure = 0
            dealer_flow = 0

            gex = [o["net_gex"] for o in chain if o.get("net_gex")]

            # ---- Gamma Instability (2nd derivative) ----
            for i in range(1, len(gex) - 1):
                gamma_instability += abs(
                    gex[i + 1] - 2 * gex[i] + gex[i - 1]
                )

            # ---- Vanna Pressure ----
            for o in chain:
                net_oi = (
                        (o.get("call_oi", 0)) -
                        (o.get("put_oi", 0))
                )

                delta = abs(o.get("call_delta", 0))

                vanna = (o.get("vega", 0)) * (1 - delta)

                vanna_pressure += abs(vanna * net_oi)

                dealer_flow += abs(o.get("net_gex", 0))

            # ---- Flip Distance ----
            if spot and flip:
                flip_distance = abs(spot - flip) / spot
            else:
                flip_distance = 1

            results.append({

                "symbol": symbol,

                "gamma_instability": min(gamma_instability / 1e9, 1),

                "vanna_pressure": min(vanna_pressure / 1e8, 1),

                "dealer_flow": min(dealer_flow / 1e9, 1),

                "flip_distance": min(flip_distance * 5, 1),

                "shock_speed": 0.5

            })

        except Exception as e:

            print("Radar error:", symbol, e)

    return jsonify(results)


def json_safe(df):
    """
    Convert pandas dataframe to JSON-safe format
    """
    df = df.replace([np.inf, -np.inf], None)
    df = df.where(pd.notnull(df), None)
    return df


def sanitize_for_json(obj):
    """
    Recursively replace NaN/Inf with None
    """

    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}

    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]

    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None

    return obj


def clean_option_chain(chain):
    if not chain:
        return []

    cleaned = []

    for row in chain:

        new_row = {}

        for k, v in row.items():

            if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                new_row[k] = None
            else:
                new_row[k] = v

        cleaned.append(new_row)

    return cleaned


@app.route("/api/dashboard/<symbol>")
def dashboard(symbol):
    user = verify_token()
    root_ref = get_root()
    ref = root_ref.child(symbol).child("metrics")

    data = ref.get()

    if not data:
        return jsonify({})

    df = pd.DataFrame(data).T

    # Convert epoch → UTC datetime
    df.index = pd.to_datetime(df.index.astype(int), unit="s", utc=True)

    # Convert UTC → IST
    df.index = df.index.tz_convert("Asia/Kolkata")

    df = df.sort_index()

    print(df.index[:3])
    df = json_safe(df)

    if "gamma_zones" in df.columns:
        df["gamma_flip"] = df["gamma_zones"].apply(
            lambda x: x.get("gamma_flip") if isinstance(x, dict) else None
        )

    option_chain = None

    if "option_chain" in df.columns:
        option_chain = df.iloc[-1]["option_chain"]
    if option_chain:
        for row in option_chain:
            for k, v in row.items():
                if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                    row[k] = None

    option_chain_history = []

    for chain in df["option_chain"]:
        option_chain_history.append(chain)

    response = {

        "time": [t.strftime("%Y-%m-%d %H:%M:%S") for t in df.index],

        "spot": df["spot"].tolist(),
        "iv": df["iv"].tolist(),
        "hv": df["hv"].tolist(),

        "gamma_flip": df["gamma_flip"].tolist(),

        "k": df["impact_coefficient_k"].tolist(),
        "bpr": df["bifurcation_proximity_ratio"].tolist(),

        "I1": df["linear_instability_I1"].tolist(),
        "I2": df["convexity_instability_I2"].tolist(),

        "amplification": df["amplification_factor"].tolist(),
        "fragility": df["fragility_score"].tolist(),

        "option_chain": option_chain or [],

        "option_chain_history": option_chain_history or []
    }
    if "gex_gradient" in df.columns:
        response["gex_gradient"] = df["gex_gradient"].tolist()

    response = sanitize_for_json(response)
    print(response)

    return jsonify(response)

@app.route("/api/latest/<stock_id>", methods=["GET"])
def get_latest_snapshot(stock_id):
    user = verify_token()

    try:
        ref = db.reference(f"vol-regime-states/{stock_id}/states")
        data = ref.get()

        if not data:
            return jsonify({"error": "No data found"}), 404

        # ✅ Sort timestamps
        sorted_ts = sorted(data.keys())

        # ✅ Take last 20
        last_20_ts = sorted_ts[-20:]

        # ✅ Build ordered snapshot list
        snapshots = [
            {
                "timestamp": ts,
                "data": data[ts]
            }
            for ts in last_20_ts
        ]

        return jsonify({
            "stock_id": stock_id,
            "count": len(snapshots),
            "data": snapshots   # ✅ LIST instead of single object
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/test")
def test():
    user = verify_token()
    return jsonify({"status": "ok"})


import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

# if __name__ == "__main__":
#     app.run(
#         host="127.0.0.1",
#         port=5000,
#         debug=True
#     )
