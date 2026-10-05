import sqlite3
import json

def update_db_v2():
    conn = sqlite3.connect('directory.db')
    cursor = conn.cursor()

    # Add columns to providers if they don't exist
    try:
        cursor.execute("ALTER TABLE providers ADD COLUMN images TEXT;")
    except sqlite3.OperationalError: pass
    
    try:
        cursor.execute("ALTER TABLE providers ADD COLUMN avg_response_time TEXT DEFAULT 'أقل من ساعة';")
    except sqlite3.OperationalError: pass

    # Seed some images for existing providers
    sample_images = json.dumps([
        "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=400",
        "https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=400"
    ])
    
    cursor.execute("UPDATE providers SET images = ?, avg_response_time = 'ساعتين' WHERE id = 1", (sample_images,))
    cursor.execute("UPDATE providers SET images = ?, avg_response_time = '30 دقيقة' WHERE id = 2", (sample_images,))

    conn.commit()
    conn.close()
    print("Database updated to V2: Added images and response time fields.")

if __name__ == "__main__":
    update_db_v2()
