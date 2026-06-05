# migrate-data.py
# Python script to migrate data from Firestore to PostgreSQL (Supabase)
# Logs all output to migrate_data_out.txt for CP1252 Windows terminal safety.
# Requires: pip install firebase-admin pg8000

import os
import json
import pg8000.dbapi
import firebase_admin
from firebase_admin import credentials, firestore

# Connection Details
host = "aws-1-ap-southeast-1.pooler.supabase.com"
port = 6543
database = "postgres"
user = "postgres.nwnqehaprqeygpbczbsv"
password = "Pavan@speakup"
service_account_path = "./firebase-service-account.json"

output_lines = []

def log(msg):
    print(msg)
    output_lines.append(msg)

if not os.path.exists(service_account_path):
    log(f"ERROR: Firebase service account key not found at: {service_account_path}")
    exit(1)

# Initialize Firebase Admin
log("Initializing Firebase Admin SDK...")
try:
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    log("Firebase Admin SDK initialized successfully!")
except Exception as e:
    log(f"Firebase initialization failed: {e}")
    exit(1)

# Initialize PostgreSQL
log("Connecting to Supabase PostgreSQL database...")
try:
    conn = pg8000.dbapi.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password
    )
    cursor = conn.cursor()
    log("Database connection successful!")
except Exception as e:
    log(f"Database connection failed: {e}")
    exit(1)

try:
    log("Fetching users from Firestore...")
    users_ref = db.collection("users")
    users = list(users_ref.stream())
    
    migrated_users = 0
    migrated_sessions = 0
    
    log(f"Found {len(users)} users in Firestore.")
    
    for doc in users:
        u_data = doc.to_dict()
        uid = doc.id
        
        name = u_data.get("name", "Speaker")
        email = u_data.get("email", "")
        gender = u_data.get("gender", "prefer_not")
        avatar_bg = u_data.get("avatar_bg", "b6e3f4")
        aura_points = int(u_data.get("aura_points", 0))
        streak = int(u_data.get("streak", 0))
        total_yaps = int(u_data.get("total_yaps", 0))
        
        # Handle created_at timestamp
        created_at = u_data.get("created_at")
        if created_at and hasattr(created_at, "rfc3339"):
            created_at_str = created_at.rfc3339()
        elif created_at:
            created_at_str = str(created_at)
        else:
            created_at_str = "NOW()"
            
        log(f"Migrating User: {name} ({email or uid})...")
        
        # 1. Insert/Update User Profile
        cursor.execute(
            """
            INSERT INTO users (uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (uid) DO UPDATE 
            SET name = EXCLUDED.name,
                email = EXCLUDED.email,
                gender = EXCLUDED.gender,
                avatar_bg = EXCLUDED.avatar_bg,
                aura_points = EXCLUDED.aura_points,
                streak = EXCLUDED.streak,
                total_yaps = EXCLUDED.total_yaps;
            """,
            (uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps, created_at_str)
        )
        migrated_users += 1
        
        # 2. Process recent sessions
        recent_sessions = u_data.get("recent_sessions", [])
        if isinstance(recent_sessions, list):
            for s in recent_sessions:
                s_date = s.get("date")
                if s_date and hasattr(s_date, "rfc3339"):
                    s_date_str = s_date.rfc3339()
                elif s_date:
                    s_date_str = str(s_date)
                else:
                    s_date_str = "NOW()"
                
                topic = s.get("topic", "General Practice")
                mode = s.get("mode", "random")
                fluency = int(s.get("fluency", 0))
                clarity = int(s.get("clarity", 0))
                confidence = int(s.get("confidence", 0))
                score = int(s.get("score", 0))
                
                # Check for duplicates
                cursor.execute(
                    "SELECT id FROM practice_sessions WHERE user_id = %s AND date = %s",
                    (uid, s_date_str)
                )
                if cursor.rowcount == 0:
                    cursor.execute(
                        """
                        INSERT INTO practice_sessions (user_id, date, topic, mode, score, fluency, clarity, confidence)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (uid, s_date_str, topic, mode, score, fluency, clarity, confidence)
                    )
                    migrated_sessions += 1

    conn.commit()
    log("\nMigration completed successfully!")
    log(f"   - Users migrated/updated: {migrated_users}")
    log(f"   - New sessions imported:  {migrated_sessions}")

except Exception as e:
    log(f"Migration failed: {e}")
finally:
    if 'conn' in locals():
        conn.close()

# Write output file
with open("C:\\Users\\pavan\\.gemini\\antigravity-ide\\brain\\ed0eb7e6-766c-4ea5-8d15-da8428a627b7\\scratch\\migrate_data_out.txt", "w") as f:
    f.write("\n".join(output_lines))
