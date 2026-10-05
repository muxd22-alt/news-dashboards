# 🏗️ HODHOD: High-Performance Service Architecture
## Localized Middle-Eastern Service Directory Core

This architecture is engineered for 2026 performance standards, optimized for low-resource environments (1GB RAM) while maintaining elite-level responsiveness and premium Saudi aesthetics.

---

### 1. Database Layer: SQLite WAL (Write-Ahead Logging)
**Implementation:** `init_db.py`
- **Mode:** `PRAGMA journal_mode=WAL;` for concurrent read/write operations.
- **Sync:** `PRAGMA synchronous=NORMAL;` for maximum speed without sacrificing durability.
- **Schema:**
  - `providers`: Robust profile storage (ID, Category, City, Region, WhatsApp, Bio_AR, Rating).
  - `interactions`: User session tracking for personalized "Contacted Before" badges.
- **Data Quality:** Includes 10 realistic Saudi-based entries with localized Arabic bios and region-specific mapping.

### 2. API Layer: FastAPI Core
**Implementation:** `main.py`
- **Framework:** High-concurrency FastAPI with asynchronous event handling.
- **Endpoints:**
  - `GET /search`: Multi-parameter filtering (City, Region, Category) with SQL-level optimizations.
  - `POST /log`: Lightweight interaction logging for conversion tracking.
  - `GET /history/{session_id}`: Personalized session retrieval for return users.
- **Security:** Built-in CORS management, input sanitization via standard parameter binding, and WAL-level data isolation.

*Inspired by Organization Best Practices*
- **Provider Management:** Integration of **Better Auth Organization Plugin** to allow providers to claim profiles, manage their bio, and view interaction analytics.
- **Role-Based Access (RBAC):** Defining `owner`, `admin`, and `provider` roles to secure the backend management portal.
- **Verification System:** Automated invitation and verification flow for new service providers joining the platform.

### 4. GitHub Pages Deployment Strategy
- **Frontend Assets (`index.html`, `seller.html`, `assets/`):** Optimized for static hosting on **GitHub Pages**. All API logic is abstracted to handle remote calls. 
- **Compatibility:** Responsive design (100% phone compatible) using Tailwind's viewport-driven utility classes.
- **Syncing:** Push to your repository `https://github.com/muxd22-alt/hudhud-platform` and enable Pages in Settings -> Pages -> Branch (Master).

### 5. Seller Ecosystem
- **Profile Customization:** Sellers can update their brief (`bio_ar`), galleries (`images`), and response times via the **Seller Portal (`seller.html`)**.
- **Performance Index:** Average response time is a key ranking factor for "Emergency" searches.

### 6. How to Run & Deploy
1. **Initialize DB:** `python init_db.py`
2. **Apply Google Upgrades:** `python update_db.py`
3. **Apply Seller Upgrades:** `python update_db_v2.py`
4. **Launch Backend:** `uvicorn main:app --reload`
5. **Deploy Frontend:**
   ```bash
   git add .
   git commit -m "🚀 Deployment Ready"
   git push origin master --force
   ```

---

*HODHOD is designed to feel like a high-end concierge service, bridging the gap between local experts and homeowners across the Kingdom.*