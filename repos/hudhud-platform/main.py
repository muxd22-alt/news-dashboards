from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
import os
import httpx
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="HODHOD Cloud API (Supabase Edition)")

# Supabase Credentials
URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")

# Headers for all Supabase calls
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Enable CORS (Critical for GH Pages access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount assets (if running locally)
if os.path.exists("assets"):
    app.mount("/assets", StaticFiles(directory="assets"), name="assets")

@app.get("/")
def read_root():
    return FileResponse('index.html')

@app.get("/cities")
async def get_cities():
    async with httpx.AsyncClient() as client:
        # Use our high-performance view
        url = f"{URL}/rest/v1/providers?select=city"
        # Since Supabase returns all occurrences, we extract uniquely in Python
        # (Alternatively, use a special RPC, but this is fine for most small/medium dirs)
        resp = await client.get(url, headers=HEADERS)
        if resp.status_code != 200: return []
        data = resp.json()
        cities = list(set([item['city'] for item in data if item.get('city')]))
        return sorted(cities)

@app.get("/search")
async def search_providers(
    city: Optional[str] = None,
    category: Optional[str] = None
):
    # Use our SQL View for speed and rating pre-calculations
    query_url = f"{URL}/rest/v1/providers_with_ratings?select=*"
    
    if city: query_url += f"&city=ilike.*{city}*"
    if category: query_url += f"&category=ilike.*{category}*"
    
    # Sort by rating descending (Google Maps style)
    query_url += "&order=avg_rating.desc"

    async with httpx.AsyncClient() as client:
        resp = await client.get(query_url, headers=HEADERS)
        if resp.status_code != 200: return []
        return resp.json()

@app.post("/register")
async def register_provider(provider: dict):
    # Default values for cloud registration
    payload = {
        **provider,
        "rating": 5.0,
        "avg_response_time": "30 دقيقة"
    }
    
    async with httpx.AsyncClient() as client:
        # Return the new record to get the ID
        headers_with_return = {**HEADERS, "Prefer": "return=representation"}
        resp = await client.post(f"{URL}/rest/v1/providers", json=payload, headers=headers_with_return)
        if resp.status_code in (200, 201):
            new_record = resp.json()[0]
            return {"status": "success", "id": new_record['id']}
        else:
            raise HTTPException(status_code=500, detail=resp.text)

@app.post("/review")
async def post_review(review: dict):
    payload = {
        **review,
        "timestamp": datetime.utcnow().isoformat()
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{URL}/rest/v1/reviews", json=payload, headers=HEADERS)
        return {"status": "success" if resp.status_code in (200, 210, 201) else "fail"}

@app.get("/provider/{provider_id}")
async def get_provider_profile(provider_id: int):
    url = f"{URL}/rest/v1/providers_with_ratings?id=eq.{provider_id}&select=*"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=HEADERS)
        if resp.status_code != 200 or not resp.json():
            raise HTTPException(status_code=404, detail="Not found")
        return resp.json()[0]

@app.post("/provider/{provider_id}/update")
async def update_provider_profile(provider_id: int, data: dict):
    url = f"{URL}/rest/v1/providers?id=eq.{provider_id}"
    async with httpx.AsyncClient() as client:
        resp = await client.patch(url, json=data, headers=HEADERS)
        return {"status": "success" if resp.status_code in (200, 204) else "fail"}

@app.get("/provider/{provider_id}/reviews")
async def get_provider_reviews(provider_id: int):
    url = f"{URL}/rest/v1/reviews?provider_id=eq.{provider_id}&order=timestamp.desc"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=HEADERS)
        if resp.status_code != 200: return []
        return resp.json()

@app.post("/log")
async def log_interaction(interaction: dict):
    payload = {**interaction, "timestamp": datetime.utcnow().isoformat()}
    async with httpx.AsyncClient() as client:
        await client.post(f"{URL}/rest/v1/interactions", json=payload, headers=HEADERS)
        return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
