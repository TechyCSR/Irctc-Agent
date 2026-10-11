"""
Scoring and Ranking module for IRCTC Route Itineraries.
Prioritizes Confirmed/RAC seats on both legs, minimizes travel time and layover penalties,
applies detour penalties for Northern hubs (keeping them lower without exclusion),
and assigns explicit Recommendation #1, #2, #3 ranks.
"""

from typing import List, Tuple
from src.route_finder import Itinerary, TrainLeg


class RouteScorer:
    """
    Ranks train itineraries by:
    1. Seat Availability (Confirmed > RAC > High Chance WL > Deep WL)
    2. Southbound alignment (Northern detours penalised to appear lower)
    3. Route efficiency (Same-station transfer > Cross-city, Minimal travel duration)
    4. Layover comfort (Ideal 2 to 4.5 hours)
    """

    @staticmethod
    def score_leg_availability(leg: TrainLeg, preferred_class: str = None) -> Tuple[float, str, str]:
        best_score = -100.0
        best_cls = "None"
        best_desc = "No Seats"

        class_priority = ["3A", "2A", "SL", "3E", "1A", "CC", "2S"]
        if preferred_class and preferred_class in leg.availability:
            classes_to_check = [preferred_class] + [c for c in class_priority if c != preferred_class]
        else:
            classes_to_check = class_priority

        for cls in classes_to_check:
            if cls not in leg.availability:
                continue
            cinfo = leg.availability[cls]
            raw = cinfo.get("raw_status", "")
            pred = cinfo.get("prediction", "")
            fare_str = f" (\u20b9{leg.fares_by_class.get(cls, '')})" if cls in leg.fares_by_class else ""

            cls_score = 0.0
            if cinfo.get("is_available"):
                cls_score = 300.0  # Confirmed Seat
                desc = f"{cls} Confirmed [{raw}]{fare_str}"
            elif cinfo.get("is_rac"):
                cls_score = 220.0  # Guaranteed Boarding & Berth
                desc = f"{cls} RAC [{raw}]{fare_str}"
            elif cinfo.get("is_waitlist"):
                chance = 50
                if "%" in pred:
                    try:
                        chance = int(pred.split("%")[0].strip())
                    except Exception:
                        pass
                if chance >= 75:
                    cls_score = 120.0 + chance
                    desc = f"{cls} WL [{raw}, {pred}]{fare_str}"
                elif chance >= 50:
                    cls_score = 50.0 + chance
                    desc = f"{cls} WL [{raw}, {pred}]{fare_str}"
                else:
                    cls_score = 10.0
                    desc = f"{cls} Deep WL [{raw}]{fare_str}"
            elif cinfo.get("is_regret"):
                cls_score = -50.0
                desc = f"{cls} REGRET"
            else:
                cls_score = 0.0
                desc = f"{cls} {raw}{fare_str}"

            if cls_score > best_score:
                best_score = cls_score
                best_cls = cls
                best_desc = desc

        return best_score, best_cls, best_desc

    @classmethod
    def evaluate_and_rank(
        cls, itineraries: List[Itinerary], preferred_class: str = None
    ) -> List[Itinerary]:
        """Score each itinerary and sort in descending order of score, assigning ranks."""
        for itin in itineraries:
            score = 0.0
            summaries = []
            viable_classes = []

            if itin.route_type == "DIRECT":
                leg = itin.legs[0]
                leg_score, best_cls, desc = cls.score_leg_availability(leg, preferred_class)
                score += leg_score * 2.0  # Normalize to 2-leg scale

                # Direct train convenience bonus ONLY if seat is confirmed or RAC
                if leg_score >= 200.0:
                    score += 100.0

                summaries.append(f"Direct: {desc}")
                viable_classes.append(best_cls)

            else:  # 1_TRANSFER
                leg1 = itin.legs[0]
                leg2 = itin.legs[1]

                leg1_score, cls1, desc1 = cls.score_leg_availability(leg1, preferred_class)
                leg2_score, cls2, desc2 = cls.score_leg_availability(leg2, preferred_class)

                if leg1_score < 0 or leg2_score < 0:
                    score = -100.0
                else:
                    score += (leg1_score + leg2_score)

                    # Extra bonus if both legs are 100% Confirmed
                    if leg1_score >= 300.0 and leg2_score >= 300.0:
                        score += 150.0

                    # Same class continuity bonus
                    if cls1 == cls2:
                        score += 30.0

                # Layover duration scoring
                layover_h = itin.layover_minutes / 60.0
                if 2.0 <= layover_h <= 4.5:
                    score += 40.0  # Ideal transfer window
                elif layover_h > 7.0:
                    score -= (layover_h - 7.0) * 12.0  # Long wait penalty

                # Cross-city station transfer penalty (e.g. traveling between terminals in same city)
                if "Cross-City" in itin.transfer_type:
                    score -= 35.0

                # Northern Detour Penalty (e.g. going via Delhi/Jaipur is kept lower in recommendations)
                if itin.is_northern_detour:
                    score -= 140.0

                summaries.append(f"Leg 1 ({itin.origin}\u2192{itin.transit_hub}): {desc1}")
                summaries.append(f"Leg 2 ({itin.transit_hub}\u2192{itin.destination}): {desc2}")
                viable_classes.extend([cls1, cls2])

            # Travel duration penalty (deduct points per hour of travel)
            duration_hours = itin.total_duration_minutes / 60.0
            score -= (duration_hours * 1.5)

            itin.score = round(score, 1)
            itin.status_summary = " | ".join(summaries)
            itin.viable_classes = list(set(viable_classes))

        # Sort descending by score
        ranked = sorted(itineraries, key=lambda x: x.score, reverse=True)

        # Assign Recommendation #1, #2, #3...
        for rank_idx, itin in enumerate(ranked, start=1):
            itin.recommendation_rank = rank_idx

        return ranked
