import sqlite3
import random
from datetime import datetime

def init_db():
    conn = sqlite3.connect('directory.db')
    cursor = conn.cursor()

    # Enable WAL mode and normal synchronous for 2026 performance standards
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")

    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        city TEXT NOT NULL,
        region TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        bio_ar TEXT,
        rating REAL DEFAULT 0.0
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        provider_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers(id)
    );
    """)

    # Populate with 10 realistic Saudi-based entries in Arabic
    providers = [
        ("أحمد المنصور", "سباك", "الرياض", "شمال الرياض", "966501234561", "خبير في صيانة السباكة المنزلية وتسليك المجاري.", 4.8),
        ("خالد العتيبي", "كهربائي", "الرياض", "شرق الرياض", "966501234562", "تمديدات كهربائية وصيانة لوحات التوزيع.", 4.9),
        ("محمد الحربي", "فني تكييف", "جدة", "حي الروضة", "966501234563", "تركيب وصيانة جميع أنواع المكيفات (سبليت وشباك).", 4.7),
        ("ياسر القحطاني", "نجار", "الرياض", "وسط الرياض", "966501234564", "تصميم وتنفيذ غرف النوم والدواليب الخشبية.", 4.5),
        ("سلطان الشهري", "صباع", "الدمام", "حي الفيصلية", "966501234565", "دهانات داخلية وخارجية بلمسات عصرية.", 4.6),
        ("فهد المطيري", "سباك", "الرياض", "جنوب الرياض", "966501234566", "حلول ذكية لمشاكل تسرب المياه وصيانة المسابح.", 4.9),
        ("علي الدوسري", "كهربائي", "جدة", "حي المرجان", "966501234567", "إصلاح الأعطال الكهربائية المفاجئة وتغيير الأفياش.", 4.8),
        ("بندر العنزي", "فني تكييف", "الدمام", "حي الشاطئ", "966501234568", "فني متخصص في فك وتركيب المكيفات المركزية.", 4.4),
        ("تركي الغامدي", "بستاني", "جدة", "شمال جدة", "966501234569", "تنسيق الحدائق وصيانتها الدورية بأحدث الأدوات.", 4.7),
        ("سعود الرشيدي", "نقل عفش", "الرياض", "غرب الرياض", "966501234570", "نقل الأثاث بعناية فائقة مع فك وتركيب متكامل.", 4.6)
    ]

    cursor.executemany("""
    INSERT INTO providers (name, category, city, region, whatsapp, bio_ar, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    """, providers)

    conn.commit()
    conn.close()
    print("Database initialized and populated with 10 realism-focused entries.")

if __name__ == "__main__":
    init_db()
