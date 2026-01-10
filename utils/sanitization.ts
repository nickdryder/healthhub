/**
 * Input sanitization utilities to prevent XSS and injection attacks
 *
 * IMPORTANT: All user input should be sanitized before storage and display.
 */

/**
 * Sanitizes HTML by escaping dangerous characters
 * Prevents XSS attacks when displaying user-generated content
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes text input by removing potentially dangerous characters
 * and limiting length
 */
export function sanitizeTextInput(
  input: string,
  maxLength: number = 1000
): string {
  if (!input) return '';

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Remove control characters except newline, tab, carriage return
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitizes email input
 * Basic validation and sanitization for email addresses
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';

  // Convert to lowercase and trim
  let sanitized = email.toLowerCase().trim();

  // Remove any whitespace
  sanitized = sanitized.replace(/\s/g, '');

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }

  return sanitized;
}

/**
 * Sanitizes numeric input
 * Ensures value is a safe number within optional min/max bounds
 */
export function sanitizeNumber(
  input: string | number,
  min?: number,
  max?: number
): number | null {
  const num = typeof input === 'number' ? input : parseFloat(input);

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (min !== undefined && num < min) {
    return min;
  }

  if (max !== undefined && num > max) {
    return max;
  }

  return num;
}

/**
 * Strips all HTML tags from input
 * More aggressive than sanitizeHTML - removes tags entirely
 */
export function stripHTML(input: string): string {
  if (!input) return '';

  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes URL input
 * Ensures URL is safe and uses allowed protocols
 */
export function sanitizeURL(url: string): string {
  if (!url) return '';

  const trimmed = url.trim();

  // Only allow http and https protocols
  const urlRegex = /^https?:\/\//;

  if (!urlRegex.test(trimmed)) {
    throw new Error('URL must use http:// or https://');
  }

  // Check for javascript: protocol and other dangerous schemes
  const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerURL = trimmed.toLowerCase();

  for (const scheme of dangerousSchemes) {
    if (lowerURL.includes(scheme)) {
      throw new Error('URL contains dangerous protocol');
    }
  }

  return trimmed;
}

/**
 * Sanitizes user-provided notes/descriptions
 * Combines multiple sanitization techniques
 */
export function sanitizeNotes(notes: string, maxLength: number = 5000): string {
  if (!notes) return '';

  // First sanitize as text
  let sanitized = sanitizeTextInput(notes, maxLength);

  // Then escape HTML
  sanitized = sanitizeHTML(sanitized);

  return sanitized;
}

/**
 * Validates and sanitizes JSON input
 * Prevents JSON injection attacks
 */
export function sanitizeJSON<T>(input: string, maxLength: number = 10000): T | null {
  if (!input) return null;

  // Limit length to prevent DoS
  if (input.length > maxLength) {
    throw new Error('JSON input too large');
  }

  try {
    const parsed = JSON.parse(input);
    return parsed as T;
  } catch (error) {
    console.error('Invalid JSON:', error);
    return null;
  }
}

/**
 * Sanitizes database query input
 * Prevents SQL injection in dynamic queries
 */
export function sanitizeQueryParam(input: string): string {
  if (!input) return '';

  // Remove SQL-dangerous characters
  let sanitized = input.replace(/['";\\]/g, '');

  // Remove SQL comments
  sanitized = sanitized.replace(/--/g, '');
  sanitized = sanitized.replace(/\/\*/g, '');
  sanitized = sanitized.replace(/\*\//g, '');

  // Trim
  sanitized = sanitized.trim();

  return sanitized;
}
