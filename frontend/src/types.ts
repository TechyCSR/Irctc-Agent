export interface StationItem {
  code: string;
  name: string;
  city: string;
  state: string;
  cluster?: string;
  is_junction?: boolean;
}

export interface TrainCategoryInfo {
  category: string;
  label: string;
  badge: string;
  speed_tier: string;
  color: string;
}

export interface TrainLeg {
  train_no: string;
  train_name: string;
  category?: TrainCategoryInfo;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  dep_time_only?: string;
  arr_time_only?: string;
  day_of_journey?: string;
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
  type: 'DIRECT' | '1_TRANSFER' | 'SAME_TRAIN_SPLIT' | 'POINT_BEYOND';
  origin: string;
  destination: string;
  hub: string;
  corridor: string;
  is_detour: boolean;
  detour_ratio: number;
  transfer_type: string;
  inter_station_transfer?: boolean;
  hub_distance_km?: number;
  recommended_cab_mins?: number;
  confirmation_probability?: number;
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
  primary_category?: string;
  lifehack_type?: 'SAME_TRAIN_SPLIT' | 'POINT_BEYOND' | null;
  lifehack_tip?: string;
  booking_origin?: string;
  boarding_station?: string;
  split_station?: string;
  irctc_link?: string;
  legs: TrainLeg[];
}

export interface TrainStopItem {
  code: string;
  name: string;
  arrival: string;
  departure: string;
  halt: string;
  platform: string;
  distance_km: string;
  day: number;
}

export interface TrainScheduleResponse {
  train_no: string;
  train_name: string;
  source: string;
  destination: string;
  total_duration: string;
  has_pantry: boolean;
  punctuality_rating?: number;
  food_rating?: number;
  cleanliness_rating?: number;
  stops: TrainStopItem[];
}

export interface MultiDateItem {
  date: string;
  iso_date: string;
  day_name: string;
  formatted_display: string;
  total_direct_trains: number;
  confirmed_trains: number;
  rac_trains: number;
  status_label: string;
  lowest_fare: number;
}

export interface MultiDateResponse {
  from: string;
  to: string;
  quota: string;
  dates: MultiDateItem[];
}

export interface QuotaItem {
  code: string;
  name: string;
  short_name: string;
  desc: string;
  eligibility: string;
  advance_days: number;
}

export interface TrainCategoryItem {
  id: string;
  label: string;
  badge: string;
  description: string;
}

export interface FareBreakdownItem {
  total_fare: number;
  base_fare: number;
  reservation_fee: number;
  superfast_surcharge: number;
  dynamic_surge: number;
  gst: number;
  gst_rate: string;
  travel_class: string;
  currency: string;
}

export interface WatchdogAlertItem {
  id: string;
  train_no: string;
  doj: string;
  from_stn: string;
  to_stn: string;
  travel_class: string;
  quota: string;
  target_status: string;
  notify_channel: string;
  contact: string;
  created_at: string;
  status: string;
  last_checked?: string;
  last_seen_seats?: string;
}

export interface ChartingStatusResponse {
  scheduled_departure: string;
  first_chart_time: string;
  second_chart_time: string;
  is_first_chart_prepared: boolean;
  is_second_chart_prepared: boolean;
  is_current_booking_open: boolean;
  minutes_to_departure: number;
  minutes_to_first_chart: number;
  status_code: string;
  status_label: string;
  guidance_tip: string;
}

export interface SearchState {
  fromStation: StationItem;
  toStation: StationItem;
  date: string;
  quota: string;
  classCode: string;
}
