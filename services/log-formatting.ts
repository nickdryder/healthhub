// Bristol Stool Scale mapping
const BRISTOL_SCALE = {
  1: { emoji: '🪨', label: 'Type 1', description: 'Hard lumps' },
  2: { emoji: '🌰', label: 'Type 2', description: 'Lumpy' },
  3: { emoji: '🌭', label: 'Type 3', description: 'Sausage shape' },
  4: { emoji: '🍌', label: 'Type 4', description: 'Smooth snake' },
  5: { emoji: '🍈', label: 'Type 5', description: 'Soft blobs' },
  6: { emoji: '🍞', label: 'Type 6', description: 'Mushy' },
  7: { emoji: '💧', label: 'Type 7', description: 'Liquid' },
};

/**
 * Format log value for display based on log type
 */
export function formatLogValue(logType: string, value: any): string {
  // Handle Bristol stool scale
  if (logType === 'bristol_stool' || logType === 'bristol') {
    const numValue = typeof value === 'number' ? value : parseInt(String(value));
    const bristol = BRISTOL_SCALE[numValue as keyof typeof BRISTOL_SCALE];
    if (bristol) {
      return `${bristol.emoji} ${bristol.description}`;
    }
  }

  // Handle caffeine
  if (logType === 'caffeine') {
    const numValue = typeof value === 'number' ? value : parseInt(String(value));
    return `${numValue}mg`;
  }

  // Handle weight
  if (logType === 'weight') {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    return `${numValue.toFixed(1)}lbs`;
  }

  // Handle exercise - parse JSON if needed
  if (logType === 'exercise') {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed.exercise || value;
      } catch {
        return value;
      }
    }
    return value?.exercise || value;
  }

  // Default: return as-is
  return String(value);
}

/**
 * Get a short label for a log type
 */
export function getLogTypeLabel(logType: string): string {
  const labels: Record<string, string> = {
    symptom: 'Symptom',
    bristol_stool: 'Digestion',
    bristol: 'Digestion',
    caffeine: 'Caffeine',
    exercise: 'Exercise',
    supplement: 'Supplement',
    medication: 'Medication',
    weight: 'Weight',
    food: 'Food',
    cycle: 'Cycle',
    custom: 'Log',
  };
  return labels[logType] || 'Log';
}
