import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthProvider';

interface HealthMetricRow {
  metric_type: string;
  value: number;
  unit?: string;
  metadata?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
}

export interface MacroData {
  protein: number;
  carbs: number;
  fat: number;
}

export interface DashboardMetrics {
  sleep: { value: number; unit: string; trend?: number } | null;
  heartRate: { value: number; unit: string; trend?: number } | null;
  steps: { value: number; unit: string; trend?: number } | null;
  calories: { value: number; unit: string } | null;
  caloriesConsumed: { value: number; unit: string; macros?: MacroData } | null;
  weight: { value: number; movingAvg: number; unit: string; trend?: number } | null;
}

export interface StoredInsight {
  id: string;
  insight_type: 'correlation' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number | null;
  created_at: string;
}

export interface RecentLog {
  id: string;
  log_type: string;
  value: string;
  severity: number | null;
  logged_at: string;
}

export function useHealthMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['health-metrics', user?.id],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!user) throw new Error('Not authenticated');

      // Get today's start (00:00) and end (23:59) in local timezone
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      // For sleep, look back 36 hours to catch last night's sleep
      const sleepLookback = new Date(Date.now() - 36 * 60 * 60 * 1000);

      // For weight moving average, look back 7 days
      const weightLookback = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // For trend comparison, get yesterday's data
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayEnd = new Date(todayStart.getTime() - 1);

      // Get today's metrics
      const { data: recentData, error: recentError } = await supabase
        .from('health_metrics')
        .select('metric_type, value, unit, metadata, recorded_at, source')
        .eq('user_id', user.id)
        .gte('recorded_at', todayStart.toISOString())
        .lt('recorded_at', todayEnd.toISOString())
        .order('recorded_at', { ascending: false });

      if (recentError) {
        console.error('Error fetching recent metrics:', recentError);
      }

      // Get recent sleep data separately (last 36 hours to catch last night)
      const { data: recentSleepData, error: sleepError } = await supabase
        .from('health_metrics')
        .select('metric_type, value, unit, metadata, recorded_at, source')
        .eq('user_id', user.id)
        .eq('metric_type', 'sleep')
        .gte('recorded_at', sleepLookback.toISOString())
        .order('recorded_at', { ascending: false })
        .limit(1);

      if (sleepError) {
        console.error('Error fetching sleep:', sleepError);
      }
      // Get weight data for moving average (last 7 days)
      const { data: weightData } = await supabase
        .from('health_metrics')
        .select('value, recorded_at')
        .eq('user_id', user.id)
        .eq('metric_type', 'weight')
        .gte('recorded_at', weightLookback.toISOString())
        .order('recorded_at', { ascending: false });

      // Get yesterday's data for trend comparison
      const { data: yesterdayData } = await supabase
        .from('health_metrics')
        .select('metric_type, value')
        .eq('user_id', user.id)
        .gte('recorded_at', yesterdayStart.toISOString())
        .lte('recorded_at', yesterdayEnd.toISOString());

      const recentMetrics = (recentData || []) as (HealthMetricRow & { recorded_at: string; source: string })[];
      const yesterdayMetrics = (yesterdayData || []) as HealthMetricRow[];
      const sleepMetrics = (recentSleepData || []) as HealthMetricRow[];
      const weightMetrics = (weightData || []) as { value: number; recorded_at: string }[];

      console.log('Dashboard query results:', {
        recentMetricsCount: recentMetrics.length,
        recentMetrics: recentMetrics.map(m => ({ type: m.metric_type, value: m.value, source: m.source, recorded_at: m.recorded_at })),
        sleepMetricsCount: sleepMetrics.length,
        yesterdayMetricsCount: yesterdayMetrics.length,
      });

      // For non-sleep metrics, use the most recent from last 24 hours
      const getLatest = (type: string) => recentMetrics.find(m => m.metric_type === type);

      // For sleep, use the 36-hour lookback data
      const getLatestSleep = () => sleepMetrics.length > 0 ? sleepMetrics[0] : null;
      const getYesterdayAvg = (type: string) => {
        const matches = yesterdayMetrics.filter(m => m.metric_type === type);
        if (matches.length === 0) return null;
        return matches.reduce((sum, m) => sum + m.value, 0) / matches.length;
      };

      const calcTrend = (current: number | undefined, previous: number | null) => {
        if (!current || !previous) return undefined;
        return Math.round(((current - previous) / previous) * 100);
      };

      // Calculate weight moving average
      const calculateWeightData = () => {
        if (weightMetrics.length === 0) return null;

        const latestWeight = weightMetrics[0].value;
        const movingAvg = weightMetrics.reduce((sum, w) => sum + w.value, 0) / weightMetrics.length;

        // Calculate trend from 7+ days ago if we have older data
        let trend: number | undefined;
        if (weightMetrics.length >= 3) {
          const oldestInWindow = weightMetrics[weightMetrics.length - 1].value;
          const weeklyChange = latestWeight - oldestInWindow;
          // Convert to percentage
          trend = Math.round((weeklyChange / oldestInWindow) * 100);
        }

        return {
          value: Math.round(latestWeight * 10) / 10,
          movingAvg: Math.round(movingAvg * 10) / 10,
          unit: 'kg',
          trend,
        };
      };

      const sleep = getLatestSleep();
      const heartRate = getLatest('heart_rate') || getLatest('resting_heart_rate');
      const steps = getLatest('steps');
      const calories = getLatest('calories_burned');
      const caloriesConsumed = getLatest('calories_consumed');
      const weight = calculateWeightData();
      console.log('Health metrics loaded:', {
        sleep: sleep?.value,
        heartRate: heartRate?.value,
        steps: steps?.value,
        calories: calories?.value,
        caloriesConsumed: caloriesConsumed?.value,
        weight: weight?.value,
        weightMovingAvg: weight?.movingAvg,
        macros: caloriesConsumed?.metadata,
        rawCaloriesConsumed: caloriesConsumed,
        sleepLookbackUsed: sleepLookback.toISOString(),
      });

      return {
        sleep: sleep ? {
          value: Math.round(sleep.value * 10) / 10,
          unit: 'hrs',
          trend: calcTrend(sleep.value, getYesterdayAvg('sleep')),
        } : null,
        heartRate: heartRate ? {
          value: Math.round(heartRate.value),
          unit: 'bpm',
          trend: calcTrend(heartRate.value, getYesterdayAvg('heart_rate')),
        } : null,
        steps: steps ? {
          value: steps.value,
          unit: 'steps',
          trend: calcTrend(steps.value, getYesterdayAvg('steps')),
        } : null,
        calories: calories ? {
          value: Math.round(calories.value),
          unit: 'kcal',
        } : null,
        caloriesConsumed: caloriesConsumed ? {
          value: Math.round(caloriesConsumed.value),
          unit: 'kcal',
          macros: caloriesConsumed.metadata ? {
            protein: Math.round(Number(caloriesConsumed.metadata.protein || 0)),
            carbs: Math.round(Number(caloriesConsumed.metadata.carbs || 0)),
            fat: Math.round(Number(caloriesConsumed.metadata.fat || 0)),
          } : undefined,
        } : null,
        weight,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInsights(limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['insights', user?.id, limit],
    queryFn: async (): Promise<StoredInsight[]> => {
      if (!user) throw new Error('Not authenticated');

      try {
        // First, try to fetch stored insights from the database
        const { data: storedData, error: fetchError } = await supabase
          .from('ai_insights')
          .select('id, insight_type, title, description, confidence, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (fetchError) {
          console.warn('[useInsights] Fetch error, will regenerate:', fetchError);
        } else if (storedData && storedData.length > 0) {
          console.log('[useInsights] Returning stored insights:', storedData.length, storedData.map(i => ({ id: i.id, title: i.title })));
          return (storedData as StoredInsight[]);
        }

        console.log('[useInsights] No stored insights found, generating fresh analysis...');
        // If no stored insights, generate fresh ones
        const { localAnalysis } = await import('@/services/local-analysis');
        console.log('[useInsights] Starting fresh analysis...');
        const freshInsights = await localAnalysis.analyzeHealthData(user.id);
        console.log('[useInsights] Generated insights:', freshInsights.length, freshInsights.map(i => ({ title: i.title, confidence: i.confidence })));
        // Save to database for future reference
        if (freshInsights.length > 0) {
          const { data: insertedData, error: insertError } = await supabase
            .from('ai_insights')
            .insert(
              freshInsights.map(i => ({
                user_id: user.id,
                insight_type: i.type,
                title: i.title,
                description: i.description,
                confidence: i.confidence,
                related_metrics: i.relatedMetrics,
              }))
            )
            .select('id, insight_type, title, description, confidence, created_at');

          if (insertError) {
            console.error('[useInsights] Insert error:', insertError);
          } else if (insertedData) {
            console.log('[useInsights] Saved insights to DB:', insertedData.length, insertedData.map(i => ({ id: i.id, title: i.title })));
            return (insertedData as StoredInsight[]).slice(0, limit);
          }
        }

        console.warn('[useInsights] No insights generated or saved');
        return [];
      } catch (error) {
        console.error('[useInsights] Error:', error);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentLogs(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-logs', user?.id, limit],
    queryFn: async (): Promise<RecentLog[]> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('manual_logs')
        .select('id, log_type, value, severity, logged_at')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as RecentLog[];
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  });
}