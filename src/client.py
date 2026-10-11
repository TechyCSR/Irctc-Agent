"""
Asynchronous Indian Railways / ConfirmTkt Live API Client with caching and retry logic.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional
from MultiFeatures.IndianRailway import confirmtkt

logger = logging.getLogger("IrctcAgent.Client")


class TrainLiveClient:
    """
    Live API client that queries real-time train availability from the Indian Railways
    reservation system via the high-speed backend.
    """

    def __init__(self):
        self._ct = confirmtkt.Confirmtkt()
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    def _cache_key(self, src: str, dest: str, doj: str, quota: str) -> str:
        return f"{src}:{dest}:{doj}:{quota}"

    async def fetch_trains_between_stations(
        self,
        src: str,
        dest: str,
        doj: str,
        quota: str = "GN",
        retries: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Fetch all trains and real-time seat availability between two stations.

        Args:
            src: Origin station code (e.g., 'JU')
            dest: Destination station code (e.g., 'SBC')
            doj: Date of journey in 'DD-MM-YYYY' format
            quota: Quota code (default 'GN')
            retries: Max retry attempts on transient network failure

        Returns:
            List of normalized train dictionaries with live availability cache.
        """
        key = self._cache_key(src, dest, doj, quota)
        async with self._lock:
            if key in self._cache:
                return self._cache[key]

        last_error = None
        for attempt in range(1, retries + 1):
            try:
                raw_resp = await self._ct.available_trains(src, dest, doj, quota)
                if not raw_resp or not isinstance(raw_resp, dict):
                    trains = []
                else:
                    trains = raw_resp.get("trainBtwnStnsList") or []

                normalized_trains = self._normalize_train_list(trains, src, dest, doj)
                async with self._lock:
                    self._cache[key] = normalized_trains
                return normalized_trains

            except Exception as e:
                last_error = e
                logger.warning(
                    f"Attempt {attempt}/{retries} failed for {src}->{dest} on {doj}: {e}"
                )
                if attempt < retries:
                    await asyncio.sleep(0.5 * attempt)

        logger.error(f"Failed to fetch {src}->{dest} on {doj} after {retries} retries: {last_error}")
        return []

    def _normalize_train_list(
        self,
        trains: List[Dict[str, Any]],
        queried_src: str,
        queried_dest: str,
        doj: str
    ) -> List[Dict[str, Any]]:
        normalized = []
        for t in trains:
            tno = t.get("trainNumber") or t.get("TrainNo")
            tname = t.get("trainName") or t.get("TrainName")
            if not tno:
                continue

            # Parse availability per class
            raw_cache = t.get("avaiblitycache") or {}
            class_availability = {}

            for cls_code, cinfo in raw_cache.items():
                if not isinstance(cinfo, dict):
                    continue
                raw_status = cinfo.get("Availability") or ""
                prediction = cinfo.get("Prediction") or ""
                fare = cinfo.get("Fare") or ""

                is_avail = False
                is_rac = False
                is_wl = False
                is_regret = False

                upper_status = raw_status.upper().strip()

                if "AVAILABLE" in upper_status or "CURR_AVBL" in upper_status:
                    if not upper_status.startswith("NOT"):
                        is_avail = True
                elif "RAC" in upper_status:
                    is_rac = True
                elif "REGRET" in upper_status or "NOT AVAILABLE" in upper_status:
                    is_regret = True
                elif "WL" in upper_status:
                    is_wl = True

                class_availability[cls_code] = {
                    "raw_status": raw_status,
                    "prediction": prediction,
                    "fare": fare,
                    "is_available": is_avail,
                    "is_rac": is_rac,
                    "is_waitlist": is_wl,
                    "is_regret": is_regret
                }

            normalized.append({
                "train_number": str(tno),
                "train_name": str(tname),
                "from_station": t.get("fromStnCode") or queried_src,
                "to_station": t.get("toStnCode") or queried_dest,
                "departure_time": t.get("departureTime", "00:00"),
                "arrival_time": t.get("arrivalTime", "00:00"),
                "duration": t.get("duration", "0h 0m"),
                "distance": t.get("distance", 0),
                "doj": doj,
                "availability": class_availability
            })

        return normalized
