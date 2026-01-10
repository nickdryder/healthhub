/**
 * Input validation utilities
 *
 * Provides type-safe validation for user inputs to prevent invalid data
 * from entering the database and causing issues.
 */

/**
 * Validates and parses a string to an integer
 * @returns The parsed integer, or null if invalid
 */
export function parseIntSafe(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : parseInt(value, 10);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * Validates and parses a string to a float
 * @returns The parsed float, or null if invalid
 */
export function parseFloatSafe(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : parseFloat(value);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * Validates a number is within a specified range
 */
export function validateRange(
  value: number | null,
  min: number,
  max: number
): { valid: boolean; error?: string } {
  if (value === null) {
    return { valid: false, error: 'Value is required' };
  }

  if (value < min || value > max) {
    return { valid: false, error: `Value must be between ${min} and ${max}` };
  }

  return { valid: true };
}

/**
 * Validates a string is not empty and within length limits
 */
export function validateString(
  value: string | null | undefined,
  minLength = 1,
  maxLength = 1000
): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'Value is required' };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { valid: false, error: `Must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `Must be no more than ${maxLength} characters` };
  }

  return { valid: true };
}

/**
 * Safely parses JSON with fallback
 */
export function parseJSONSafe<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback;
  }
}

/**
 * Validates exercise data
 */
export function validateExercise(exercise: {
  name?: string;
  sets?: string | number;
  reps?: string | number;
  weight?: string | number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const nameValidation = validateString(exercise.name);
  if (!nameValidation.valid) {
    errors.push(`Exercise name: ${nameValidation.error}`);
  }

  if (exercise.sets) {
    const sets = parseIntSafe(exercise.sets);
    if (sets === null) {
      errors.push('Sets must be a valid number');
    } else {
      const rangeCheck = validateRange(sets, 1, 100);
      if (!rangeCheck.valid) {
        errors.push(`Sets: ${rangeCheck.error}`);
      }
    }
  }

  if (exercise.reps) {
    const reps = parseIntSafe(exercise.reps);
    if (reps === null) {
      errors.push('Reps must be a valid number');
    } else {
      const rangeCheck = validateRange(reps, 1, 1000);
      if (!rangeCheck.valid) {
        errors.push(`Reps: ${rangeCheck.error}`);
      }
    }
  }

  if (exercise.weight) {
    const weight = parseFloatSafe(exercise.weight);
    if (weight === null) {
      errors.push('Weight must be a valid number');
    } else {
      const rangeCheck = validateRange(weight, 0, 10000);
      if (!rangeCheck.valid) {
        errors.push(`Weight: ${rangeCheck.error}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates supplement data
 */
export function validateSupplement(supplement: {
  name?: string;
  dosage?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const nameValidation = validateString(supplement.name);
  if (!nameValidation.valid) {
    errors.push(`Supplement name: ${nameValidation.error}`);
  }

  if (supplement.dosage) {
    const dosageValidation = validateString(supplement.dosage, 1, 100);
    if (!dosageValidation.valid) {
      errors.push(`Dosage: ${dosageValidation.error}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates caffeine amount
 */
export function validateCaffeineAmount(amount: string | number | null | undefined): {
  valid: boolean;
  value: number | null;
  error?: string;
} {
  const parsed = parseIntSafe(amount);

  if (parsed === null) {
    return { valid: false, value: null, error: 'Caffeine amount must be a valid number' };
  }

  const rangeCheck = validateRange(parsed, 0, 2000);
  if (!rangeCheck.valid) {
    return { valid: false, value: null, error: rangeCheck.error };
  }

  return { valid: true, value: parsed };
}
