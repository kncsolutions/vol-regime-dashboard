import pandas as pd
from pymongo import MongoClient
import firebase_admin
from firebase_admin import credentials, db
from config import *


class StockDBUploader:

    def __init__(self):
        self.mongo_client = None
        self.mongo_collection = None
        self.firebase_initialized = False

    # -----------------------------
    # MongoDB Setup
    # -----------------------------
    def init_mongo(self):
        self.mongo_client = MongoClient(MONGO_URI)
        db_mongo = self.mongo_client[MONGO_DB]
        self.mongo_collection = db_mongo[MONGO_COLLECTION]

        # Optional index
        self.mongo_collection.create_index("ID", unique=True)

        print("✅ MongoDB Connected")

    # -----------------------------
    # Firebase Realtime DB Setup
    # -----------------------------
    def init_firebase(self):
        if not firebase_admin._apps:
            cred = credentials.Certificate(FIREBASE_CRED_PATH)
            firebase_admin.initialize_app(cred, {
                'databaseURL': FIREBASE_DB_URL
            })

        self.firebase_initialized = True
        print("✅ Firebase Realtime DB Connected")

    # -----------------------------
    # Read Excel
    # -----------------------------
    def read_excel(self, file_path):
        df = pd.read_excel(file_path)
        df.columns = ["ID", "security_id", "LotSize"]

        return df.to_dict(orient="records")

    # -----------------------------
    # Upload to MongoDB
    # -----------------------------
    def upload_to_mongo(self, data):
        if self.mongo_collection is None:
            raise Exception("MongoDB not initialized")

        for stock in data:
            self.mongo_collection.update_one(
                {"ID": stock["ID"]},
                {"$set": stock},
                upsert=True
            )

        print(f"✅ MongoDB upsert complete: {len(data)} records")

    # -----------------------------
    # Upload to Firebase RTDB
    # -----------------------------
    def upload_to_firebase(self, data):
        if not self.firebase_initialized:
            raise Exception("Firebase not initialized")

        root_ref = db.reference(FIREBASE_NODE)

        # Structure: stocks/{ID} = {...}
        updates = {}
        for stock in data:
            stock_id = stock["ID"]
            updates[stock_id] = stock

        root_ref.update(updates)

        print(f"✅ Firebase RTDB updated: {len(data)} records")

    # -----------------------------
    # Full Pipeline
    # -----------------------------
    def run(self, file_path, target="both"):
        data = self.read_excel(file_path)

        if target in ["mongo", "both"]:
            self.init_mongo()
            self.upload_to_mongo(data)

        if target in ["firebase", "both"]:
            self.init_firebase()
            self.upload_to_firebase(data)


# -----------------------------
# Entry Point
# -----------------------------
if __name__ == "__main__":
    uploader = StockDBUploader()
    uploader.run("res/screendhanlist.xlsx", target="both")