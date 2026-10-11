"""
Comprehensive Indian Railways Stations Database and Autocomplete Engine.
Contains coordinates, city clusters, state info, and geographic distance calculations.
"""

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class Station:
    code: str
    name: str
    city: str
    state: str
    lat: float
    lon: float
    cluster_id: Optional[str] = None
    is_major_junction: bool = False


# Multi-station metropolitan city clusters in Indian Railways
CITY_CLUSTERS: Dict[str, Dict[str, any]] = {
    "DELHI": {
        "name": "Delhi NCR (All Stations)",
        "stations": ["NDLS", "DLI", "NZM", "ANVT", "DEE", "DEC"],
        "primary": "NDLS"
    },
    "MUMBAI": {
        "name": "Mumbai (All Terminals)",
        "stations": ["CSMT", "BDTS", "LTT", "MMCT", "BSR", "PNVL", "KYN", "DR"],
        "primary": "CSMT"
    },
    "BENGALURU": {
        "name": "Bengaluru (All Terminals)",
        "stations": ["SBC", "YPR", "SMVB", "BNC", "BAND", "KGI"],
        "primary": "SBC"
    },
    "KOLKATA": {
        "name": "Kolkata (All Terminals)",
        "stations": ["HWH", "SDAH", "KOAA", "SHM", "SRC"],
        "primary": "HWH"
    },
    "CHENNAI": {
        "name": "Chennai (All Terminals)",
        "stations": ["MAS", "MS", "TBM", "PER"],
        "primary": "MAS"
    },
    "HYDERABAD": {
        "name": "Hyderabad / Secunderabad",
        "stations": ["SC", "KCG", "HYB", "LPI"],
        "primary": "SC"
    },
    "AHMEDABAD": {
        "name": "Ahmedabad / Sabarmati",
        "stations": ["ADI", "SBT", "GER"],
        "primary": "ADI"
    },
    "PUNE": {
        "name": "Pune Area",
        "stations": ["PUNE", "HDP", "SVJR"],
        "primary": "PUNE"
    },
    "JAIPUR": {
        "name": "Jaipur Area",
        "stations": ["JP", "GADJ", "DPA"],
        "primary": "JP"
    },
    "LUCKNOW": {
        "name": "Lucknow Area",
        "stations": ["LKO", "LJN", "ASH"],
        "primary": "LKO"
    },
    "KANPUR": {
        "name": "Kanpur Area",
        "stations": ["CNB", "CPA"],
        "primary": "CNB"
    },
    "PATNA": {
        "name": "Patna Area",
        "stations": ["PNBE", "PPTA", "DNR", "RJPB"],
        "primary": "PNBE"
    },
    "VARANASI": {
        "name": "Varanasi / Pt. Deen Dayal Upadhyay",
        "stations": ["BSB", "BSBS", "DDU"],
        "primary": "BSB"
    },
    "JODHPUR": {
        "name": "Jodhpur / Bhagat Ki Kothi",
        "stations": ["JU", "BGKT"],
        "primary": "JU"
    },
    "BHOPAL": {
        "name": "Bhopal / Rani Kamalapati",
        "stations": ["BPL", "RKMP", "HBJ"],
        "primary": "BPL"
    }
}

# Major Railway Stations across all Indian states and railway zones
STATIONS_DATA: List[Station] = [
    # Delhi NCR
    Station("NDLS", "New Delhi", "Delhi", "Delhi", 28.6143, 77.2188, "DELHI", True),
    Station("DLI", "Old Delhi Junction", "Delhi", "Delhi", 28.6619, 77.2280, "DELHI", True),
    Station("NZM", "Hazrat Nizamuddin", "Delhi", "Delhi", 28.5888, 77.2534, "DELHI", True),
    Station("ANVT", "Anand Vihar Terminal", "Delhi", "Delhi", 28.6508, 77.3152, "DELHI", True),
    Station("DEE", "Delhi Sarai Rohilla", "Delhi", "Delhi", 28.6644, 77.1856, "DELHI", False),

    # Mumbai
    Station("CSMT", "Chhatrapati Shivaji Maharaj Terminus", "Mumbai", "Maharashtra", 18.9402, 72.8356, "MUMBAI", True),
    Station("MMCT", "Mumbai Central", "Mumbai", "Maharashtra", 18.9696, 72.8194, "MUMBAI", True),
    Station("BDTS", "Bandra Terminus", "Mumbai", "Maharashtra", 19.0596, 72.8406, "MUMBAI", True),
    Station("LTT", "Lokmanya Tilak Terminus", "Mumbai", "Maharashtra", 19.0697, 72.8914, "MUMBAI", True),
    Station("BSR", "Vasai Road", "Mumbai", "Maharashtra", 19.3813, 72.8311, "MUMBAI", True),
    Station("PNVL", "Panvel Junction", "Mumbai", "Maharashtra", 18.9902, 73.1168, "MUMBAI", True),
    Station("KYN", "Kalyan Junction", "Mumbai", "Maharashtra", 19.2437, 73.1355, "MUMBAI", True),
    Station("DR", "Dadar", "Mumbai", "Maharashtra", 19.0178, 72.8478, "MUMBAI", True),

    # Bengaluru
    Station("SBC", "KSR Bengaluru City Junction", "Bengaluru", "Karnataka", 12.9781, 77.5695, "BENGALURU", True),
    Station("YPR", "Yesvantpur Junction", "Bengaluru", "Karnataka", 13.0238, 77.5501, "BENGALURU", True),
    Station("SMVB", "Sir M. Visvesvaraya Terminal", "Bengaluru", "Karnataka", 12.9926, 77.6534, "BENGALURU", True),
    Station("BNC", "Bengaluru Cantt", "Bengaluru", "Karnataka", 12.9934, 77.5982, "BENGALURU", False),
    Station("BAND", "Banaswadi", "Bengaluru", "Karnataka", 13.0084, 77.6433, "BENGALURU", False),
    Station("KGI", "Kengeri", "Bengaluru", "Karnataka", 12.9124, 77.4831, "BENGALURU", False),

    # Kolkata
    Station("HWH", "Howrah Junction", "Kolkata", "West Bengal", 22.5838, 88.3426, "KOLKATA", True),
    Station("SDAH", "Sealdah", "Kolkata", "West Bengal", 22.5697, 88.3712, "KOLKATA", True),
    Station("KOAA", "Kolkata Chitpur", "Kolkata", "West Bengal", 22.6033, 88.3744, "KOLKATA", True),
    Station("SHM", "Shalimar", "Kolkata", "West Bengal", 22.5574, 88.3182, "KOLKATA", False),
    Station("SRC", "Santragachi Junction", "Kolkata", "West Bengal", 22.5796, 88.2796, "KOLKATA", True),

    # Chennai
    Station("MAS", "MGR Chennai Central", "Chennai", "Tamil Nadu", 13.0827, 80.2707, "CHENNAI", True),
    Station("MS", "Chennai Egmore", "Chennai", "Tamil Nadu", 13.0782, 80.2612, "CHENNAI", True),
    Station("TBM", "Tambaram", "Chennai", "Tamil Nadu", 12.9249, 80.1200, "CHENNAI", True),

    # Hyderabad / Secunderabad
    Station("SC", "Secunderabad Junction", "Hyderabad", "Telangana", 17.4344, 78.5011, "HYDERABAD", True),
    Station("KCG", "Kacheguda", "Hyderabad", "Telangana", 17.3888, 78.4984, "HYDERABAD", True),
    Station("HYB", "Hyderabad Deccan (Nampally)", "Hyderabad", "Telangana", 17.3916, 78.4682, "HYDERABAD", True),

    # Gujarat
    Station("ADI", "Ahmedabad Junction", "Ahmedabad", "Gujarat", 23.0225, 72.5714, "AHMEDABAD", True),
    Station("SBT", "Sabarmati Junction", "Ahmedabad", "Gujarat", 23.0818, 72.5855, "AHMEDABAD", False),
    Station("BRC", "Vadodara Junction", "Vadodara", "Gujarat", 22.3107, 73.1812, "VADODARA", True),
    Station("ST", "Surat", "Surat", "Gujarat", 21.2049, 72.8406, "SURAT", True),
    Station("RTM", "Ratlam Junction", "Ratlam", "Madhya Pradesh", 23.3315, 75.0367, None, True),
    Station("UJN", "Ujjain Junction", "Ujjain", "Madhya Pradesh", 23.1765, 75.7885, None, True),
    Station("INDB", "Indore Junction", "Indore", "Madhya Pradesh", 22.7196, 75.8577, None, True),

    # Rajasthan
    Station("JU", "Jodhpur Junction", "Jodhpur", "Rajasthan", 26.2918, 73.0169, "JODHPUR", True),
    Station("BGKT", "Bhagat Ki Kothi", "Jodhpur", "Rajasthan", 26.2514, 73.0118, "JODHPUR", True),
    Station("JP", "Jaipur Junction", "Jaipur", "Rajasthan", 26.9196, 75.7878, "JAIPUR", True),
    Station("AII", "Ajmer Junction", "Ajmer", "Rajasthan", 26.4499, 74.6399, None, True),
    Station("KOTA", "Kota Junction", "Kota", "Rajasthan", 25.2138, 75.8648, "KOTA", True),
    Station("BKN", "Bikaner Junction", "Bikaner", "Rajasthan", 28.0229, 73.3119, None, True),
    Station("ABR", "Abu Road", "Abu Road", "Rajasthan", 24.4826, 72.7797, None, True),

    # Maharashtra & Goa
    Station("PUNE", "Pune Junction", "Pune", "Maharashtra", 18.5289, 73.8744, "PUNE", True),
    Station("SUR", "Solapur", "Solapur", "Maharashtra", 17.6599, 75.9064, None, True),
    Station("BSL", "Bhusaval Junction", "Bhusawal", "Maharashtra", 21.0455, 75.7885, None, True),
    Station("MMR", "Manmad Junction", "Manmad", "Maharashtra", 20.2544, 74.4411, None, True),
    Station("NGP", "Nagpur Junction", "Nagpur", "Maharashtra", 21.1524, 79.0888, "NAGPUR", True),
    Station("MAO", "Madgaon Junction (Goa)", "Madgaon", "Goa", 15.2736, 73.9582, None, True),

    # Karnataka
    Station("UBL", "SSS Hubballi Junction", "Hubballi", "Karnataka", 15.3647, 75.1240, "HUBBALLI", True),
    Station("BGM", "Belagavi", "Belagavi", "Karnataka", 15.8497, 74.4977, None, True),
    Station("MAQ", "Mangaluru Central", "Mangaluru", "Karnataka", 12.8631, 74.8427, None, True),
    Station("MYS", "Mysuru Junction", "Mysuru", "Karnataka", 12.3160, 76.6465, None, True),
    Station("GTL", "Guntakal Junction", "Guntakal", "Andhra Pradesh", 15.1741, 77.3755, None, True),

    # Madhya Pradesh
    Station("BPL", "Bhopal Junction", "Bhopal", "Madhya Pradesh", 23.2687, 77.4126, "BHOPAL", True),
    Station("RKMP", "Rani Kamalapati", "Bhopal", "Madhya Pradesh", 23.2144, 77.4389, "BHOPAL", True),
    Station("ET", "Itarsi Junction", "Itarsi", "Madhya Pradesh", 21.7483, 77.7554, None, True),
    Station("JBP", "Jabalpur", "Jabalpur", "Madhya Pradesh", 23.1815, 79.9864, None, True),
    Station("GWL", "Gwalior Junction", "Gwalior", "Madhya Pradesh", 26.2183, 78.1828, None, True),

    # Uttar Pradesh & Bihar
    Station("CNB", "Kanpur Central", "Kanpur", "Uttar Pradesh", 26.4547, 80.3507, "KANPUR", True),
    Station("LKO", "Lucknow Charbagh NR", "Lucknow", "Uttar Pradesh", 26.8322, 80.9234, "LUCKNOW", True),
    Station("PRYJ", "Prayagraj Junction (Allahabad)", "Prayagraj", "Uttar Pradesh", 25.4484, 81.8340, None, True),
    Station("BSB", "Varanasi Junction", "Varanasi", "Uttar Pradesh", 25.3283, 82.9868, "VARANASI", True),
    Station("DDU", "Pt. Deen Dayal Upadhyay (Mughalsarai)", "Mughalsarai", "Uttar Pradesh", 25.2818, 83.1167, "VARANASI", True),
    Station("GKP", "Gorakhpur Junction", "Gorakhpur", "Uttar Pradesh", 26.7606, 83.3732, None, True),
    Station("AGC", "Agra Cantt", "Agra", "Uttar Pradesh", 27.1592, 78.0069, None, True),
    Station("MTJ", "Mathura Junction", "Mathura", "Uttar Pradesh", 27.4924, 77.6737, None, True),
    Station("PNBE", "Patna Junction", "Patna", "Bihar", 25.6022, 85.1376, "PATNA", True),
    Station("GAYA", "Gaya Junction", "Gaya", "Bihar", 24.8020, 84.9995, None, True),

    # Andhra Pradesh & Telangana
    Station("BZA", "Vijayawada Junction", "Vijayawada", "Andhra Pradesh", 16.5186, 80.6200, None, True),
    Station("VSKP", "Visakhapatnam Junction", "Visakhapatnam", "Andhra Pradesh", 17.7212, 83.2872, None, True),
    Station("WL", "Warangal", "Warangal", "Telangana", 17.9689, 79.5941, None, True),
    Station("KZJ", "Kazipet Junction", "Kazipet", "Telangana", 17.9793, 79.5204, None, True),
    Station("RU", "Renigunta Junction", "Tirupati", "Andhra Pradesh", 13.6392, 79.5180, None, True),
    Station("TPTY", "Tirupati", "Tirupati", "Andhra Pradesh", 13.6288, 79.4192, None, True),

    # Tamil Nadu & Kerala
    Station("CBE", "Coimbatore Junction", "Coimbatore", "Tamil Nadu", 11.0016, 76.9628, None, True),
    Station("MDU", "Madurai Junction", "Madurai", "Tamil Nadu", 9.9195, 78.1130, None, True),
    Station("TPJ", "Tiruchchirappalli Junction", "Trichy", "Tamil Nadu", 10.7905, 78.6886, None, True),
    Station("ED", "Erode Junction", "Erode", "Tamil Nadu", 11.3410, 77.7172, None, True),
    Station("SA", "Salem Junction", "Salem", "Tamil Nadu", 11.6643, 78.1460, None, True),
    Station("ERS", "Ernakulam Junction (South)", "Kochi", "Kerala", 9.9676, 76.2917, None, True),
    Station("TVC", "Thiruvananthapuram Central", "Trivandrum", "Kerala", 8.4875, 76.9531, None, True),
    Station("CLT", "Kozhikode (Calicut)", "Kozhikode", "Kerala", 11.2480, 75.7839, None, True),

    # Punjab, Haryana & J&K
    Station("ASR", "Amritsar Junction", "Amritsar", "Punjab", 31.6340, 74.8723, None, True),
    Station("CDG", "Chandigarh", "Chandigarh", "Chandigarh", 30.7027, 76.8193, None, True),
    Station("UMB", "Ambala Cantt Junction", "Ambala", "Haryana", 30.3441, 76.8290, None, True),
    Station("JAT", "Jammu Tawi", "Jammu", "Jammu and Kashmir", 32.7060, 74.8785, None, True),
    Station("SVDK", "Shri Mata Vaishno Devi Katra", "Katra", "Jammu and Kashmir", 32.9912, 74.9317, None, True),

    # Odisha, Chhattisgarh & North East
    Station("BBS", "Bhubaneswar", "Bhubaneswar", "Odisha", 20.2668, 85.8436, None, True),
    Station("PURI", "Puri", "Puri", "Odisha", 19.8135, 85.8312, None, True),
    Station("R", "Raipur Junction", "Raipur", "Chhattisgarh", 21.2514, 81.6296, None, True),
    Station("BSP", "Bilaspur Junction", "Bilaspur", "Chhattisgarh", 22.0797, 82.1409, None, True),
    Station("GHY", "Guwahati", "Guwahati", "Assam", 26.1824, 91.7516, None, True),
]

STATIONS_BY_CODE: Dict[str, Station] = {s.code: s for s in STATIONS_DATA}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    return 2.0 * R * math.asin(math.sqrt(a))


def search_stations(query: str, limit: int = 10) -> List[Dict[str, any]]:
    """
    Autocomplete search for railway stations by code, station name, or city.
    """
    q = query.strip().upper()
    if not q:
        return []

    exact_matches = []
    prefix_code_matches = []
    name_matches = []
    city_matches = []

    for s in STATIONS_DATA:
        code_upper = s.code.upper()
        name_upper = s.name.upper()
        city_upper = s.city.upper()

        if code_upper == q:
            exact_matches.append(s)
        elif code_upper.startswith(q):
            prefix_code_matches.append(s)
        elif q in name_upper:
            name_matches.append(s)
        elif q in city_upper:
            city_matches.append(s)

    combined = exact_matches + prefix_code_matches + name_matches + city_matches
    seen = set()
    results = []
    for s in combined:
        if s.code not in seen:
            seen.add(s.code)
            results.append({
                "code": s.code,
                "name": s.name,
                "city": s.city,
                "state": s.state,
                "cluster": s.cluster_id,
                "is_junction": s.is_major_junction
            })
            if len(results) >= limit:
                break
    return results


def get_cluster_station_codes(stn_code: str) -> List[str]:
    """
    Given a station code, returns all station codes in its city cluster,
    or just [stn_code] if not part of a cluster.
    """
    stn = STATIONS_BY_CODE.get(stn_code)
    if not stn or not stn.cluster_id:
        return [stn_code]

    cluster = CITY_CLUSTERS.get(stn.cluster_id)
    if not cluster:
        return [stn_code]

    # Return primary station first, then others
    stations = cluster["stations"]
    res = [stn_code] + [s for s in stations if s != stn_code]
    return res
