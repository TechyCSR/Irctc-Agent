"""
FastAPI Server for IRCTC Smart Route & Live Seat Availability Agent.
Serves the accessible modern Web UI and REST API for real-time querying.
"""

import asyncio
import json
import os
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from run_search import run_live_search

app = FastAPI(
    title="IRCTC Smart Route Agent",
    description="Autonomous Pathfinder & Seat Availability Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "outputs/search_results.json"
cached_data = {}


def load_cached_data():
    global cached_data
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                cached_data = json.load(f)
        except Exception as e:
            print(f"Error loading cache: {e}")


@app.on_event("startup")
async def startup_event():
    load_cached_data()
    if not cached_data or "routes" not in cached_data:
        print("[*] No existing scan cache found. Running initial background scan...")
        asyncio.create_task(run_scan_task())


async def run_scan_task():
    global cached_data
    try:
        new_data = await run_live_search("10-11-2026", "16-11-2026")
        cached_data = new_data
        print("[+] Scan completed and cache refreshed successfully.")
    except Exception as e:
        print(f"[-] Scan task error: {e}")


@app.get("/")
async def serve_index():
    """Serves the minimal white, modern Web UI."""
    return FileResponse("web/index.html")


@app.get("/api/routes")
async def get_routes(
    date: Optional[str] = Query(None, description="Date filter e.g. 10-11-2026"),
    corridor: Optional[str] = Query(None, description="Corridor filter"),
    class_code: Optional[str] = Query(None, description="Class code e.g. 3A"),
    confirmed_only: bool = Query(False, description="Filter for 100% confirmed seats only")
):
    """Returns ranked itineraries with filters."""
    global cached_data
    if not cached_data or "routes" not in cached_data:
        load_cached_data()

    if not cached_data:
        return JSONResponse({"status": "loading", "message": "Initial scan in progress...", "routes": []})

    routes = cached_data.get("routes", [])

    # Filter by date if provided
    if date and date != "ALL":
        d_val = date.split("-")[0]
        routes = [r for r in routes if r["legs"][0]["departure"].startswith(f"{d_val}-Nov")]

    # Filter by corridor
    if corridor and corridor != "ALL":
        if corridor == "NORTHERN":
            routes = [r for r in routes if r.get("is_northern_detour")]
        elif corridor == "DIRECT":
            routes = [r for r in routes if r.get("type") == "DIRECT"]
        else:
            routes = [r for r in routes if corridor.lower() in r.get("corridor", "").lower()]

    # Filter by confirmed only
    if confirmed_only:
        routes = [
            r for r in routes
            if all(any("AVAILABLE" in s and "NOT AVAILABLE" not in s for s in leg["seats"].values()) for leg in r["legs"])
        ]

    # Filter by class
    if class_code and class_code != "ALL":
        routes = [
            r for r in routes
            if all(class_code in leg["seats"] for leg in r["legs"])
        ]

    return {
        "status": "success",
        "total_evaluated": cached_data.get("total_evaluated", len(routes)),
        "total_confirmed": cached_data.get("total_confirmed", 0),
        "lowest_fare": cached_data.get("lowest_fare", 0),
        "direct_trains": cached_data.get("direct_trains", []),
        "routes": routes
    }


@app.post("/api/scan")
async def trigger_scan(background_tasks: BackgroundTasks):
    """Triggers an asynchronous live re-scan of Indian Railways data."""
    background_tasks.add_task(run_scan_task)
    return {"status": "accepted", "message": "Live scan triggered in background"}


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
