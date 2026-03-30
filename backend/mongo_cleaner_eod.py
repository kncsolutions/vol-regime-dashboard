from pymongo import MongoClient
from datetime import datetime
from collections import defaultdict
# -----------------------------
# 🔌 CONNECT TO LOCAL MONGO
# -----------------------------
client = MongoClient("mongodb://localhost:27017/")

source_db = client["volatility_db"]  # change if needed
source_collection = source_db["vol_regime_metrics"]

target_db = client["volatility_db"]  # same DB, different collection
target_collection = target_db["vol_regime_metrics_cleaned"]

# Optional: clear target collection before insert
target_collection.delete_many({})
# -----------------------------
# 🧠 PROCESS DATA
# -----------------------------
cursor = source_collection.find({})
print("Document count:", source_collection.count_documents({}))
for doc in cursor:
    stock_id = doc["_id"]
    print(stock_id)
    metrics = doc.get("data", {}).get("metrics", {})

    if not metrics:
        continue

    # Group timestamps by day
    daily_latest = {}

    for ts_str, value in metrics.items():
        try:
            ts = int(ts_str)
        except:
            continue

        dt = datetime.fromtimestamp(ts)
        day_key = dt.strftime("%Y-%m-%d")
        print(day_key)

        # Keep only latest timestamp per day
        if day_key not in daily_latest or ts > daily_latest[day_key][0]:
            daily_latest[day_key] = (ts, value)

    # Build cleaned metrics dict
    cleaned_metrics = {
        str(ts): val for (ts, val) in [v for v in daily_latest.values()]
    }


    # -----------------------------
    # 💾 INSERT INTO NEW COLLECTION
    # -----------------------------
    target_doc = {
        "_id": stock_id,
        "data": {
            "metrics": cleaned_metrics
        }
    }

    target_collection.replace_one(
        {"_id": stock_id},
        target_doc,
        upsert=True
    )

print("✅ Cleaning complete. Data stored in vol-regime-metrics-cleaned")