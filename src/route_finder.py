"""
Intelligent Multi-Hop Routing Engine for IRCTC.
Finds Direct and 1-Transfer itineraries across all corridors (Southbound & Northern Fallbacks),
calculating exact layovers, total fares per class, transfer risk, and detour metrics.
"""

import datetime
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from src.client import TrainLiveClient
from src.config import (
    ALL_TRANSIT_HUBS,
    CITY_STATION_CLUSTERS,
    CROSS_STATION_MAX_BUFFER_MINS,
    CROSS_STATION_MIN_BUFFER_MINS,
    DESTINATION_CLUSTER,
    HUB_CORRIDORS,
    ORIGIN_CLUSTER,
    PRIMARY_SOUTHBOUND_HUBS,
    SAME_STATION_MAX_BUFFER_MINS,
    SAME_STATION_MIN_BUFFER_MINS,
    SEARCH_QUOTA,
    STATION_LATITUDES,
)

logger = logging.getLogger("IrctcAgent.RouteFinder")


def parse_duration_to_minutes(dur_str: str) -> int:
    """Parse duration strings like '18h 45m', '8h', '45m' into integer minutes."""
    if not dur_str:
        return 0
    hours = 0
    minutes = 0
    h_match = re.search(r"(\d+)\s*h", dur_str, re.IGNORECASE)
    m_match = re.search(r"(\d+)\s*m", dur_str, re.IGNORECASE)
    if h_match:
        hours = int(h_match.group(1))
    if m_match:
        minutes = int(m_match.group(1))
    if not h_match and not m_match:
        colon_match = re.match(r"^(\d{1,2}):(\d{2})$", dur_str.strip())
        if colon_match:
            hours = int(colon_match.group(1))
            minutes = int(colon_match.group(2))
    return hours * 60 + minutes


def safe_int_fare(raw_fare: Any) -> int:
    """Safely converts fare string/int to int, default 0."""
    if not raw_fare:
        return 0
    try:
        clean = re.sub(r"[^\d]", "", str(raw_fare))
        return int(clean) if clean else 0
    except Exception:
        return 0


@dataclass
class TrainLeg:
    train_number: str
    train_name: str
    from_station: str
    to_station: str
    dep_datetime: datetime.datetime
    arr_datetime: datetime.datetime
    duration_str: str
    availability: Dict[str, Dict[str, Any]]
    fares_by_class: Dict[str, int] = field(default_factory=dict)

    @property
    def dep_time_formatted(self) -> str:
        return self.dep_datetime.strftime("%d-%b %H:%M")

    @property
    def arr_time_formatted(self) -> str:
        return self.arr_datetime.strftime("%d-%b %H:%M")


@dataclass
class Itinerary:
    itinerary_id: str
    route_type: str  # "DIRECT" or "1_TRANSFER"
    origin: str
    destination: str
    transit_hub: Optional[str]
    corridor: str
    is_northern_detour: bool
    legs: List[TrainLeg]
    layover_minutes: int
    total_duration_minutes: int
    transfer_type: str = "Direct"
    layover_risk: str = "None"
    fares_by_class: Dict[str, int] = field(default_factory=dict)
    best_fare: int = 0
    best_fare_class: str = "None"
    score: float = 0.0
    recommendation_rank: int = 0
    viable_classes: List[str] = field(default_factory=list)
    status_summary: str = ""

    @property
    def total_duration_str(self) -> str:
        h = self.total_duration_minutes // 60
        m = self.total_duration_minutes % 60
        return f"{h}h {m:02d}m"

    @property
    def layover_str(self) -> str:
        if self.layover_minutes <= 0:
            return "None (Direct)"
        h = self.layover_minutes // 60
        m = self.layover_minutes % 60
        return f"{h}h {m:02d}m"


class SmartRouteFinder:
    """
    Finds direct and 1-transfer routes heading southwards (plus northern fallbacks),
    computing layover buffer feasibility and combined fares per class.
    """

    def __init__(self, client: TrainLiveClient):
        self.client = client

    def are_stations_in_same_cluster(self, stn1: str, stn2: str) -> bool:
        if stn1 == stn2:
            return True
        for cluster in CITY_STATION_CLUSTERS.values():
            if stn1 in cluster and stn2 in cluster:
                return True
        return False

    async def search_direct_routes(
        self, start_date: datetime.date, end_date: datetime.date
    ) -> List[Itinerary]:
        """Search all direct trains from Jodhpur cluster to Bengaluru cluster."""
        itineraries = []
        curr_date = start_date
        seen_train_date = set()

        while curr_date <= end_date:
            date_str = curr_date.strftime("%d-%m-%Y")
            for src in ORIGIN_CLUSTER.keys():
                for dst in DESTINATION_CLUSTER.keys():
                    trains = await self.client.fetch_trains_between_stations(
                        src, dst, date_str, quota=SEARCH_QUOTA
                    )
                    for t in trains:
                        tno = t["train_number"]
                        td_key = (tno, date_str)
                        if td_key in seen_train_date:
                            continue
                        seen_train_date.add(td_key)

                        dur_min = parse_duration_to_minutes(t["duration"])
                        dep_dt = datetime.datetime.strptime(
                            f"{date_str} {t['departure_time']}", "%d-%m-%Y %H:%M"
                        )
                        arr_dt = dep_dt + datetime.timedelta(minutes=dur_min)

                        # Extract fares per class
                        leg_fares = {}
                        for cls, cinfo in t["availability"].items():
                            f = safe_int_fare(cinfo.get("fare"))
                            if f > 0:
                                leg_fares[cls] = f

                        leg = TrainLeg(
                            train_number=t["train_number"],
                            train_name=t["train_name"],
                            from_station=t["from_station"],
                            to_station=t["to_station"],
                            dep_datetime=dep_dt,
                            arr_datetime=arr_dt,
                            duration_str=t["duration"],
                            availability=t["availability"],
                            fares_by_class=leg_fares,
                        )

                        itin = Itinerary(
                            itinerary_id=f"DIR-{tno}-{date_str}",
                            route_type="DIRECT",
                            origin=leg.from_station,
                            destination=leg.to_station,
                            transit_hub=None,
                            corridor="Direct Line",
                            is_northern_detour=False,
                            legs=[leg],
                            layover_minutes=0,
                            total_duration_minutes=dur_min,
                            transfer_type="Direct Journey",
                            layover_risk="None",
                            fares_by_class=leg_fares,
                            best_fare=min(leg_fares.values()) if leg_fares else 0,
                            best_fare_class=min(leg_fares, key=leg_fares.get) if leg_fares else "None",
                        )
                        itineraries.append(itin)

            curr_date += datetime.timedelta(days=1)

        return itineraries

    async def search_one_transfer_routes(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
        hubs: Optional[List[str]] = None,
    ) -> List[Itinerary]:
        """
        Search 1-transfer routes from Jodhpur to Bengaluru across all specified hubs.
        Northern hubs (Delhi, Jaipur) are evaluated and flagged as detours rather than excluded.
        """
        if hubs is None:
            hubs = PRIMARY_SOUTHBOUND_HUBS

        ju_lat = STATION_LATITUDES["JU"]
        itineraries = []
        curr_date = start_date
        seen_combos = set()

        while curr_date <= end_date:
            dep_date_str = curr_date.strftime("%d-%m-%Y")

            for hub in hubs:
                hub_lat = STATION_LATITUDES.get(hub, 20.0)
                is_detour = hub_lat > (ju_lat + 0.2)
                corridor = HUB_CORRIDORS.get(hub, "Connecting Corridor")

                # Leg 1: Jodhpur Cluster -> Hub
                leg1_trains = []
                for src in ORIGIN_CLUSTER.keys():
                    res = await self.client.fetch_trains_between_stations(
                        src, hub, dep_date_str, quota=SEARCH_QUOTA
                    )
                    leg1_trains.extend(res)

                for t1 in leg1_trains:
                    # Filter: Leg 1 must have at least one viable seat (Available, RAC, or WL with prediction)
                    has_viable_t1 = any(
                        cinfo["is_available"] or cinfo["is_rac"] or (cinfo["is_waitlist"] and "Chance" in cinfo.get("prediction", ""))
                        for cinfo in t1["availability"].values()
                    )
                    if not has_viable_t1:
                        continue

                    # Leg 1 timing
                    dep1_dt = datetime.datetime.strptime(
                        f"{dep_date_str} {t1['departure_time']}", "%d-%m-%Y %H:%M"
                    )
                    dur1_min = parse_duration_to_minutes(t1["duration"])
                    arr1_dt = dep1_dt + datetime.timedelta(minutes=dur1_min)

                    # Determine search dates for Leg 2 (arrival date and next day)
                    leg2_dates = {
                        arr1_dt.strftime("%d-%m-%Y"),
                        (arr1_dt + datetime.timedelta(days=1)).strftime("%d-%m-%Y"),
                    }

                    # Leg 2: Hub -> Bengaluru Cluster
                    leg2_trains = []
                    for l2_date in leg2_dates:
                        for dst in DESTINATION_CLUSTER.keys():
                            res2 = await self.client.fetch_trains_between_stations(
                                hub, dst, l2_date, quota=SEARCH_QUOTA
                            )
                            leg2_trains.extend(res2)

                    for t2 in leg2_trains:
                        has_viable_t2 = any(
                            cinfo["is_available"] or cinfo["is_rac"] or (cinfo["is_waitlist"] and "Chance" in cinfo.get("prediction", ""))
                            for cinfo in t2["availability"].values()
                        )
                        if not has_viable_t2:
                            continue

                        dep2_dt = datetime.datetime.strptime(
                            f"{t2['doj']} {t2['departure_time']}", "%d-%m-%Y %H:%M"
                        )
                        dur2_min = parse_duration_to_minutes(t2["duration"])
                        arr2_dt = dep2_dt + datetime.timedelta(minutes=dur2_min)

                        # Calculate layover buffer
                        layover_min = int((dep2_dt - arr1_dt).total_seconds() / 60)

                        same_station = (t1["to_station"] == t2["from_station"])
                        same_cluster = self.are_stations_in_same_cluster(
                            t1["to_station"], t2["from_station"]
                        )

                        if not same_cluster:
                            continue

                        # Layover buffer validation
                        if same_station:
                            if not (SAME_STATION_MIN_BUFFER_MINS <= layover_min <= SAME_STATION_MAX_BUFFER_MINS):
                                continue
                            transfer_type = f"Same Station Transfer ({t1['to_station']})"
                        else:
                            if not (CROSS_STATION_MIN_BUFFER_MINS <= layover_min <= CROSS_STATION_MAX_BUFFER_MINS):
                                continue
                            transfer_type = f"Cross-City Transfer ({t1['to_station']} \u2192 {t2['from_station']})"

                        # Layover comfort risk
                        if layover_min < 120:
                            layover_risk = "Tight Buffer (Train delay risk)"
                        elif layover_min > 420:
                            layover_risk = "Long Layover (>7 hrs wait)"
                        else:
                            layover_risk = "Comfortable Layover"

                        combo_key = (
                            t1["train_number"],
                            dep_date_str,
                            hub,
                            t2["train_number"],
                            t2["doj"],
                        )
                        if combo_key in seen_combos:
                            continue
                        seen_combos.add(combo_key)

                        # Extract fares
                        leg1_fares = {cls: safe_int_fare(c.get("fare")) for cls, c in t1["availability"].items() if safe_int_fare(c.get("fare")) > 0}
                        leg2_fares = {cls: safe_int_fare(c.get("fare")) for cls, c in t2["availability"].items() if safe_int_fare(c.get("fare")) > 0}

                        # Combined fares for matching classes
                        combined_fares = {}
                        for cls in ["3A", "2A", "SL", "3E", "1A", "CC"]:
                            if cls in leg1_fares and cls in leg2_fares:
                                combined_fares[cls] = leg1_fares[cls] + leg2_fares[cls]

                        # If no exact class match, calculate lowest across available classes
                        best_fare = min(combined_fares.values()) if combined_fares else (
                            (min(leg1_fares.values()) if leg1_fares else 0) + (min(leg2_fares.values()) if leg2_fares else 0)
                        )
                        best_fare_class = min(combined_fares, key=combined_fares.get) if combined_fares else "Mixed Class"

                        leg1 = TrainLeg(
                            train_number=t1["train_number"],
                            train_name=t1["train_name"],
                            from_station=t1["from_station"],
                            to_station=t1["to_station"],
                            dep_datetime=dep1_dt,
                            arr_datetime=arr1_dt,
                            duration_str=t1["duration"],
                            availability=t1["availability"],
                            fares_by_class=leg1_fares,
                        )
                        leg2 = TrainLeg(
                            train_number=t2["train_number"],
                            train_name=t2["train_name"],
                            from_station=t2["from_station"],
                            to_station=t2["to_station"],
                            dep_datetime=dep2_dt,
                            arr_datetime=arr2_dt,
                            duration_str=t2["duration"],
                            availability=t2["availability"],
                            fares_by_class=leg2_fares,
                        )

                        total_journey_min = dur1_min + layover_min + dur2_min

                        itin = Itinerary(
                            itinerary_id=f"CONN-{hub}-{t1['train_number']}-{t2['train_number']}",
                            route_type="1_TRANSFER",
                            origin=leg1.from_station,
                            destination=leg2.to_station,
                            transit_hub=hub,
                            corridor=corridor,
                            is_northern_detour=is_detour,
                            legs=[leg1, leg2],
                            layover_minutes=layover_min,
                            total_duration_minutes=total_journey_min,
                            transfer_type=transfer_type,
                            layover_risk=layover_risk,
                            fares_by_class=combined_fares,
                            best_fare=best_fare,
                            best_fare_class=best_fare_class,
                        )
                        itineraries.append(itin)

            curr_date += datetime.timedelta(days=1)

        return itineraries
