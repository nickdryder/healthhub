import { supabase } from '@/integrations/supabase/client';
import { AnalyzedInsight, AnalysisContext } from './analysis/types';
import { getUserLocation } from './weather';
import { getHourInTimezone, getUserTimezone } from './timezone-utils';
import { analyzeSleepCorrelations } from './analysis/sleep-correlations';
import { analyzeCaffeineCorrelations } from './analysis/caffeine-correlations';
import { analyzeFoodCorrelations } from './analysis/food-correlations';
import { analyzeExerciseCorrelations } from './analysis/exercise-correlations';
import { analyzeStepsCorrelations } from './analysis/steps-correlations';
import { analyzeHRVCorrelations } from './analysis/hrv-correlations';
import { analyzeSymptomCorrelations } from './analysis/symptom-correlations';
import { analyzeBristolCorrelations } from './analysis/bristol-correlations';
import { analyzeWeightCorrelations } from './analysis/weight-correlations';
import { analyzeCalendarCorrelations } from './analysis/calendar-correlations';
import { analyzeMedicationCorrelations } from './analysis/medication-correlations';
import { analyzeCycleCorrelations } from './analysis/cycle-correlations';
import { cycleTracking } from './cycle-tracking';

export type { AnalyzedInsight };

class LocalAnalysisEngine {
  async analyzeHealthData(userId: string): Promise<AnalyzedInsight[]> {
    const insights: AnalyzedInsight[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all data in parallel
    const [metricsRes, logsRes, eventsRes, foodRes, weatherRes, medsRes] = await Promise.all([
      supabase.from('health_metrics').select('*').eq('user_id', userId).gte('recorded_at', thirtyDaysAgo),
      supabase.from('manual_logs').select('*').eq('user_id', userId).gte('logged_at', thirtyDaysAgo),
      supabase.from('calendar_events').select('*').eq('user_id', userId).gte('start_time', thirtyDaysAgo),
      supabase.from('food_entries').select('*').eq('user_id', userId).gte('logged_at', thirtyDaysAgo),
      supabase.from('weather_data').select('*').eq('user_id', userId).gte('date', thirtyDaysAgo.split('T')[0]),
      supabase.from('medication_logs').select('*').eq('user_id', userId).gte('logged_at', thirtyDaysAgo),
    ]);

    const userTimezone = getUserTimezone();
    console.log('[Analysis] User timezone:', userTimezone);

    // Log events for debugging
    const events = (eventsRes.data || []) as any[];
    console.log('[Analysis] Events fetched:', events.length, events.slice(0, 3).map(e => ({ title: e.title, is_all_day: e.is_all_day, start_time: e.start_time })));

    const ctx: AnalysisContext = {
      metrics: (metricsRes.data || []) as any[],
      logs: (logsRes.data || []) as any[],
      events: events,
      foods: (foodRes.data || []) as any[],
      weather: (weatherRes.data || []) as any[],
      medications: (medsRes.data || []) as any[],
      userTimezone: userTimezone,
    };

    // Fetch current cycle phase
    const cycleEntries = await cycleTracking.getCycleEntries();
    const currentCycleEntry = cycleEntries[0]; // Most recent entry
    console.log('[Analysis] Current cycle phase:', currentCycleEntry?.phase);

    // Run all correlation analyses with error isolation
    const analyzeWithError = (name: string, fn: () => AnalyzedInsight[]) => {
      try {
        const result = fn();
        console.log(`[Analysis] ${name}: ${result.length} insights`);
        return result;
      } catch (error) {
        console.error(`[Analysis] ${name} failed:`, error);
        return [];
      }
    };

    try {
      insights.push(...analyzeWithError('Sleep', () => analyzeSleepCorrelations(ctx)));
      insights.push(...analyzeWithError('Caffeine', () => analyzeCaffeineCorrelations(ctx)));
      insights.push(...analyzeWithError('Food', () => analyzeFoodCorrelations(ctx)));
      insights.push(...analyzeWithError('Exercise', () => analyzeExerciseCorrelations(ctx)));
      insights.push(...analyzeWithError('Steps', () => analyzeStepsCorrelations(ctx)));
      insights.push(...analyzeWithError('HRV', () => analyzeHRVCorrelations(ctx)));
      insights.push(...analyzeWithError('Symptoms', () => analyzeSymptomCorrelations(ctx)));
      insights.push(...analyzeWithError('Bristol', () => analyzeBristolCorrelations(ctx)));
      insights.push(...analyzeWithError('Weight', () => analyzeWeightCorrelations(ctx)));
      insights.push(...analyzeWithError('Calendar', () => analyzeCalendarCorrelations(ctx)));
      insights.push(...analyzeWithError('Medication', () => analyzeMedicationCorrelations(ctx)));

      // Add cycle correlations if user has logged cycle data
      if (currentCycleEntry && currentCycleEntry.phase) {
        try {
          // Build HealthMetrics object from context
          const healthMetrics = this.buildHealthMetrics(ctx);
          console.log('[Analysis] Health metrics for cycle:', healthMetrics);
          const cycleInsights = analyzeCycleCorrelations(healthMetrics, currentCycleEntry.phase);
          console.log('[Analysis] Generated cycle insights:', cycleInsights.length);
          if (cycleInsights && cycleInsights.length > 0) {
            insights.push(...cycleInsights.map(result => ({
              type: 'correlation' as const,
              title: result.insight || `${currentCycleEntry.phase} phase insight`,
              description: result.suggestions?.join(' • ') || result.description || '',
              confidence: result.confidence || 0.75,
              relatedMetrics: [result.metric || 'cycle', 'menstrual_cycle'],
            })));
          }
        } catch (cycleError) {
          console.error('[Analysis] Cycle analysis error:', cycleError);
          // Continue with other insights even if cycle analysis fails
        }
      }
    } catch (error) {
      console.error('Analysis error:', error);
      // Don't re-throw - let fallback handle it
      return [];
    }

    // Starter insights if no data
    if (insights.length === 0) {
      insights.push(...this.getStarterInsights(ctx.metrics.length, ctx.logs.length));
    }

    // Deduplicate similar insights and sort by confidence
    const uniqueInsights = this.deduplicateInsights(insights);
    return uniqueInsights.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
  }

  private buildHealthMetrics(ctx: AnalysisContext): any {
    // Build aggregated health metrics from raw context data
    const metrics: any = {};

    // Sleep metrics
    const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
    if (sleepData.length > 0) {
      const avgDuration = sleepData.reduce((s, m) => s + m.value, 0) / sleepData.length;
      metrics.sleep = { duration: avgDuration };
    }

    // Exercise metrics
    const exerciseLogs = ctx.logs.filter(l => l.log_type === 'exercise');
    if (exerciseLogs.length > 0) {
      const lastExercise = exerciseLogs[0];
      metrics.exercise = { intensity: lastExercise.value || 'moderate' };
    }

    // Heart rate metrics
    const hrData = ctx.metrics.filter(m => m.metric_type === 'resting_heart_rate');
    if (hrData.length > 0) {
      const avgHR = hrData.reduce((s, m) => s + m.value, 0) / hrData.length;
      metrics.heartRate = { resting: avgHR };
    }

    // HRV metrics
    const hrvData = ctx.metrics.filter(m => m.metric_type === 'hrv');
    if (hrvData.length > 0) {
      metrics.hrv = { value: hrvData[0].value };
    }

    // Steps
    const stepsData = ctx.metrics.filter(m => m.metric_type === 'steps');
    if (stepsData.length > 0) {
      metrics.steps = stepsData.reduce((s, m) => s + m.value, 0) / stepsData.length;
    }

    // Calories
    const calorieData = ctx.foods;
    if (calorieData.length > 0) {
      const totalCalories = calorieData.reduce((s, f) => s + (f.calories || 0), 0);
      metrics.calories = { intake: totalCalories };
    }

    // Weight
    const weightData = ctx.metrics.filter(m => m.metric_type === 'weight');
    if (weightData.length > 0) {
      metrics.weight = weightData[0].value;
    }

    // Symptoms
    const symptomLogs = ctx.logs.filter(l => l.log_type === 'symptom');
    metrics.symptoms = symptomLogs.map(s => s.value);

    // Caffeine
    const caffeineLogs = ctx.logs.filter(l => l.log_type === 'caffeine');
    if (caffeineLogs.length > 0) {
      metrics.caffeine = {
        intake: caffeineLogs.reduce((s, c) => s + (parseInt(c.value) || 0), 0),
      };
    }

    // Bristol
    const bristolLogs = ctx.logs.filter(l => l.log_type === 'bristol');
    if (bristolLogs.length > 0) {
      metrics.bristol = parseInt(bristolLogs[0].value);
    }

    return metrics;
  }

  private deduplicateInsights(insights: AnalyzedInsight[]): AnalyzedInsight[] {
    const seen = new Set<string>();
    return insights.filter(insight => {
      // Create a key based on title similarity
      const key = insight.title.toLowerCase().replace(/[^a-z]/g, '').slice(0, 20);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private getStarterInsights(metricsCount: number, logsCount: number): AnalyzedInsight[] {
    const insights: AnalyzedInsight[] = [];
    if (metricsCount === 0 && logsCount === 0) {
      insights.push({
        type: 'recommendation',
        title: 'Start logging your health',
        description: 'Log symptoms, caffeine, sleep, and meals to get personalized AI insights.',
        confidence: 0.95,
        relatedMetrics: ['manual_logs'],
      });
    } else if (metricsCount + logsCount < 10) {
      insights.push({
        type: 'recommendation',
        title: 'Keep logging for insights',
        description: 'A few more days of data will unlock pattern detection and correlations.',
        confidence: 0.90,
        relatedMetrics: ['manual_logs'],
      });
    }
    return insights;
  }

  async saveInsights(userId: string, insights: AnalyzedInsight[]): Promise<boolean> {
    try {
      const records = insights.map(i => ({
        user_id: userId,
        insight_type: i.type,
        title: i.title,
        description: i.description,
        confidence: i.confidence,
        related_metrics: i.relatedMetrics,
      }));
      const { error } = await supabase.from('ai_insights').insert(records as any);
      return !error;
    } catch {
      return false;
    }
  }
}

export const localAnalysis = new LocalAnalysisEngine();