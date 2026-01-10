/**
 * Database query utilities
 *
 * Helper functions to reduce code duplication and prevent common query issues.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type HealthMetric = Database['public']['Tables']['health_metrics']['Row'];
type ManualLog = Database['public']['Tables']['manual_logs']['Row'];

/**
 * Fetches health metrics for a user within a date range
 * Reduces code duplication across the app
 */
export async function fetchHealthMetrics(
  userId: string,
  startDate: Date,
  endDate: Date,
  metricTypes?: string[]
) {
  let query = supabase
    .from('health_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('recorded_at', startDate.toISOString())
    .lte('recorded_at', endDate.toISOString())
    .order('recorded_at', { ascending: false });

  if (metricTypes && metricTypes.length > 0) {
    query = query.in('metric_type', metricTypes);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching health metrics:', error);
    throw error;
  }

  return data as HealthMetric[];
}

/**
 * Fetches manual logs for a user within a date range
 */
export async function fetchManualLogs(
  userId: string,
  startDate: Date,
  endDate: Date,
  logTypes?: string[]
) {
  let query = supabase
    .from('manual_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startDate.toISOString())
    .lte('logged_at', endDate.toISOString())
    .order('logged_at', { ascending: false });

  if (logTypes && logTypes.length > 0) {
    query = query.in('log_type', logTypes);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching manual logs:', error);
    throw error;
  }

  return data as ManualLog[];
}

/**
 * Fetches both metrics and logs in a single optimized call
 * Solves N+1 query problems
 */
export async function fetchHealthData(
  userId: string,
  startDate: Date,
  endDate: Date,
  options?: {
    metricTypes?: string[];
    logTypes?: string[];
  }
) {
  const [metrics, logs] = await Promise.all([
    fetchHealthMetrics(userId, startDate, endDate, options?.metricTypes),
    fetchManualLogs(userId, startDate, endDate, options?.logTypes),
  ]);

  return { metrics, logs };
}

/**
 * Fetches recent data with pagination support
 */
export async function fetchRecentHealthMetrics(
  userId: string,
  limit: number = 100,
  offset: number = 0
) {
  const { data, error } = await supabase
    .from('health_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching recent metrics:', error);
    throw error;
  }

  return data as HealthMetric[];
}

/**
 * Fetches integration status for multiple providers efficiently
 * Prevents N+1 query problem when checking multiple integrations
 */
export async function fetchIntegrationStatuses(userId: string) {
  const { data, error } = await supabase
    .from('integrations')
    .select('provider, is_connected, last_sync_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching integration statuses:', error);
    return {};
  }

  // Convert array to map for easy lookup
  const statusMap: Record<string, { isConnected: boolean; lastSync: string | null }> = {};

  data.forEach(integration => {
    statusMap[integration.provider] = {
      isConnected: integration.is_connected,
      lastSync: integration.last_sync_at,
    };
  });

  return statusMap;
}

/**
 * Batch inserts health metrics
 * More efficient than individual inserts
 */
export async function batchInsertHealthMetrics(
  metrics: Database['public']['Tables']['health_metrics']['Insert'][]
) {
  if (metrics.length === 0) return { success: true, count: 0 };

  const { data, error } = await supabase
    .from('health_metrics')
    .insert(metrics)
    .select();

  if (error) {
    console.error('Error batch inserting metrics:', error);
    throw error;
  }

  return { success: true, count: data.length };
}

/**
 * Batch inserts manual logs
 * More efficient than individual inserts
 */
export async function batchInsertManualLogs(
  logs: Database['public']['Tables']['manual_logs']['Insert'][]
) {
  if (logs.length === 0) return { success: true, count: 0 };

  const { data, error } = await supabase
    .from('manual_logs')
    .insert(logs)
    .select();

  if (error) {
    console.error('Error batch inserting logs:', error);
    throw error;
  }

  return { success: true, count: data.length };
}

/**
 * Deletes old data (for cleanup/GDPR compliance)
 */
export async function deleteOldHealthData(
  userId: string,
  olderThanDate: Date
) {
  const [metricsResult, logsResult] = await Promise.all([
    supabase
      .from('health_metrics')
      .delete()
      .eq('user_id', userId)
      .lt('recorded_at', olderThanDate.toISOString()),
    supabase
      .from('manual_logs')
      .delete()
      .eq('user_id', userId)
      .lt('logged_at', olderThanDate.toISOString()),
  ]);

  if (metricsResult.error) {
    console.error('Error deleting old metrics:', metricsResult.error);
  }

  if (logsResult.error) {
    console.error('Error deleting old logs:', logsResult.error);
  }

  return {
    success: !metricsResult.error && !logsResult.error,
  };
}
