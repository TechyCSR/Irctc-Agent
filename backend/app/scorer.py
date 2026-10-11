"""
Universal Multi-Factor Scoring and Ranking Engine for Train Itineraries.
Prioritizes Confirmed/RAC seats, rewards direct lines, penalizes detours,
optimizes layovers, and assigns clear Recommendation ranks.
"""

from typing import List, Tuple
from backend.app.dedup import CleanItinerary, NormalizedLeg


class ItineraryScorer:

    @staticmethod
    def evaluate_leg(leg: NormalizedLeg, preferred_class: str = None) -> Tuple[float, str, str]:
        best_score = -100.0
        best_cls = "None"
        best_desc = "No Seats"

        class_order = ["3A", "2A", "SL", "3E", "1A", "CC", "2S"]
        if preferred_class and preferred_class in leg.availability:
            check_classes = [preferred_class] + [c for c in class_order if c != preferred_class]
        else:
            check_classes = class_order

        for cls in check_classes:
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
                cls_score = 220.0  # Guaranteed Boarding & Half-Berth
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
    def rank_itineraries(
        cls, itineraries: List[CleanItinerary], preferred_class: str = None
    ) -> List[CleanItinerary]:
        """Scores and ranks itineraries in descending order of optimality."""
        for itin in itineraries:
            score = 0.0
            summaries = []
            viable_classes = []

            if itin.route_type == "DIRECT":
                leg = itin.legs[0]
                leg_score, best_cls, desc = cls.evaluate_leg(leg, preferred_class)
                score += leg_score * 2.0

                if leg_score >= 200.0:
                    score += 120.0  # Direct train convenience bonus if seat exists
                    itin.booking_confidence = "CONFIRMED"
                elif leg_score > 0:
                    itin.booking_confidence = "WAITLIST"
                else:
                    itin.booking_confidence = "REGRET"

                summaries.append(f"Direct: {desc}")
                viable_classes.append(best_cls)

            elif itin.route_type == "POINT_BEYOND":
                leg = itin.legs[0]
                leg_score, best_cls, desc = cls.evaluate_leg(leg, preferred_class)
                score += leg_score * 1.9 + 110.0  # High bonus for unlocking confirmed quota

                if leg_score >= 200.0:
                    itin.booking_confidence = "CONFIRMED"
                elif leg_score > 0:
                    itin.booking_confidence = "WAITLIST"
                else:
                    itin.booking_confidence = "REGRET"

                summaries.append(f"Point-Beyond ({itin.booking_origin} \u2192 {itin.destination}): {desc}")
                viable_classes.append(best_cls)

            elif itin.route_type == "SAME_TRAIN_SPLIT":
                leg1 = itin.legs[0]
                leg2 = itin.legs[1]
                leg1_score, cls1, desc1 = cls.evaluate_leg(leg1, preferred_class)
                leg2_score, cls2, desc2 = cls.evaluate_leg(leg2, preferred_class)

                if leg1_score < 0 or leg2_score < 0:
                    score = -80.0
                    itin.booking_confidence = "REGRET"
                else:
                    score += (leg1_score + leg2_score) + 130.0  # High bonus: no train change needed
                    if leg1_score >= 200.0 and leg2_score >= 200.0:
                        itin.booking_confidence = "CONFIRMED"
                    elif leg1_score >= 100.0 and leg2_score >= 100.0:
                        itin.booking_confidence = "RAC"
                    else:
                        itin.booking_confidence = "WAITLIST"

                summaries.append(f"Part 1 ({itin.origin}\u2192{itin.split_station}): {desc1}")
                summaries.append(f"Part 2 ({itin.split_station}\u2192{itin.destination}): {desc2}")
                viable_classes.extend([cls1, cls2])

            else:  # 1_TRANSFER
                leg1 = itin.legs[0]
                leg2 = itin.legs[1]

                leg1_score, cls1, desc1 = cls.evaluate_leg(leg1, preferred_class)
                leg2_score, cls2, desc2 = cls.evaluate_leg(leg2, preferred_class)

                if leg1_score < 0 or leg2_score < 0:
                    score = -100.0
                    itin.booking_confidence = "REGRET"
                else:
                    score += (leg1_score + leg2_score)

                    # Bonus if 100% Confirmed on BOTH legs
                    if leg1_score >= 300.0 and leg2_score >= 300.0:
                        score += 150.0
                        itin.booking_confidence = "CONFIRMED"
                    elif leg1_score >= 220.0 and leg2_score >= 220.0:
                        score += 60.0
                        itin.booking_confidence = "RAC"
                    else:
                        itin.booking_confidence = "WAITLIST"

                    # Class continuity bonus
                    if cls1 == cls2:
                        score += 25.0

                # Layover duration scoring
                layover_h = itin.layover_minutes / 60.0
                if 2.0 <= layover_h <= 4.5:
                    score += 35.0  # Perfect transfer buffer
                elif layover_h > 7.0:
                    score -= (layover_h - 7.0) * 12.0  # Long wait deduction

                # Cross-city terminal transfer deduction
                if "Cross-City" in itin.transfer_type:
                    score -= 30.0

                # Detour penalty: Keep detours (like Delhi) lower in ranking
                if itin.detour_ratio > 1.15:
                    penalty = (itin.detour_ratio - 1.15) * 350.0
                    score -= min(penalty, 180.0)

                summaries.append(f"Leg 1 ({itin.origin}\u2192{itin.transit_hub}): {desc1}")
                summaries.append(f"Leg 2 ({itin.transit_hub}\u2192{itin.destination}): {desc2}")
                viable_classes.extend([cls1, cls2])

            # Travel duration penalty (deduct 1.2 points per hour of travel)
            duration_hours = itin.total_duration_minutes / 60.0
            score -= (duration_hours * 1.2)

            itin.score = round(score, 1)
            itin.status_summary = " | ".join(summaries)
            itin.viable_classes = list(set(viable_classes))

        ranked = sorted(itineraries, key=lambda x: x.score, reverse=True)
        for idx, itin in enumerate(ranked, start=1):
            itin.recommendation_rank = idx

        return ranked
