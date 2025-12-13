import { AnalysisResult, HealthMetrics } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeCycleCorrelations(
  metrics: HealthMetrics,
  cyclePhase?: string
): AnalysisResult[] {
  if (!cyclePhase) {
    return [];
  }

  const results: AnalysisResult[] = [];

  if (cyclePhase === 'menstruation') {
    // Sleep correlations
    if (metrics.sleep && metrics.sleep.duration < 7) {
      results.push({
        metric: 'sleep',
        phase: 'menstruation',
        insight: 'During menstruation, you may need extra rest. Your sleep was below 7 hours.',
        severity: 'moderate',
        actionable: true,
        suggestions: ['Try to get 7-9 hours', 'Reduce caffeine intake', 'Take magnesium supplement'],
      });
    }

    // Energy and exercise
    if (metrics.exercise && metrics.exercise.intensity === 'high') {
      results.push({
        metric: 'exercise',
        phase: 'menstruation',
        insight: 'High intensity exercise during menstruation may increase fatigue. Consider lighter workouts.',
        severity: 'low',
        actionable: true,
        suggestions: ['Try low-intensity cardio', 'Yoga or stretching', 'Walking or swimming'],
      });
    }

    // Symptom tracking during menstruation
    if (metrics.symptoms && metrics.symptoms.length > 0) {
      results.push({
        metric: 'symptoms',
        phase: 'menstruation',
        insight: `You logged ${metrics.symptoms.length} symptoms during menstruation. This is normal but monitor severity.`,
        severity: 'info',
        actionable: true,
        suggestions: ['Track symptoms daily', 'Note any patterns', 'Consider pain relief if severe'],
      });
    }

    // Caffeine impact
    if (metrics.caffeine && metrics.caffeine.intake > 100) {
      results.push({
        metric: 'caffeine',
        phase: 'menstruation',
        insight: 'High caffeine intake during menstruation may worsen cramps and sleep quality.',
        severity: 'moderate',
        actionable: true,
        suggestions: ['Reduce to <100mg daily', 'Switch to herbal tea', 'Drink more water'],
      });
    }

    // Hydration and flow
    if (metrics.hydration && metrics.hydration < 8) {
      results.push({
        metric: 'hydration',
        phase: 'menstruation',
        insight: 'During menstruation, proper hydration is crucial. Aim for 8+ glasses of water daily.',
        severity: 'moderate',
        actionable: true,
        suggestions: ['Increase water intake', 'Add electrolytes', 'Track fluid consumption'],
      });
    }
  }

  if (cyclePhase === 'follicular') {
    // Energy boost
    if (metrics.energy && metrics.energy < 7) {
      results.push({
        metric: 'energy',
        phase: 'follicular',
        insight: 'During follicular phase, estrogen is rising and energy typically increases. Low energy might indicate a concern.',
        severity: 'low',
        actionable: true,
        suggestions: ['Check sleep quality', 'Increase cardio exercise', 'Review nutrition'],
      });
    }

    // Optimal time for intense exercise
    if (metrics.exercise && metrics.exercise.intensity === 'low') {
      results.push({
        metric: 'exercise',
        phase: 'follicular',
        insight: 'The follicular phase is optimal for high-intensity training. Consider increasing workout intensity.',
        severity: 'info',
        actionable: true,
        suggestions: ['HIIT workouts', 'Strength training', 'Challenging cardio sessions'],
      });
    }

    // Heart rate patterns
    if (metrics.heartRate && metrics.heartRate.resting > 75) {
      results.push({
        metric: 'heartRate',
        phase: 'follicular',
        insight: 'Your resting HR is elevated in follicular phase. This is relatively normal due to rising estrogen.',
        severity: 'info',
        actionable: false,
      });
    }

    // Sleep quality typically good
    if (metrics.sleep && metrics.sleep.quality > 8) {
      results.push({
        metric: 'sleep',
        phase: 'follicular',
        insight: 'Sleep quality is excellent in follicular phase—take advantage of this for recovery and social activities.',
        severity: 'positive',
        actionable: false,
      });
    }
  }

  if (cyclePhase === 'ovulation') {
    // Peak fertility and energy
    results.push({
      metric: 'ovulation',
      phase: 'ovulation',
      insight: 'You are in your peak fertility window. This is the best time for high-intensity exercise and demanding activities.',
      severity: 'info',
      actionable: false,
      suggestions: ['Schedule important meetings', 'Plan intense workouts', 'Social engagement peaks'],
    });

    // Heart rate elevation
    if (metrics.heartRate && metrics.heartRate.resting < 75) {
      results.push({
        metric: 'heartRate',
        phase: 'ovulation',
        insight: 'Your resting heart rate is optimal during ovulation—perfect for peak performance.',
        severity: 'positive',
        actionable: false,
      });
    }

    // Caloric needs increase
    if (metrics.calories && metrics.calories.intake < metrics.calories.burned) {
      results.push({
        metric: 'calories',
        phase: 'ovulation',
        insight: 'Caloric needs increase slightly during ovulation. Ensure adequate nutrition for peak performance.',
        severity: 'moderate',
        actionable: true,
        suggestions: ['Increase protein intake', 'Add 200-300 extra calories', 'Focus on nutrient-dense foods'],
      });
    }
  }

  if (cyclePhase === 'luteal') {
    // Rest and recovery phase
    if (metrics.exercise && metrics.exercise.intensity === 'high') {
      results.push({
        metric: 'exercise',
        phase: 'luteal',
        insight: 'Luteal phase is for recovery. High-intensity exercise may cause excess fatigue. Opt for moderate intensity.',
        severity: 'moderate',
        actionable: true,
        suggestions: ['Lower intensity workouts', 'Yoga and stretching', 'Strength with longer rest'],
      });
    }

    // Mood and symptoms
    if (metrics.symptoms && metrics.symptoms.includes('mood')) {
      results.push({
        metric: 'symptoms',
        phase: 'luteal',
        insight: 'Mood changes are common in the luteal phase. Self-care and rest are especially important now.',
        severity: 'info',
        actionable: true,
        suggestions: ['Prioritize self-care', 'Reduce stress', 'Get extra sleep', 'Meditation or journaling'],
      });
    }

    // Sleep needs increase
    if (metrics.sleep && metrics.sleep.duration < 8) {
      results.push({
        metric: 'sleep',
        phase: 'luteal',
        insight: 'Sleep needs increase in the luteal phase. Aim for 8-10 hours for optimal recovery.',
        severity: 'moderate',
        actionable: true,
        suggestions: ['Extend sleep by 1-2 hours', 'Sleep earlier', 'Improve sleep hygiene'],
      });
    }

    // Nutrition adjustments
    if (metrics.calories && metrics.calories.intake < 2000) {
      results.push({
        metric: 'nutrition',
        phase: 'luteal',
        insight: 'Caloric and nutrient needs increase in luteal phase. Hunger is normal—eat more.',
        severity: 'info',
        actionable: true,
        suggestions: ['Increase calories by 200-300', 'More complex carbs', 'Increase magnesium-rich foods'],
      });
    }

    // Caffeine sensitivity
    if (metrics.caffeine && metrics.caffeine.intake > 100) {
      results.push({
        metric: 'caffeine',
        phase: 'luteal',
        insight: 'Caffeine sensitivity peaks in luteal phase. High intake may disrupt sleep and mood.',
        severity: 'moderate',
        actionable: true,
        suggestions: ['Limit to <50mg after noon', 'Switch to decaf', 'Herbal tea instead'],
      });
    }

    // HRV typically lower
    if (metrics.hrv && metrics.hrv < 30) {
      results.push({
        metric: 'hrv',
        phase: 'luteal',
        insight: 'Lower HRV in luteal phase is normal. Avoid overtraining and focus on recovery.',
        severity: 'info',
        actionable: true,
        suggestions: ['Reduce training volume', 'Increase rest days', 'Monitor stress levels'],
      });
    }
  }

  return results;
}