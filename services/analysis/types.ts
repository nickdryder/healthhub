export interface AnalyzedInsight {
  type: 'correlation' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  relatedMetrics: string[];
}

export interface HealthMetric {
  metric_type: string;
  value: number;
  recorded_at: string;
  unit?: string;
  cyclePhase?: string;
}

export interface ManualLog {
  log_type: string;
  value: string;
  severity?: number;
  logged_at: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface CalendarEvent {
  title: string;
  start_time: string;
  end_time?: string;
  event_type?: string;
  is_all_day?: boolean;
}

export interface FoodEntry {
  food_name: string;
  logged_at: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sodium?: number;
  sugar?: number;
  contains_dairy: boolean;
  contains_gluten: boolean;
  contains_caffeine: boolean;
  tags?: string[];
}

export interface WeatherRecord {
  date: string;
  temperature_high: number;
  temperature_low: number;
  precipitation_mm: number;
  humidity_avg: number;
  pressure_hpa: number;
  weather_code: number;
}

export interface MedicationLog {
  logged_at: string;
  took_medication: boolean;
  notes?: string;
}

export interface AnalysisContext {
  userId: string;
  metrics: HealthMetric[];
  logs: ManualLog[];
  foods: FoodEntry[];
  events: CalendarEvent[];
  weather: WeatherRecord[];
  medications: MedicationLog[];
  userTimezone?: string; // e.g., "Asia/Tokyo", from weather API
}

// Helper to get date string in local timezone
export const getDateStr = (d: string) => {
  const date = new Date(d);
  // Get local date YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get hour in local timezone (critical for caffeine timing analysis)
// This ensures 5:30 AM is hour 5, not hour 14, regardless of UTC offset
export const getHour = (d: string): number => {
  const date = new Date(d);
  // getHours() returns the hour in the device's local timezone
  return date.getHours();
};

// AnalysisResult for individual correlation analyses
export interface AnalysisResult {
  metric: string;
  phase?: string;
  insight: string;
  description?: string;
  severity?: 'info' | 'low' | 'moderate' | 'high' | 'positive';
  actionable?: boolean;
  suggestions?: string[];
  confidence?: number;
}

// HealthMetrics aggregated from all sources
export interface HealthMetrics {
  sleep?: {
    duration: number;
    quality?: number;
    consistency?: number;
  };
  exercise?: {
    intensity: 'low' | 'moderate' | 'high';
    duration?: number;
    frequency?: number;
    type?: string;
  };
  heartRate?: {
    resting: number;
    average?: number;
    variability?: number;
  };
  hrv?: {
    value: number;
    trend?: 'improving' | 'declining' | 'stable';
  };
  steps?: number;
  calories?: {
    intake: number;
    burned?: number;
  };
  weight?: number;
  hydration?: number;
  energy?: number;
  symptoms?: string[];
  bristol?: number;
  caffeine?: {
    intake: number;
    timings?: string[];
  };
  medicationAdherence?: number;
}