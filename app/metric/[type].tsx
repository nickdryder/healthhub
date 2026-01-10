import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { colors as staticColors } from '@/constants/colors';

interface MetricEntry {
  id: string;
  value: number;
  unit: string;
  source: string;
  recorded_at: string;
  metadata?: Record<string, any>;
}

const METRIC_CONFIG: Record<string, { 
  title: string; 
  icon: keyof typeof Ionicons.glyphMap; 
  color: string;
  unit: string;
  formatValue: (v: number) => string;
}> = {
  sleep: {
    title: 'Sleep History',
    icon: 'moon',
    color: staticColors.sleep,
    unit: 'hrs',
    formatValue: (v) => v.toFixed(1),
  },
  heart_rate: {
    title: 'Heart Rate History',
    icon: 'heart',
    color: staticColors.heartRate,
    unit: 'bpm',
    formatValue: (v) => Math.round(v).toString(),
  },
  resting_heart_rate: {
    title: 'Resting Heart Rate',
    icon: 'heart',
    color: staticColors.heartRate,
    unit: 'bpm',
    formatValue: (v) => Math.round(v).toString(),
  },
  steps: {
    title: 'Steps History',
    icon: 'footsteps',
    color: staticColors.steps,
    unit: 'steps',
    formatValue: (v) => Math.floor(v).toLocaleString(),
  },
  weight: {
    title: 'Weight History',
    icon: 'scale',
    color: staticColors.weight,
    unit: 'kg',
    formatValue: (v) => v.toFixed(1),
  },
};

export default function MetricHistoryScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();

  const config = METRIC_CONFIG[type || 'steps'] || METRIC_CONFIG.steps;

  const { data: entries, isLoading } = useQuery({
    queryKey: ['metric-history', user?.id, type],
    queryFn: async (): Promise<MetricEntry[]> => {
      if (!user || !type) return [];

      // For heart rate, also include resting_heart_rate
      const metricTypes = type === 'heart_rate' 
        ? ['heart_rate', 'resting_heart_rate'] 
        : [type];

      const { data, error } = await supabase
        .from('health_metrics')
        .select('id, value, unit, source, recorded_at, metadata')
        .eq('user_id', user.id)
        .in('metric_type', metricTypes)
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as MetricEntry[];
    },
    enabled: !!user && !!type,
  });

  // Group entries by date
  const groupedEntries = React.useMemo(() => {
    if (!entries) return {};
    const groups: Record<string, MetricEntry[]> = {};
    entries.forEach(entry => {
      const date = new Date(entry.recorded_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(entry);
    });
    return groups;
  }, [entries]);

  // Calculate stats
  const stats = React.useMemo(() => {
    if (!entries || entries.length === 0) return null;

    const values = entries.map(e => e.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // 7-day average
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEntries = entries.filter(e => new Date(e.recorded_at) >= sevenDaysAgo);
    const weekAvg = recentEntries.length > 0
      ? recentEntries.reduce((a, b) => a + b.value, 0) / recentEntries.length
      : avg;

    return { avg, min, max, weekAvg, count: entries.length };
  }, [entries]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getSourceIcon = (source: string): keyof typeof Ionicons.glyphMap => {
    switch (source) {
      case 'fitbit': return 'fitness';
      case 'apple_health': return 'logo-apple';
      case 'manual': return 'create';
      default: return 'sync';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats Card */}
        {stats && (
          <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
            <View style={[styles.statsIconContainer, { backgroundColor: `${config.color}15` }]}>
              <Ionicons name={config.icon} size={28} color={config.color} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: config.color }]}>
                  {config.formatValue(stats.weekAvg)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>7-day avg</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {config.formatValue(stats.min)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {type === 'sleep' ? 'Min' : 'Lowest'}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {config.formatValue(stats.max)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Max</Text>
              </View>
            </View>

            <Text style={[styles.statsFooter, { color: colors.textSecondary }]}>
              {stats.count} entries total
            </Text>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading history...</Text>
          </View>
        ) : !entries || entries.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Ionicons name={config.icon} size={48} color={colors.gray300} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No data yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {type === 'weight' 
                ? 'Log your weight from the Log tab to start tracking'
                : 'Sync your devices or log manually to see history'}
            </Text>
          </View>
        ) : (
          Object.entries(groupedEntries).map(([date, dayEntries]) => (
            <View key={date} style={styles.dayGroup}>
              <Text style={[styles.dayHeader, { color: colors.textSecondary }]}>{date}</Text>
              {dayEntries.map((entry) => (
                <View key={entry.id} style={[styles.entryCard, { backgroundColor: colors.card }]}>
                  <View style={[styles.entryIcon, { backgroundColor: `${config.color}15` }]}>
                    <Ionicons name={config.icon} size={20} color={config.color} />
                  </View>
                  <View style={styles.entryContent}>
                    <View style={styles.entryMain}>
                      <Text style={[styles.entryValue, { color: colors.text }]}>
                        {config.formatValue(entry.value)} <Text style={styles.entryUnit}>{config.unit}</Text>
                      </Text>
                      <Text style={[styles.entryTime, { color: colors.textSecondary }]}>
                        {formatTime(entry.recorded_at)}
                      </Text>
                    </View>
                    <View style={styles.entryMeta}>
                      <View style={[styles.sourceTag, { backgroundColor: `${colors.primary}10` }]}>
                        <Ionicons name={getSourceIcon(entry.source)} size={12} color={colors.primary} />
                        <Text style={[styles.sourceText, { color: colors.primary }]}>
                          {entry.source.replace('_', ' ')}
                        </Text>
                      </View>
                      {entry.metadata?.quality && (
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                          Quality: {entry.metadata.quality}%
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: '600' },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 40 },
  statsFooter: { fontSize: 13, marginTop: 16 },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  emptyState: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
  dayGroup: {
    marginTop: 20,
  },
  dayHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entryCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryContent: { flex: 1 },
  entryMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryValue: { fontSize: 18, fontWeight: '700' },
  entryUnit: { fontSize: 14, fontWeight: '500' },
  entryTime: { fontSize: 13 },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  sourceText: { fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
  metaText: { fontSize: 12 },
});