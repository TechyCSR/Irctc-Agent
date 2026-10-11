"""
FastAPI Server for Public Universal IRCTC Agent & Smart Pathfinder.
Provides REST and Server-Sent Events (SSE) streaming APIs, station autocomplete,
and serves the React production web application.
"""

import asyncio
import json
import logging
import os
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend.app.engine import PublicSearchEngine
from backend.app.stations import STATIONS_DATA, search_stations

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("IrctcAgent.API")

app = FastAPI(
    title="IRCTC AGENT API",
    description="Public High-Performance Indian Railways Route & Live Seat Discovery Agent",
    version="2.0.0"
)

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = ["*"] if cors_origins_env == "*" else [o.strip() for o in cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = PublicSearchEngine()


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "IRCTC Universal Pathfinder", "version": "2.0.0"}


@app.get("/api/stations/search")
async def autocomplete_stations(q: str = Query("", description="Station search query")):
    """Autocomplete search for any Indian railway station code, name, or city."""
    if not q or len(q.strip()) < 1:
        return []
    return search_stations(q, limit=10)


@app.get("/api/stations/popular")
async def get_popular_stations():
    """Returns top popular starting hubs for quick selection."""
    popular_codes = ["NDLS", "CSMT", "SBC", "HWH", "MAS", "SC", "ADI", "PUNE", "JU", "JP", "CNB", "PNBE"]
    results = []
    for s in STATIONS_DATA:
        if s.code in popular_codes:
            results.append({
                "code": s.code,
                "name": s.name,
                "city": s.city,
                "state": s.state,
                "cluster": s.cluster_id
            })
    return results


@app.get("/api/search")
async def search_routes(
    from_stn: str = Query(..., alias="from", description="Origin station code e.g. JU or NDLS"),
    to_stn: str = Query(..., alias="to", description="Destination station code e.g. SBC or CSMT"),
    date: str = Query(..., description="Date of journey in DD-MM-YYYY format"),
    quota: str = Query("GN", description="Quota code: GN, TQ, etc."),
    preferred_class: Optional[str] = Query(None, alias="class", description="Preferred class code e.g. 3A, 2A, SL")
):
    """
    Standard synchronous REST search endpoint returning scored and deduplicated routes.
    """
    try:
        ranked = await engine.search_all(
            origin_code=from_stn,
            dest_code=to_stn,
            doj=date,
            quota=quota,
            preferred_class=preferred_class
        )

        serialized = [engine._serialize_itin(it) for it in ranked[:60]]
        confirmed_count = sum(1 for it in ranked if it.booking_confidence == "CONFIRMED")
        lowest_fare = min((it.best_fare for it in ranked if it.best_fare > 0), default=0)

        return {
            "status": "success",
            "origin": from_stn.upper(),
            "destination": to_stn.upper(),
            "date": date,
            "total_evaluated": len(ranked),
            "total_confirmed": confirmed_count,
            "lowest_fare": lowest_fare,
            "routes": serialized
        }
    except Exception as e:
        logger.exception("Search error")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@app.get("/api/search/stream")
async def stream_search_routes(
    from_stn: str = Query(..., alias="from"),
    to_stn: str = Query(..., alias="to"),
    date: str = Query(...),
    quota: str = Query("GN")
):
    """
    High-performance Server-Sent Events (SSE) streaming search.
    Instantly returns direct trains within 300ms, then streams connecting routes as they are found.
    """
    async def event_generator():
        try:
            async for event in engine.stream_search(from_stn, to_stn, date, quota):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.exception("Streaming error")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# Mount React production build if available
dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
