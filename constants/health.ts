/**
 * Health tracking constants
 *
 * Centralized health-related constants for scoring, ranges, and validation.
 */

// Health score weights (out of 100 total)
export const HEALTH_SCORE_WEIGHTS = {
  SLEEP: 25,
  HEART_RATE: 20,
  ACTIVITY: 20,
  NUTRITION: 15,
  HYDRATION: 10,
  WEIGHT: 10,
} as const;

// Sleep ranges (hours)
export const SLEEP_RANGES = {
  OPTIMAL_MIN: 7,
  OPTIMAL_MAX: 9,
  ACCEPTABLE_MIN: 6,
  ACCEPTABLE_MAX: 10,
  MINIMUM: 5,
} as const;

// Heart rate ranges (bpm)
export const HEART_RATE_RANGES = {
  RESTING_LOW: 60,
  RESTING_HIGH: 100,
  ACTIVE_LOW: 100,
  ACTIVE_HIGH: 180,
} as const;

// Activity ranges (steps per day)
export const ACTIVITY_RANGES = {
  SEDENTARY: 5000,
  LIGHTLY_ACTIVE: 7500,
  ACTIVE: 10000,
  VERY_ACTIVE: 12500,
} as const;

// Nutrition ranges (calories per day)
export const NUTRITION_RANGES = {
  MIN_CALORIES: 1200,
  MAX_CALORIES: 4000,
  DEFAULT_TARGET: 2000,
} as const;

// Validation ranges
export const VALIDATION_RANGES = {
  CAFFEINE_MIN: 0,
  CAFFEINE_MAX: 2000,
  WEIGHT_MIN_KG: 20,
  WEIGHT_MAX_KG: 300,
  WEIGHT_MIN_LBS: 44,
  WEIGHT_MAX_LBS: 660,
  EXERCISE_SETS_MIN: 1,
  EXERCISE_SETS_MAX: 100,
  EXERCISE_REPS_MIN: 1,
  EXERCISE_REPS_MAX: 1000,
  EXERCISE_WEIGHT_MIN: 0,
  EXERCISE_WEIGHT_MAX: 10000,
  TEXT_INPUT_MAX_LENGTH: 1000,
  NOTES_MAX_LENGTH: 5000,
} as const;

// Cycle tracking
export const CYCLE_PHASES = ['menstruation', 'follicular', 'ovulation', 'luteal'] as const;
export const FLOW_TYPES = ['light', 'normal', 'heavy'] as const;

// Integration providers
export const INTEGRATION_PROVIDERS = ['apple_health', 'fitbit', 'google_calendar', 'yazio'] as const;

// Metric types
export const METRIC_TYPES = [
  'steps',
  'heart_rate',
  'resting_heart_rate',
  'hrv',
  'sleep',
  'weight',
  'active_calories',
  'calories_burned',
  'calories_consumed',
] as const;

// Log types
export const LOG_TYPES = [
  'symptom',
  'bristol_stool',
  'caffeine',
  'exercise',
  'supplement',
  'weight',
  'medication',
  'cycle',
  'custom',
] as const;
