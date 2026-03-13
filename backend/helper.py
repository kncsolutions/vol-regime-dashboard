import firebase_admin
from firebase_admin import credentials, db
from datetime import datetime
from collections import defaultdict

# --------------------------------
# Firebase initialization
# --------------------------------

cred = credentials.Certificate("breeze-credentials-firebase-adminsdk-u0aro-a51f03c53f.json")

firebase_admin.initialize_app(
    cred,
    {
        "databaseURL": "https://breeze-credentials-default-rtdb.firebaseio.com/"
    }
)

root_ref = db.reference("vol-regime-metrics")
upload_root = db.reference("vol-regime-metrics-cleaned")

# --------------------------------
# Keep last snapshot per day
# --------------------------------

def keep_last_snapshot_per_day(metrics):

    grouped = defaultdict(list)

    for ts in metrics.keys():

        try:
            ts_int = int(ts)
            dt = datetime.fromtimestamp(ts_int)
            grouped[dt.date()].append(ts_int)
        except:
            continue

    cleaned = {}

    for date, timestamps in grouped.items():

        last_ts = max(timestamps)
        cleaned[str(last_ts)] = metrics[str(last_ts)]

    return cleaned


# --------------------------------
# Get list of symbols
# --------------------------------

symbols = root_ref.get(shallow=True)

print(f"Found {len(symbols)} symbols")

# --------------------------------
# Process symbol by symbol
# --------------------------------

for symbol in symbols:

    print(f"Processing {symbol}")

    symbol_ref = root_ref.child(symbol)
    symbol_data = symbol_ref.get()

    if not symbol_data:
        continue

    cleaned_symbol = {}

    for node, node_data in symbol_data.items():

        if node == "metrics" and isinstance(node_data, dict):

            cleaned_symbol["metrics"] = keep_last_snapshot_per_day(node_data)

        else:
            cleaned_symbol[node] = node_data

    # upload cleaned data
    upload_root.child(symbol).set(cleaned_symbol)

    print(f"{symbol} uploaded")


print("Cleaning complete")