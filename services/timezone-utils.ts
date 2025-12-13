/**
 * Timezone utilities for converting UTC timestamps to user's local timezone
 */

/**
 * Get the hour in a specific timezone from an ISO timestamp
 * @param isoString ISO timestamp string (e.g., "2025-12-11T14:30:00Z")
 * @param timezoneIdentifier IANA timezone identifier (e.g., "America/New_York")
 * @returns Hour (0-23) in the specified timezone
 */
export function getHourInTimezone(isoString: string, timezoneIdentifier?: string): number {
  try {
    const date = new Date(isoString);

    // If no timezone provided, use browser's local timezone
    if (!timezoneIdentifier) {
      return date.getHours();
    }

    // Use Intl API to format date in the specific timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: timezoneIdentifier,
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find(p => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value, 10) : date.getHours();
  } catch (error) {
    console.error('[getHourInTimezone] Error:', error);
    return new Date(isoString).getHours();
  }
}

/**
 * Get the date string (YYYY-MM-DD) in a specific timezone
 * @param isoString ISO timestamp string
 * @param timezoneIdentifier IANA timezone identifier
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateStrInTimezone(isoString: string, timezoneIdentifier?: string): string {
  try {
    const date = new Date(isoString);

    if (!timezoneIdentifier) {
      // Use local browser timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Format date in specific timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezoneIdentifier,
    });
    return formatter.format(date);
  } catch (error) {
    console.error('[getDateStrInTimezone] Error:', error);
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Verify timezone match between device and expected timezone
 * Returns info about the difference
 */
export function verifyTimezone(timezone: string): {
  timezone: string;
  deviceHour: number;
  timezoneHour: number;
  offsetHours: number;
  match: boolean;
} {
  const now = new Date();
  const deviceHour = now.getHours();
  const timezoneHour = getHourInTimezone(now.toISOString(), timezone);
  const offset = timezoneHour - deviceHour;
  return {
    timezone,
    deviceHour,
    timezoneHour,
    offsetHours: offset,
    match: offset === 0,
  };
}

/**
 * Get the day of week (0-6) in a specific timezone
 * @param isoString ISO timestamp string
 * @param timezoneIdentifier IANA timezone identifier
 * @returns Day of week (0=Sunday, 6=Saturday)
 */
export function getDayOfWeekInTimezone(isoString: string, timezoneIdentifier?: string): number {
  try {
    const dateStr = getDateStrInTimezone(isoString, timezoneIdentifier);
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDay();
  } catch (error) {
    console.error('[getDayOfWeekInTimezone] Error:', error);
    return new Date(isoString).getDay();
  }
}

/**
 * Get user's timezone from Intl API (browser/device timezone)
 * @returns IANA timezone identifier string (e.g., "America/New_York")
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('[getUserTimezone] Error:', error);
    return 'UTC';
  }
}