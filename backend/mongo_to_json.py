import os
import json
from pymongo import MongoClient
from bson import json_util

# ---------------- CONFIG ----------------
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "volatility_db"   # change this
OUTPUT_DIR = "database"
# ----------------------------------------

def export_mongo_to_json():
    # Create output directory if it doesn't exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    collections = db.list_collection_names()

    print(f"Found collections: {collections}")

    for collection_name in collections:
        collection = db[collection_name]

        # Fetch all documents
        documents = list(collection.find({}))

        # Convert BSON to JSON serializable format
        json_data = json.loads(json_util.dumps(documents))

        # File path
        file_path = os.path.join(OUTPUT_DIR, f"{collection_name}.json")

        # Save to file
        with open(file_path, "w") as f:
            json.dump(json_data, f, indent=4)

        print(f"Exported {collection_name} → {file_path}")

    print("\n✅ Export completed successfully.")


if __name__ == "__main__":
    export_mongo_to_json()