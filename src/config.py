"""
Configuration and metadata for the IRCTC Smart Route & Live Seat Availability Engine.
"""

from typing import Dict, List, Set

# Origin Cluster: Jodhpur and nearby stations
ORIGIN_CLUSTER = {
    "JU": "Jodhpur Junction",
    "BGKT": "Bhagat Ki Kothi (Jodhpur South, 4km)"
}

# Destination Cluster: Bengaluru and satellite terminals
DESTINATION_CLUSTER = {
    "SBC": "KSR Bengaluru City Junction",
    "YPR": "Yesvantpur Junction",
    "SMVB": "Sir M. Visvesvaraya Terminal (Baiyyappanahalli)",
    "BNC": "Bengaluru Cantt",
    "BAND": "Banaswadi"
}

# City station clusters for calculating transfer feasibility and cross-station transit
CITY_STATION_CLUSTERS: Dict[str, Set[str]] = {
    "JODHPUR": {"JU", "BGKT"},
    "BENGALURU": {"SBC", "YPR", "SMVB", "BNC", "BAND", "KGI"},
    "AHMEDABAD": {"ADI", "SBT", "GER"},
    "VADODARA": {"BRC"},
    "SURAT": {"ST"},
    "MUMBAI_METRO": {"BSR", "PNVL", "BDTS", "CSMT", "LTT", "KYN", "DR"},
    "PUNE": {"PUNE", "HDP"},
    "HYDERABAD": {"KCG", "SC", "HYB"},
    "BHOPAL": {"BPL", "RKMP", "HBJ"},
    "KOTA": {"KOTA"},
    "HUBBALLI": {"UBL"},
    "NAGPUR": {"NGP"},
    "DELHI": {"NDLS", "DLI", "NZM", "ANVT", "DEE"}  # Northern Detour
}

# Geographic latitudes (used for directional detour scoring)
# Jodhpur is at 26.29°N; Bengaluru is at 12.97°N.
STATION_LATITUDES: Dict[str, float] = {
    "JU": 26.29,
    "BGKT": 26.25,
    "NDLS": 28.61,  # North of Jodhpur -> DETOUR!
    "DLI": 28.66,   # North of Jodhpur -> DETOUR!
    "NZM": 28.58,   # North of Jodhpur -> DETOUR!
    "DEE": 28.66,   # North of Jodhpur -> DETOUR!
    "JP": 26.91,    # North-East of Jodhpur
    "KOTA": 25.18,  # South-East of Jodhpur
    "ADI": 23.02,   # South of Jodhpur
    "BRC": 22.30,   # South of Ahmedabad
    "BPL": 23.25,   # South of Kota
    "RKMP": 23.20,  # South of Bhopal
    "ST": 21.20,    # South of Vadodara
    "ET": 21.75,    # South of Bhopal
    "NGP": 21.14,   # South of Itarsi
    "BSR": 19.38,   # Vasai Road (Northern Mumbai)
    "BDTS": 19.05,  # Bandra
    "CSMT": 18.94,  # Mumbai CSMT
    "LTT": 19.07,   # Kurla LTT
    "KYN": 19.24,   # Kalyan
    "PNVL": 18.99,  # Panvel
    "PUNE": 18.52,  # Pune
    "SUR": 17.65,   # Solapur
    "KCG": 17.38,   # Kacheguda (Hyderabad)
    "SC": 17.43,    # Secunderabad
    "HYB": 17.39,   # Hyderabad Deccan
    "UBL": 15.36,   # Hubballi
    "GTL": 15.17,   # Guntakal
    "SBC": 12.97,   # Bengaluru City
    "YPR": 13.02,   # Yesvantpur
    "SMVB": 12.99,  # SMVB Bengaluru
    "BNC": 12.99,   # Bengaluru Cantt
    "KGI": 12.90    # Kengeri
}

# Corridor classification for transit hubs
HUB_CORRIDORS: Dict[str, str] = {
    # Southbound Deccan / Hyderabad
    "KCG": "Deccan / Hyderabad",
    "SC": "Deccan / Hyderabad",
    "HYB": "Deccan / Hyderabad",

    # Southbound Western / Coastal
    "ADI": "Western (Gujarat/Maharashtra)",
    "BRC": "Western (Gujarat/Maharashtra)",
    "ST": "Western (Gujarat/Maharashtra)",
    "BSR": "Western (Mumbai Outer Bypass)",
    "PNVL": "Western (Mumbai South Bypass)",
    "PUNE": "Western (Maharashtra/Pune)",
    "UBL": "Karnataka / Hubballi",

    # Central / MP
    "BPL": "Central (Madhya Pradesh)",
    "RKMP": "Central (Madhya Pradesh)",
    "KOTA": "Central (Rajasthan/Kota)",
    "ET": "Central (Itarsi)",
    "NGP": "Central (Nagpur)",

    # Northern Detours (Included but downranked)
    "NDLS": "Northern Detour (Delhi)",
    "NZM": "Northern Detour (Delhi)",
    "DLI": "Northern Detour (Delhi)",
    "DEE": "Northern Detour (Delhi)",
    "JP": "Northern Detour (Jaipur)"
}

# All Transit Hubs to inspect (inclusive of Northern Detours)
ALL_TRANSIT_HUBS = list(HUB_CORRIDORS.keys())

# Preferred Southbound Hubs (for fast sweeps)
PRIMARY_SOUTHBOUND_HUBS = [
    "KCG", "SC", "ADI", "BRC", "ST", "BSR", "PNVL", "PUNE", "BPL", "KOTA", "UBL", "NDLS", "NZM"
]

# Transfer Buffer Constraints (in minutes)
SAME_STATION_MIN_BUFFER_MINS = 90    # 1.5 hours (essential buffer for train delays)
SAME_STATION_MAX_BUFFER_MINS = 540   # 9.0 hours (reasonable wait time)

CROSS_STATION_MIN_BUFFER_MINS = 210  # 3.5 hours (needed for city transit e.g. BDTS to CSMT/LTT or KCG to SC)
CROSS_STATION_MAX_BUFFER_MINS = 660  # 11 hours

# Quota: General Quota only
SEARCH_QUOTA = "GN"

# Classes supported
ALLOWED_CLASSES = ["1A", "2A", "3A", "3E", "SL", "CC", "2S"]
