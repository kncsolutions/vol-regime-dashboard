from flask import Flask, jsonify
from flask import request, abort
import firebase_admin
from firebase_admin import credentials, db, auth
import pandas as pd
from flask_cors import CORS
import numpy as np
from pymongo import MongoClient
import json
from dhan_data_extractor import DhanClient

import requests
import os

ALLOWED_USERS = [
    "pallavagt@gmail.com",
    "kncsolns@gmail.com"
]

cred = credentials.Certificate("dhelm-vol-regime-db-firebase-adminsdk-fbsvc-90b75e3a22.json")
FIREBASE_DB_URL = 'https://dhelm-vol-regime-db-default-rtdb.firebaseio.com/'

firebase_admin.initialize_app(
    cred,
    {"databaseURL": 'https://dhelm-vol-regime-db-default-rtdb.firebaseio.com/'}
)

auth_app = firebase_admin.initialize_app(
    credentials.Certificate("dhelm-vol-regime-dashboard-firebase-adminsdk-fbsvc-0ed653c644.json"),
    name="authApp"
)
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "dhanconfig.json")

with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)
DHAN_TOKEN = CONFIG["auth"]["token"]
print(DHAN_TOKEN)
DHAN_CLIENT_ID = CONFIG["auth"]["client_id"]
print(DHAN_CLIENT_ID)
dhan = DhanClient(DHAN_TOKEN, DHAN_CLIENT_ID)

MONGO_URI = "mongodb://localhost:27017"
mongo_client = MongoClient(MONGO_URI)

mongo_db = mongo_client["volatility_db"]

metrics_collection = mongo_db["vol_regime_metrics"]  # ✅
metrics_cleaned_collection = mongo_db["vol_regime_metrics_cleaned"]  # ✅
states_collection = mongo_db["vol_regime_states"]  # ⚠️ only if exists, else remove

latest_collection = mongo_db["latest_vol_regime_metrics"]  # ✅
flipzone_collection = mongo_db["flipzone_latest"]  # ✅
stocks_collection = mongo_db["stocks_list"]  # ✅

DATABASE_DIR = "database"

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


IS_PROD = os.environ.get("ENV") == "prod"
# IS_PROD = False
def get_db_type():
    db = request.args.get("source", "localdb")
    print(db)

    if IS_PROD and db != "localdb":
        return "localdb"

    return db


def get_root():
    dbname = request.args.get("db", "cleaned")

    if dbname == "raw":
        return db.reference("vol-regime-metrics")

    return db.reference("vol-regime-metrics-cleaned")

def get_mongo_root():
    dbname = request.args.get("db", "cleaned")

    if dbname == "raw":
        return metrics_collection

    return metrics_cleaned_collection


@app.route("/")
def home():
    return {"status": "Volatility API running"}


@app.route("/api/stocks")
def stocks():
    verify_token()
    db_type = get_db_type()

    if db_type == "mongo":
        try:
            cursor = stocks_collection.find({}, {"_id": 1})

            symbols = [d["_id"] for d in cursor]
            print('debugging..')
            print('symbols', jsonify(symbols))

            return jsonify(symbols)

        except Exception as e:
            print("Stocks error:", e)
            return jsonify({"error": str(e)}), 500

    elif db_type == "localdb":
        try:
            file_path = os.path.join(DATABASE_DIR, f"{stocks_collection.name}.json")

            if not os.path.exists(file_path):
                return jsonify({"error": f"{file_path} not found"}), 404

            with open(file_path, "r") as f:
                data = json.load(f)

            # Extract _id values like Mongo
            symbols = [doc["_id"] for doc in data if "_id" in doc]

            print('debugging (localdb)..')
            print('symbols', symbols)

            return jsonify(symbols)

        except Exception as e:
            print("LocalDB Stocks error:", e)
            return jsonify({"error": str(e)}), 500

    else:
        data = db.reference().child("stocks-list").get()
        print('data fb', data)
        return jsonify(list(data.keys()) if data else [])


@app.route("/api/instability-map")
def instability_map():
    verify_token()
    db_type = get_db_type()

    try:
        # -------------------------
        # 🔥 FETCH DATA
        # -------------------------
        if db_type == "mongo":

            cursor = latest_collection.find({})

            data = {}

            for d in cursor:
                symbol = str(d.get("_id"))
                row = d

                if not symbol or not row:
                    continue

                data[symbol] = row

            print("mongo count:", len(data))

        elif db_type == "localdb":

            try:
                file_path = os.path.join(DATABASE_DIR, f"{latest_collection.name}.json")

                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"{file_path} not found")

                with open(file_path, "r") as f:
                    documents = json.load(f)

                data = {}

                for d in documents:
                    symbol = str(d.get("_id"))
                    row = d

                    if not symbol or not row:
                        continue

                    data[symbol] = row

                print("localdb count:", len(data))

            except Exception as e:
                print("LocalDB error:", e)
                return jsonify({"error": str(e)}), 500

        else:
            data = db.reference("latest-vol-regime-metrics").get()
            print("firebase count:", len(data) if data else 0)

        # -------------------------
        # 🛑 SAFETY CHECK
        # -------------------------
        if not isinstance(data, dict):
            return jsonify([])

        # -------------------------
        # 🔥 COMPUTE RESULTS
        # -------------------------
        results = []

        for symbol, row in data.items():
            try:
                spot = row.get("spot")

                # ✅ FIXED flip extraction
                flip = row.get("gamma_flip") or (row.get("gamma_zones") or {}).get("gamma_flip")

                if spot is None or flip is None or flip == 0:
                    continue

                results.append({
                    "symbol": symbol,
                    "distance": (spot - flip) / flip * 100,
                    "I1": row.get("linear_instability_I1"),
                    "I2": row.get("convexity_instability_I2"),
                    "amp": row.get("amplification_factor")
                })

            except Exception as e:
                print("Row error:", symbol, e)

        # print("final results:", len(results))

        return jsonify(results)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/flipzone")
def flipzone():
    verify_token()
    db_type = get_db_type()

    try:
        if db_type == "mongo":

            cursor = latest_collection.find({}, {
                "_id": 1,
                "spot": 1,
                "gamma_flip": 1,
                "call_wall": 1,
                "put_wall": 1,
                "gex_gradient": 1,
                "iv": 1,
                "hv": 1,
                "timestamp": 1
            })

            results = []

            for d in cursor:
                symbol = d.get("_id")

                if not symbol:
                    continue

                # --- SAFE EXTRACTION ---
                spot = d.get("spot")
                gamma_flip = d.get("gamma_flip")
                gex_gradient = d.get("gex_gradient")
                iv = d.get("iv")
                hv = d.get("hv")

                try:
                    spot = float(spot) if spot is not None else None
                    gamma_flip = float(gamma_flip) if gamma_flip is not None else None
                    gex_gradient = float(gex_gradient) if gex_gradient is not None else None
                    iv = float(iv) if iv is not None else None
                    hv = float(hv) if hv is not None else None
                except:
                    continue

                # --- DISTANCE ---
                distance = None
                distance_pct = None

                if spot is not None and gamma_flip is not None and spot != 0:
                    distance = spot - gamma_flip
                    distance_pct = (distance) / spot

                # 🚨 FILTER: ONLY WITHIN 2%
                if distance_pct is None or abs(distance_pct) > 0.02:
                    continue

                # --- GAMMA SCORE ---
                gamma_explosion_score = None
                if gex_gradient is not None and spot not in (None, 0):
                    gamma_explosion_score = abs(gex_gradient) / spot

                # --- VOL SPREAD ---
                vol_spread = None
                if iv is not None and hv is not None:
                    vol_spread = iv - hv

                results.append({
                    "symbol": symbol,
                    "distance": distance,
                    "distance_pct": distance_pct,  # useful for frontend
                    "gamma_explosion_score": gamma_explosion_score,
                    "vol_spread": vol_spread,
                    "timestamp": d.get("timestamp")
                })

            # --- FILTER VALID ---
            results = [
                r for r in results
                if r["gamma_explosion_score"] is not None
            ]

            # --- SORT ---
            results.sort(
                key=lambda x: x["gamma_explosion_score"],
                reverse=True
            )

            # --- LIMIT ---
            results = results[:50]

            print("flipzone count:", len(results))

            return jsonify(results)

        elif db_type == "localdb":

            try:
                file_path = os.path.join(DATABASE_DIR, f"{latest_collection.name}.json")

                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"{file_path} not found")

                with open(file_path, "r") as f:
                    documents = json.load(f)

                results = []

                for d in documents:
                    symbol = d.get("_id")

                    if not symbol:
                        continue

                    # --- SAFE EXTRACTION ---
                    spot = d.get("spot")
                    gamma_flip = d.get("gamma_flip")
                    gex_gradient = d.get("gex_gradient")
                    iv = d.get("iv")
                    hv = d.get("hv")

                    try:
                        spot = float(spot) if spot is not None else None
                        gamma_flip = float(gamma_flip) if gamma_flip is not None else None
                        gex_gradient = float(gex_gradient) if gex_gradient is not None else None
                        iv = float(iv) if iv is not None else None
                        hv = float(hv) if hv is not None else None
                    except:
                        continue

                    # --- DISTANCE ---
                    distance = None
                    distance_pct = None

                    if spot is not None and gamma_flip is not None and spot != 0:
                        distance = spot - gamma_flip
                        distance_pct = distance / spot

                    if distance_pct is None or abs(distance_pct) > 0.02:
                        continue

                    # --- GAMMA SCORE ---
                    gamma_explosion_score = None
                    if gex_gradient is not None and spot not in (None, 0):
                        gamma_explosion_score = abs(gex_gradient) / spot

                    # --- VOL SPREAD ---
                    vol_spread = None
                    if iv is not None and hv is not None:
                        vol_spread = iv - hv

                    results.append({
                        "symbol": symbol,
                        "distance": distance,
                        "distance_pct": distance_pct,
                        "gamma_explosion_score": gamma_explosion_score,
                        "vol_spread": vol_spread,
                        "timestamp": d.get("timestamp")
                    })

                results = [r for r in results if r["gamma_explosion_score"] is not None]

                results.sort(key=lambda x: x["gamma_explosion_score"], reverse=True)

                results = results[:50]

                print("flipzone count (localdb):", len(results))

                return jsonify(results)

            except Exception as e:
                print("LocalDB error:", e)
                return jsonify({"error": str(e)}), 500

        else:
            data = db.reference("flipzone-latest").get()

            return jsonify([
                {
                    "symbol": symbol,
                    "distance": value.get("distance"),
                    "gamma_explosion_score": value.get("gamma_explosion_score"),
                    "timestamp": value.get("timestamp")
                }
                for symbol, value in data.items()
            ])

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/gamma-explosion")
def gamma_explosion():
    verify_token()
    db_type = get_db_type()

    try:
        results = []

        if db_type == "mongo":

            cursor = latest_collection.find({}, {
                "_id": 1,
                "spot": 1,
                "gamma_flip": 1,
                "gex_gradient": 1,
                "iv": 1,
                "hv": 1,
                "timestamp": 1
            })

            for d in cursor:
                symbol = str(d.get("_id")) if d.get("_id") else None

                if not symbol:
                    continue

                # --- SAFE EXTRACTION ---
                try:
                    spot = float(d.get("spot")) if d.get("spot") is not None else None
                    gamma_flip = float(d.get("gamma_flip")) if d.get("gamma_flip") is not None else None
                    gex_gradient = float(d.get("gex_gradient")) if d.get("gex_gradient") is not None else None
                    iv = float(d.get("iv")) if d.get("iv") is not None else None
                    hv = float(d.get("hv")) if d.get("hv") is not None else None
                except:
                    continue

                if spot is None or gex_gradient is None or spot == 0:
                    continue

                # --- DISTANCE ---
                distance = None
                distance_pct = None

                if gamma_flip is not None:
                    distance = spot - gamma_flip
                    distance_pct = (distance) / spot

                # 🚨 OPTIONAL FILTER (looser than flipzone)
                if distance_pct is not None and abs(distance_pct) > 0.02:
                    continue

                # --- GAMMA EXPLOSION SCORE (UPGRADED) ---
                gamma_explosion_score = None
                if distance is not None:
                    gamma_explosion_score = abs(gex_gradient) * abs(distance) / spot
                else:
                    gamma_explosion_score = abs(gex_gradient) / spot

                # --- VOL CONTEXT ---
                vol_spread = None
                if iv is not None and hv is not None:
                    vol_spread = iv - hv

                results.append({
                    "symbol": str(symbol),
                    "distance": distance,
                    "distance_pct": distance_pct,
                    "gamma_explosion_score": gamma_explosion_score,
                    "vol_spread": vol_spread,
                    "timestamp": d.get("timestamp")
                })
                # print("results:", results)

        elif db_type == "localdb":

            try:
                file_path = os.path.join(DATABASE_DIR, f"{latest_collection.name}.json")

                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"{file_path} not found")

                with open(file_path, "r") as f:
                    documents = json.load(f)

                for d in documents:
                    symbol = d.get("_id")

                    if not symbol:
                        continue

                    # --- SAFE EXTRACTION ---
                    try:
                        spot = float(d.get("spot")) if d.get("spot") is not None else None
                        gamma_flip = float(d.get("gamma_flip")) if d.get("gamma_flip") is not None else None
                        gex_gradient = float(d.get("gex_gradient")) if d.get("gex_gradient") is not None else None
                        iv = float(d.get("iv")) if d.get("iv") is not None else None
                        hv = float(d.get("hv")) if d.get("hv") is not None else None
                    except:
                        continue

                    if spot is None or gex_gradient is None or spot == 0:
                        continue

                    # --- DISTANCE ---
                    distance = None
                    distance_pct = None

                    if gamma_flip is not None:
                        distance = spot - gamma_flip
                        distance_pct = distance / spot

                    if distance_pct is not None and abs(distance_pct) > 0.02:
                        continue

                    # --- GAMMA EXPLOSION SCORE ---
                    if distance is not None:
                        gamma_explosion_score = abs(gex_gradient) * abs(distance) / spot
                    else:
                        gamma_explosion_score = None

                    # --- VOL CONTEXT ---
                    vol_spread = None
                    if iv is not None and hv is not None:
                        vol_spread = iv - hv

                    results.append({
                        "symbol": symbol,
                        "distance": distance,
                        "distance_pct": distance_pct,
                        "gamma_explosion_score": gamma_explosion_score,
                        "vol_spread": vol_spread,
                        "timestamp": d.get("timestamp")
                    })

                    # print("results (localdb):", results)

            except Exception as e:
                print("LocalDB error:", e)
                return jsonify({"error": str(e)}), 500

        else:
            data = db.reference().child("flipzone-latest").get()

            for symbol, row in (data or {}).items():

                explosion_score = row.get("gamma_explosion_score")
                distance = row.get("distance")

                if explosion_score is None:
                    continue

                results.append({
                    "symbol": symbol,
                    "distance": distance,
                    "gamma_explosion_score": float(explosion_score)
                })

        # 🔥 FILTER VALID
        results = [
            r for r in results
            if r["gamma_explosion_score"] is not None
        ]

        # 🔥 SORT DESC
        results.sort(
            key=lambda x: x["gamma_explosion_score"],
            reverse=True
        )

        # 🔥 LIMIT (important for dashboard latency)
        results = results[:50]


        return jsonify(results)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/convexity-radar")
def convexity_radar():
    verify_token()

    db_type = get_db_type()

    try:
        # -------------------------
        # 🔥 DATA FETCH
        # -------------------------
        if db_type == "mongo":

            cursor = latest_collection.find({})
            data = {}

            for d in cursor:
                symbol = str(d.get("_id"))
                row = d

                if not symbol or not row:
                    continue

                data[symbol] = row

        elif db_type == "localdb":

            try:
                file_path = os.path.join(DATABASE_DIR, f"{latest_collection.name}.json")

                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"{file_path} not found")

                with open(file_path, "r") as f:
                    documents = json.load(f)

                data = {}

                for d in documents:
                    symbol = str(d.get("_id"))
                    row = d

                    if not symbol or not row:
                        continue

                    data[symbol] = row

            except Exception as e:
                print("LocalDB error:", e)
                return jsonify({"error": str(e)}), 500

        else:
            data = db.reference().child("latest-vol-regime-metrics").get()

        if not data:
            return jsonify([])

        results = []

        # -------------------------
        # 🔥 CORE COMPUTATION
        # -------------------------
        for symbol, row in data.items():
            try:
                spot = row.get("spot")

                # ✅ FIXED
                flip = row.get("gamma_flip") or (row.get("gamma_zones") or {}).get("gamma_flip")

                chain = row.get("option_chain")

                # ✅ SOFT fallback instead of skip
                if not chain or not isinstance(chain, list):
                    chain = []

                gamma_instability = 0
                vanna_pressure = 0
                dealer_flow = 0

                # ---- Extract GEX ----
                gex = [
                    o.get("net_gex")
                    for o in chain
                    if o.get("net_gex") is not None
                ]

                # ✅ SAFE gamma instability
                if len(gex) >= 3:
                    for i in range(1, len(gex) - 1):
                        gamma_instability += abs(
                            gex[i + 1] - 2 * gex[i] + gex[i - 1]
                        )

                # ---- Vanna + Dealer Flow
                for o in chain:
                    call_oi = o.get("call_oi", 0)
                    put_oi = o.get("put_oi", 0)

                    net_oi = call_oi - put_oi

                    delta = abs(o.get("call_delta", 0))
                    vanna = o.get("vega", 0) * (1 - delta)

                    vanna_pressure += abs(vanna * net_oi)
                    dealer_flow += abs(o.get("net_gex", 0))

                # ---- Flip Distance
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

        print("final radar count:", len(results))

        return jsonify(results)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


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
    verify_token()
    db_type = get_db_type()

    if db_type == "mongo":
        db_root = get_mongo_root()


        doc = db_root.find_one(
            {"_id": symbol},
            {"_id": 0, "data.metrics": 1}
        )

        if not doc:
            return jsonify({})

        metrics = doc.get("data", {}).get("metrics", {})

        if not metrics:
            return jsonify({})

        # 🔥 Convert dict → DataFrame
        df = pd.DataFrame(metrics).T

        # keep only last 4
        df = df.sort_index().iloc[-8:]

        # -------------------------
        # 🔥 TIME HANDLING
        # -------------------------
        df.index = pd.to_datetime(df.index.astype(int), unit="s", utc=True)
        df.index = df.index.tz_convert("Asia/Kolkata")

    elif db_type == "localdb":

        try:
            db_root = get_mongo_root()
            file_path = os.path.join(DATABASE_DIR, f"{db_root.name}.json")

            if not os.path.exists(file_path):
                raise FileNotFoundError(f"{file_path} not found")

            with open(file_path, "r") as f:
                documents = json.load(f)

            # 🔍 Find the matching symbol document
            doc = next((d for d in documents if str(d.get("_id")) == symbol), None)

            if not doc:
                return jsonify({})

            metrics = doc.get("data", {}).get("metrics", {})

            if not metrics:
                return jsonify({})

            # 🔥 Convert dict → DataFrame
            df = pd.DataFrame(metrics).T

            # keep only last 4
            df = df.sort_index().iloc[-8:]

            # 🔥 TIME HANDLING
            df.index = pd.to_datetime(df.index.astype(int), unit="s", utc=True)
            df.index = df.index.tz_convert("Asia/Kolkata")

        except Exception as e:
            print("LocalDB error:", e)
            return jsonify({"error": str(e)}), 500

    else:
        root_ref = get_root()
        ref = root_ref.child(symbol).child("metrics")

        data = ref.order_by_key().limit_to_last(4).get()

        if not data:
            return jsonify({})

        df = pd.DataFrame(data).T

        df.index = pd.to_datetime(df.index.astype(int), unit="s", utc=True)
        df.index = df.index.tz_convert("Asia/Kolkata")
        df = df.sort_index()

    # print(df.index[:3])
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

    def safe_col(df, col, default=0.0):
        if col in df.columns:
            return df[col].fillna(default).tolist()
        else:
            return [default] * len(df)

    def safe_time_index(df):
        try:
            return [
                t.strftime("%Y-%m-%d %H:%M:%S") if hasattr(t, "strftime") else str(t)
                for t in df.index
            ]
        except Exception:
            return [str(i) for i in range(len(df))]

    response = {
        "time": safe_time_index(df),

        "spot": safe_col(df, "spot"),
        "iv": safe_col(df, "iv"),
        "hv": safe_col(df, "hv"),

        "gamma_flip": safe_col(df, "gamma_flip"),

        "k": safe_col(df, "impact_coefficient_k"),
        "bpr": safe_col(df, "bifurcation_proximity_ratio"),

        "I1": safe_col(df, "linear_instability_I1"),
        "I2": safe_col(df, "convexity_instability_I2"),

        "amplification": safe_col(df, "amplification_factor"),
        "fragility": safe_col(df, "fragility_score"),

        "option_chain": option_chain if isinstance(option_chain, list) else [],
        "option_chain_history": option_chain_history if isinstance(option_chain_history, list) else []
    }
    if "gex_gradient" in df.columns:
        response["gex_gradient"] = df["gex_gradient"].tolist()

    response = sanitize_for_json(response)
    # print(response)

    return jsonify(response)


from bson import ObjectId
from datetime import datetime


def mongo_serialize(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: mongo_serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [mongo_serialize(i) for i in obj]
    return obj


@app.route("/api/latest/<stock_id>")
def get_latest_snapshot(stock_id):
    verify_token()

    # ✅ FIX: read from query param directly
    db_type = get_db_type()

    try:
        if db_type == "mongo":

            doc = states_collection.find_one({"_id": stock_id})

            if not doc:
                return jsonify({
                    "stock_id": stock_id,
                    "count": 0,
                    "data": []
                })

            states = doc.get("data", {}).get("states", {})

            if not isinstance(states, dict) or not states:
                return jsonify({
                    "stock_id": stock_id,
                    "count": 0,
                    "data": []
                })

            # ✅ SAFE sorting
            try:
                sorted_ts = sorted(states.keys(), key=lambda x: int(x))
            except:
                # fallback if keys are weird
                sorted_ts = sorted(states.keys())

            last_ts = sorted_ts[-8:]

            snapshots = [
                {"timestamp": ts, "data": states.get(ts, {})}
                for ts in last_ts
            ]

            return jsonify(mongo_serialize({
                "stock_id": stock_id,
                "latest_timestamp": doc.get("timestamp"),
                "count": len(snapshots),
                "data": snapshots
            }))

        elif db_type == "localdb":

            try:
                file_path = os.path.join(DATABASE_DIR, f"{states_collection.name}.json")

                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"{file_path} not found")

                with open(file_path, "r") as f:
                    documents = json.load(f)

                # 🔍 Find document for stock_id
                doc = next((d for d in documents if str(d.get("_id")) == stock_id), None)

                if not doc:
                    return jsonify({
                        "stock_id": stock_id,
                        "count": 0,
                        "data": []
                    })

                states = doc.get("data", {}).get("states", {})

                if not isinstance(states, dict) or not states:
                    return jsonify({
                        "stock_id": stock_id,
                        "count": 0,
                        "data": []
                    })

                # ✅ SAFE sorting (same as mongo)
                try:
                    sorted_ts = sorted(states.keys(), key=lambda x: int(x))
                except:
                    sorted_ts = sorted(states.keys())

                last_ts = sorted_ts[-8:]

                snapshots = [
                    {"timestamp": ts, "data": states.get(ts, {})}
                    for ts in last_ts
                ]

                return jsonify({
                    "stock_id": stock_id,
                    "latest_timestamp": doc.get("timestamp"),
                    "count": len(snapshots),
                    "data": snapshots
                })

            except Exception as e:
                print("LocalDB error:", e)
                return jsonify({"error": str(e)}), 500

        else:
            ref = db.reference(f"vol-regime-states/{stock_id}/states")
            data = ref.order_by_key().limit_to_last(8).get()

            if not data:
                return jsonify({
                    "stock_id": stock_id,
                    "count": 0,
                    "data": []
                })

            snapshots = [
                {"timestamp": ts, "data": data[ts]}
                for ts in sorted(data.keys())
            ]

            return jsonify({
                "stock_id": stock_id,
                "count": len(snapshots),
                "data": snapshots
            })

    except Exception as e:
        import traceback
        print("ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



@app.route("/api/liststocks")
def liststocks():
    verify_token()

    try:
        data = db.reference("stocks").get()

        if not data:
            return jsonify([])

        results = []

        for symbol, value in data.items():
            if not isinstance(value, dict):
                continue

            results.append({
                "symbol": symbol,
                "id": value.get("ID"),
                "lot_size": value.get("LotSize"),
                "security_id": value.get("security_id")
            })

        return jsonify(results)

    except Exception as e:
        print("liststocks error:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/historical/<security_id>")
def get_historical(security_id):
    verify_token()
    tf = request.args.get("tf", "1d")
    underlying = request.args.get("underlying_security")

    print(security_id, underlying, tf)
    # try:
    if tf == "1d":
        print(security_id)
        print(underlying)
        data = dhan.get_daily_spot_data(security_id=security_id, under_security=underlying)
    else:
        data = dhan.get_intrday_spot_data(
            security_id=security_id,
            under_security=underlying,
            timeframe=tf)
    return jsonify(data)

    # except Exception as e:
    #     return jsonify({"error": str(e)}), 500




from datetime import datetime, date

def get_valid_expiry(expiries):

    today = date.today()

    for exp in expiries:
        exp_date = datetime.strptime(exp, "%Y-%m-%d").date()

        # ❌ skip today's expiry
        if exp_date == today:
            continue

        # ✅ take next valid future expiry
        if exp_date > today:
            return exp

    return expiries[0]



@app.route("/api/option-chain/<security_id>")
def get_option_chain(security_id):

    verify_token()
    underlying = request.args.get("underlying_security")

    try:
        expiries = dhan.get_expiry_list(under_security_id=int(security_id),
                                        under_security=underlying)
        print(expiries)
        selected_expiry = get_valid_expiry(expiries)

        print("Selected expiry:", selected_expiry)
        data = dhan.get_option_chain(
            under_security_id= security_id,
                underlying=underlying,
                expiry=selected_expiry)
        return jsonify(data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500




@app.route("/api/quote/<security_id>")
def get_quote(security_id):

    verify_token()
    underlying = request.args.get("underlying_security")

    try:
        data = dhan.get_realtime_quote_data(
            security_id=security_id,
        under_security=underlying)

        if not data:
            return jsonify({"error": "No quote data"}), 500

        return jsonify({
            "status": "success",
            "data": data
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test")
def test():
    user = verify_token()
    return jsonify({"status": "ok"})


import os

# if __name__ == "__main__":
#     port = int(os.environ.get("PORT", 8080))
#     app.run(host="0.0.0.0", port=port)

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
