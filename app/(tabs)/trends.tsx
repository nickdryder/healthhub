import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { TrendCard } from '@/components/trends/TrendCard';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { colors as staticColors } from '@/constants/colors';

type TimeRange = '7d' | '14d' | '30d' | '90d';

const timeRanges: { id: TimeRange; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '14d', label: '14 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
];

interface DataPoint {
  date: string;
  value: number;
}

export default function TrendsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('14d');

  // Memoize date calculations
  const startDate = useMemo(() => {
    const daysBack = parseInt(timeRange);
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return date;
  }, [timeRange]);

  // Memoize time range button handler
  const handleTimeRangePress = useCallback((rangeId: TimeRange) => {
    return () => setTimeRange(rangeId);
  }, []);

  const { data: trendData, isLoading } = useQuery({
    queryKey: ['trends', user?.id, timeRange],
    queryFn: async () => {
      if (!user) return null;

      const [metricsRes, logsRes] = await Promise.all([
        supabase
          .from('health_metrics')
          .select('metric_type, value, recorded_at')
          .eq('user_id', user.id)
          .gte('recorded_at', startDate.toISOString())
          .order('recorded_at', { ascending: true }),
        supabase
          .from('manual_logs')
          .select('log_type, value, severity, logged_at, metadata')
          .eq('user_id', user.id)
          .gte('logged_at', startDate.toISOString())
          .order('logged_at', { ascending: true }),
      ]);

      const metrics = (metricsRes.data || []) as { metric_type: string; value: number; recorded_at: string }[];
      const logs = (logsRes.data || []) as { log_type: string; value: string; severity: number | null; logged_at: string; metadata?: any }[];

      // Group metrics by type and aggregate by day
      const groupByDay = (items: { date: string; value: number }[]): DataPoint[] => {
        const grouped: Record<string, number[]> = {};
        items.forEach(item => {
          const day = item.date.split('T')[0];
          if (!grouped[day]) grouped[day] = [];
          grouped[day].push(item.value);
        });
        return Object.entries(grouped)
          .map(([date, values]) => ({
            date,
            value: values.reduce((a, b) => a + b, 0) / values.length,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
      };

      // Extract different metric types
      const sleep = groupByDay(
        metrics.filter(m => m.metric_type === 'sleep').map(m => ({ date: m.recorded_at, value: m.value }))
      );
      
      const heartRate = groupByDay(
        metrics.filter(m => m.metric_type === 'resting_heart_rate' || m.metric_type === 'heart_rate')
          .map(m => ({ date: m.recorded_at, value: m.value }))
      );
      
      const steps = groupByDay(
        metrics.filter(m => m.metric_type === 'steps').map(m => ({ date: m.recorded_at, value: m.value }))
      );
      
      const calories = groupByDay(
        metrics.filter(m => m.metric_type === 'calories_consumed').map(m => ({ date: m.recorded_at, value: m.value }))
      );

      // Manual logs
      const caffeine = groupByDay(
        logs.filter(l => l.log_type === 'caffeine').map(l => ({ date: l.logged_at, value: parseFloat(l.value) || 0 }))
      );

      const symptoms = groupByDay(
        logs.filter(l => l.log_type === 'symptom' && l.severity).map(l => ({ date: l.logged_at, value: l.severity! }))
      );

      const bristol = groupByDay(
        logs.filter(l => l.log_type === 'bristol_stool').map(l => ({ 
          date: l.logged_at, 
          value: parseInt(l.value.replace('Type ', '')) || 4 
        }))
      );

      return { sleep, heartRate, steps, calories, caffeine, symptoms, bristol };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Trends</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Track your progress over time</Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.timeRangeScroll}
          contentContainerStyle={styles.timeRangeContent}
        >
          {timeRanges.map((range) => (
            <TouchableOpacity
              key={range.id}
              style={[
                styles.timeRangeButton,
                { backgroundColor: colors.card },
                timeRange === range.id && { backgroundColor: colors.primary },
              ]}
              onPress={handleTimeRangePress(range.id)}
              activeOpacity={0.7}
              accessibilityLabel={`View trends for ${range.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: timeRange === range.id }}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  { color: colors.textSecondary },
                  timeRange === range.id && { color: '#FFFFFF' },
                ]}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!user ? (
          <View style={[styles.signInPrompt, { backgroundColor: colors.card }]}>
            <Ionicons name="analytics-outline" size={48} color={colors.gray300} />
            <Text style={[styles.signInTitle, { color: colors.text }]}>Sign in to view trends</Text>
            <Text style={[styles.signInSubtitle, { color: colors.textSecondary }]}>
              Track your health data over time
            </Text>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading trends...</Text>
          </View>
        ) : (
          <View style={styles.chartsContainer}>
            <TrendCard
              title="Sleep"
              icon="moon"
              color={staticColors.sleep}
              data={trendData?.sleep || []}
              unit="hrs"
              cardBg={colors.card}
              textColor={colors.text}
              textSecondary={colors.textSecondary}
            />

            <TrendCard
              title="Heart Rate"
              icon="heart"
              color={staticColors.heartRate}
              data={trendData?.heartRate || []}
              unit="bpm"
              cardBg={colors.card}
              textColor={colors.text}
              textSecondary={colors.textSecondary}
            />

            <TrendCard
              title="Steps"
              icon="footsteps"
              color={staticColors.steps}
              data={trendData?.steps || []}
              unit="steps"
              cardBg={colors.card}
              textColor={colors.text}
              textSecondary={colors.textSecondary}
            />

            <TrendCard
              title="Calories Consumed"
              icon="nutrition"
              color={staticColors.calories}
              data={trendData?.calories || []}
              unit="kcal"
              cardBg={colors.card}
              textColor={colors.text}
              textSecondary={colors.textSecondary}
            />

            <TrendCard
              title="Caffeine"
              icon="cafe"
              color={staticColors.warning}
              data={trendData?.caffeine || []}
              unit="mg"
              cardBg={colors.card}
              textColor={colors.text}
              textSecondary={colors.textSecondary}
            />

            <TrendCard
              title="Symptom Severity"
              icon="medical"
              color={staticColors.error}
              data={trendData?.symptoms || []}
              unit="/10"
              cardBg={colors.card}
              textColor={colors.text}
              textSecondary={colors.textSecondary}
            />

            <TrendCard
              title="Bristol Scale"
              icon="analytics"
              color={staticColors.info}
              data={trendData?.bristol || []}
              unit="type"
              cardBg={colors.card}
              textColor={colors.text}
              textSecondary={colors.textSecondary}
            />
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  timeRangeScroll: {
    marginBottom: 20,
  },
  timeRangeContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartsContainer: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  signInPrompt: {
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  signInTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  signInSubtitle: {
    fontSize: 14,
  },
});
