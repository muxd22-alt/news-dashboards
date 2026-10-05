import sqlite3
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")

def migrate():
    # 1. Connect to Local SQLite
    if not os.path.exists('directory.db'):
        print("❌ Local directory.db not found!")
        return
    
    conn = sqlite3.connect('directory.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 2. Fetch Providers
    cursor.execute("SELECT name, category, city, region, whatsapp, bio_ar, rating, images, avg_response_time FROM providers")
    providers = [dict(row) for row in cursor.fetchall()]
    
    if not providers:
        print("ℹ️ No local providers to migrate.")
        return

    print(f"📦 Found {len(providers)} providers locally. Starting cloud migration...")

    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    # 3. Push to Supabase
    try:
        with httpx.Client() as client:
            resp = client.post(f"{URL}/rest/v1/providers", json=providers, headers=headers)
            if resp.status_code in (200, 201):
                print("✅ Migration Successful! All partners are now in the Supabase Cloud.")
            else:
                print(f"❌ Migration Failed: {resp.status_code}")
                print(resp.text)
                print("💡 Hint: Make sure you've created the 'providers' table in Supabase and DISABLED RLS (Row Level Security) for now.")
    except Exception as e:
        print(f"❌ Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
