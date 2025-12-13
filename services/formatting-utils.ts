/**
 * Format snake_case strings to title case with spaces
 * e.g., "muscle_pain" → "Muscle pain"
 */
export function formatSymptomName(symptom: string): string {
  return symptom
    .split('_')
    .map((word, i) => i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ');
}

/**
 * Format any snake_case string to readable format
 * e.g., "high_blood_pressure" → "High blood pressure"
 */
export function formatSnakeCase(text: string): string {
  return text
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
