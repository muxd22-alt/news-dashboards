import sqlite3
from datetime import datetime

def update_db():
    conn = sqlite3.connect('directory.db')
    cursor = conn.cursor()

    # Create reviews table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers(id)
    );
    """)

    # Add some sample reviews
    sample_reviews = [
        (1, "خالد محمد", 5, "شغل نظيف وسريع جداً، أنصح به."),
        (1, "سارة أحمد", 4, "محترم وملتزم بالمواعيد."),
        (2, "فهد علي", 5, "خبير حقيقي في الكهرباء."),
        (3, "نورا سعد", 3, "جيد لكن تأخر قليلاً.")
    ]

    cursor.executemany("""
    INSERT INTO reviews (provider_id, user_name, rating, comment)
    VALUES (?, ?, ?, ?);
    """, sample_reviews)

    conn.commit()
    conn.close()
    print("Database updated with reviews table and sample data.")

if __name__ == "__main__":
    update_db()
