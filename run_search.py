"""
Executable Runner for the IRCTC Smart Route & Live Seat Availability Engine.
Scans 10 Nov - 16 Nov 2026 for Jodhpur to Bengaluru journeys across all candidate hubs,
calculating fares, directional scores, and saving comprehensive structured outputs.
"""

import argparse
import asyncio
import datetime
import json
import os

from src.client import TrainLiveClient
from src.config import PRIMARY_SOUTHBOUND_HUBS, SEARCH_QUOTA
from src.route_finder import SmartRouteFinder
from src.scorer import RouteScorer


async def run_live_search(start_date_str: str = "10-11-2026", end_date_str: str = "16-11-2026", hubs: list = None):
    print("=" * 80)
    print(" IRCTC LIVE SMART ROUTE & SEAT AVAILABILITY FINDER")
    print(f" Route: JODHPUR (JU / BGKT) -> BENGALURU (SBC / YPR / SMVB)")
    print(f" Departure Window: {start_date_str} to {end_date_str}")
    print(f" Quota: {SEARCH_QUOTA} (General Quota)")
    print(" Corridors: Deccan/Hyderabad, Western, Central, and Northern Detours")
    print("=" * 80)

    d1, m1, y1 = map(int, start_date_str.split("-"))
    d2, m2, y2 = map(int, end_date_str.split("-"))
    start_date = datetime.date(y1, m1, d1)
    end_date = datetime.date(y2, m2, d2)

    client = TrainLiveClient()
    finder = SmartRouteFinder(client)

    print("\n[*] Phase 1: Fetching live status for all DIRECT trains...")
    direct_itineraries = await finder.search_direct_routes(start_date, end_date)
    print(f"    Found {len(direct_itineraries)} direct train departures across the window.")

    print("\n[*] Phase 2: Fetching live status for 1-TRANSFER connections...")
    active_hubs = hubs or PRIMARY_SOUTHBOUND_HUBS
    print(f"    Scanning hubs: {', '.join(active_hubs)}")
    transfer_itineraries = await finder.search_one_transfer_routes(start_date, end_date, active_hubs)
    print(f"    Found {len(transfer_itineraries)} valid 1-transfer connections with viable seats.")

    all_itineraries = direct_itineraries + transfer_itineraries
    ranked_itineraries = RouteScorer.evaluate_and_rank(all_itineraries)

    # Count confirmed
    confirmed_count = 0
    for itin in ranked_itineraries:
        if all(any(cinfo["is_available"] for cinfo in leg.availability.values()) for leg in itin.legs):
            confirmed_count += 1

    lowest_fare = 99999
    for itin in ranked_itineraries:
        if itin.best_fare > 0 and itin.best_fare < lowest_fare:
            lowest_fare = itin.best_fare

    print(f"\n[*] Total Evaluated: {len(all_itineraries)} | 100% Confirmed Routes: {confirmed_count} | Lowest Fare: ₹{lowest_fare}")

    # Prepare structured JSON export
    export_routes = []
    for rank_idx, itin in enumerate(ranked_itineraries[:100], start=1):
        export_routes.append({
            "id": itin.itinerary_id,
            "rank": rank_idx,
            "score": itin.score,
            "type": itin.route_type,
            "origin": itin.origin,
            "destination": itin.destination,
            "hub": itin.transit_hub or "Direct",
            "corridor": itin.corridor,
            "is_northern_detour": itin.is_northern_detour,
            "transfer_type": itin.transfer_type,
            "layover_risk": itin.layover_risk,
            "layover_minutes": itin.layover_minutes,
            "total_duration_minutes": itin.total_duration_minutes,
            "best_fare": itin.best_fare,
            "best_fare_class": itin.best_fare_class,
            "fares_by_class": itin.fares_by_class,
            "summary": itin.status_summary,
            "legs": [
                {
                    "train_no": l.train_number,
                    "train_name": l.train_name,
                    "from": l.from_station,
                    "to": l.to_station,
                    "departure": l.dep_time_formatted,
                    "arrival": l.arr_time_formatted,
                    "duration": l.duration_str,
                    "seats": {
                        cls: cinfo["raw_status"]
                        for cls, cinfo in l.availability.items()
                        if cinfo.get("raw_status")
                    },
                    "fares": l.fares_by_class
                }
                for l in itin.legs
            ]
        })

    # Prepare direct trains summary
    direct_trains_summary = []
    for itin in direct_itineraries:
        leg = itin.legs[0]
        direct_trains_summary.append({
            "date": leg.dep_datetime.strftime("%d-%b-%Y"),
            "train_no": leg.train_number,
            "train_name": leg.train_name,
            "seats": {
                cls: cinfo["raw_status"]
                for cls, cinfo in leg.availability.items()
                if cinfo.get("raw_status")
            },
            "remark": "High Waitlist / Booking Closed. Connecting route recommended."
        })

    os.makedirs("outputs", exist_ok=True)
    full_output_data = {
        "generated_at": datetime.datetime.now().isoformat(),
        "total_evaluated": len(all_itineraries),
        "total_confirmed": confirmed_count,
        "lowest_fare": lowest_fare if lowest_fare < 99999 else 0,
        "direct_trains": direct_trains_summary,
        "routes": export_routes
    }

    with open("outputs/search_results.json", "w") as f:
        json.dump(full_output_data, f, indent=2)

    print("\n[+] Full dataset saved to outputs/search_results.json")
    return full_output_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IRCTC Smart Route Search")
    parser.add_argument("--start", default="10-11-2026", help="Start Date DD-MM-YYYY")
    parser.add_argument("--end", default="16-11-2026", help="End Date DD-MM-YYYY")
    parser.add_argument("--hubs", nargs="*", default=None, help="Custom transit hubs to check")
    args = parser.parse_args()

    asyncio.run(run_live_search(args.start, args.end, args.hubs))
