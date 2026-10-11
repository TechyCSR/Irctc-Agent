export interface StationItem {
  code: string;
  name: string;
  city: string;
  state: string;
  cluster?: string;
  is_junction?: boolean;
}

export interface TrainLeg {
  train_no: string;
  train_name: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  alt_from: string[];
  alt_to: string[];
  seats: Record<string, string>;
  fares: Record<string, number>;
}

export interface RouteItinerary {
  id: string;
  rank: number;
  score: number;
  type: 'DIRECT' | '1_TRANSFER';
  origin: string;
  destination: string;
  hub: string;
  corridor: string;
  is_detour: boolean;
  detour_ratio: number;
  transfer_type: string;
  layover_risk: string;
  layover_minutes: number;
  layover_str: string;
  total_duration_minutes: number;
  total_duration_str: string;
  best_fare: number;
  best_fare_class: string;
  fares_by_class: Record<string, number>;
  booking_confidence: 'CONFIRMED' | 'RAC' | 'WAITLIST' | 'REGRET';
  summary: string;
  legs: TrainLeg[];
}

export interface SearchState {
  fromStation: StationItem;
  toStation: StationItem;
  date: string;
  quota: string;
  classCode: string;
}
