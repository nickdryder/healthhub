/**
 * Time constants to replace magic numbers throughout the codebase
 *
 * Using named constants makes code more readable and maintainable.
 */

// Milliseconds
export const ONE_SECOND_MS = 1000;
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const ONE_WEEK_MS = 7 * ONE_DAY_MS;

// Common time periods in milliseconds
export const THIRTY_SIX_HOURS_MS = 36 * ONE_HOUR_MS;
export const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
export const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

// Health tracking specific
export const DEFAULT_CYCLE_LENGTH_DAYS = 28;
export const MAX_CYCLE_PREDICTION_DAYS = 35;
export const CYCLE_HISTORY_DAYS = 90;

// Cache and sync intervals
export const INSIGHT_CACHE_MAX_AGE_MS = 24 * ONE_HOUR_MS;
export const STALE_TIME_MS = 5 * ONE_MINUTE_MS;
export const AUTO_SYNC_INTERVAL_MS = 15 * ONE_MINUTE_MS;

/**
 * Helper functions for date calculations
 */

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * ONE_DAY_MS);
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * ONE_HOUR_MS);
}

export function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * ONE_MINUTE_MS);
}

export function startOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date = new Date()): Date {
  const start = startOfDay(date);
  return new Date(start.getTime() + ONE_DAY_MS - 1);
}

export function startOfYesterday(): Date {
  const yesterday = daysAgo(1);
  return startOfDay(yesterday);
}

export function endOfYesterday(): Date {
  const yesterday = daysAgo(1);
  return endOfDay(yesterday);
}
