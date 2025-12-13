import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { useInsights } from '@/hooks/useHealthData';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useInsightCache } from '@/providers/InsightCacheProvider';
import { supabase } from '@/integrations/supabase/client';
import { colors as staticColors } from '@/constants/colors';
import { formatSnakeCase } from '@/services/formatting-utils';

type InsightFilter = 'all' | 'correlation' | 'prediction' | 'recommendation';

const filters: { id: InsightFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'correlation', label: 'Correlations' },
  { id: 'prediction', label: 'Predictions' },
  { id: 'recommendation', label: 'Tips' },
];

// Fallback insights when no real data exists
const fallbackInsights = [
  {
    id: '7',
    type: 'prediction' as const,
    title: 'Early shift tomorrow',
    description: 'You have "Morning Shift" at 6:00 AM. Consider going to bed by 10 PM tonight.',
    confidence: 0.95,
  },
  {
    id: '1',
    type: 'correlation' as const,
    title: 'Coffee affects your sleep',
    description: 'When you have coffee after 2pm, your sleep quality drops by 23% on average.',
    confidence: 0.87,
  },
  {
    id: '8',
    type: 'correlation' as const,
    title: 'Mondays are stressful',
    description: 'Your heart rate is 12% higher on Mondays. You also report more headaches.',
    confidence: 0.81,
  },
  {
    id: '9',
    type: 'recommendation' as const,
    title: 'Plan rest after busy weeks',
    description: 'Weeks with 5+ meetings correlate with 30% worse sleep. Next week looks busy.',
    confidence: 0.76,
  },
  {
    id: '3',
    type: 'recommendation' as const,
    title: 'Try earlier dinner',
    description: 'Your digestion logs suggest eating before 7pm could reduce bloating by 40%.',
    confidence: 0.91,
  },
  {
    id: '4',
    type: 'correlation' as const,
    title: 'Sleep & joint pain link',
    description: 'Nights with less than 6 hours of sleep correlate with 65% more joint pain reports.',
    confidence: 0.83,
  },
  {
    id: '5',
    type: 'prediction' as const,
    title: 'Good sleep tonight',
    description: "Based on your activity and no late caffeine, you're likely to sleep well tonight.",
    confidence: 0.78,
  },
  {
    id: '6',
    type: 'recommendation' as const,
    title: 'Consider probiotics',
    description: 'Your Bristol scale logs show irregular patterns. Probiotics may help normalize digestion.',
    confidence: 0.69,
  },
];

// Calculate health score from real data
function calculateHealthScore(metrics: any[], logs: any[]): number {
  let totalScore = 0;
  let totalPossible = 0;

  // Sleep Score (0-25)
  const sleepMax = 25;
  totalPossible += sleepMax;
  const sleepData = metrics.filter((m: any) => m.metric_type === 'sleep');
  if (sleepData.length > 0) {
    const avgSleep = sleepData.reduce((sum: number, m: any) => sum + m.value, 0) / sleepData.length;
    if (avgSleep >= 7 && avgSleep <= 9) totalScore += sleepMax;
    else if (avgSleep >= 6 && avgSleep < 7) totalScore += sleepMax * 0.7;
    else if (avgSleep > 9 && avgSleep <= 10) totalScore += sleepMax * 0.8;
    else if (avgSleep >= 5) totalScore += sleepMax * 0.5;
    else totalScore += sleepMax * 0.3;
  }

  // Activity Score (0-25)
  const activityMax = 25;
  totalPossible += activityMax;
  const stepsData = metrics.filter((m: any) => m.metric_type === 'steps');
  if (stepsData.length > 0) {
    const avgSteps = stepsData.reduce((sum: number, m: any) => sum + m.value, 0) / stepsData.length;
    if (avgSteps >= 10000) totalScore += activityMax;
    else if (avgSteps >= 7500) totalScore += activityMax * 0.85;
    else if (avgSteps >= 5000) totalScore += activityMax * 0.65;
    else if (avgSteps >= 3000) totalScore += activityMax * 0.45;
    else totalScore += activityMax * 0.25;
  }

  // Heart Health (0-20)
  const heartMax = 20;
  totalPossible += heartMax;
  const hrData = metrics.filter((m: any) => m.metric_type === 'resting_heart_rate' || m.metric_type === 'heart_rate');
  if (hrData.length > 0) {
    const avgHR = hrData.reduce((sum: number, m: any) => sum + m.value, 0) / hrData.length;
    if (avgHR >= 50 && avgHR <= 70) totalScore += heartMax;
    else if (avgHR > 70 && avgHR <= 80) totalScore += heartMax * 0.8;
    else if (avgHR > 80 && avgHR <= 90) totalScore += heartMax * 0.6;
    else if (avgHR < 50) totalScore += heartMax * 0.7;
    else totalScore += heartMax * 0.4;
  }

  // Consistency (0-15)
  const consistencyMax = 15;
  totalPossible += consistencyMax;
  const daysWithData = new Set([
    ...metrics.map((m: any) => new Date(m.recorded_at).toDateString()),
    ...logs.map((l: any) => new Date(l.logged_at).toDateString()),
  ]).size;
  if (daysWithData >= 7) totalScore += consistencyMax;
  else if (daysWithData >= 5) totalScore += consistencyMax * 0.8;
  else if (daysWithData >= 3) totalScore += consistencyMax * 0.5;
  else if (daysWithData >= 1) totalScore += consistencyMax * 0.3;

  // Wellness Tracking (0-15)
  const awarenessMax = 15;
  totalPossible += awarenessMax;
  const wellnessLogs = logs.filter((l: any) => 
    l.log_type === 'symptom' || l.log_type === 'supplement' || l.log_type === 'exercise'
  ).length;
  if (wellnessLogs >= 10) totalScore += awarenessMax;
  else if (wellnessLogs >= 5) totalScore += awarenessMax * 0.7;
  else if (wellnessLogs >= 2) totalScore += awarenessMax * 0.4;
  else if (wellnessLogs >= 1) totalScore += awarenessMax * 0.2;

  return totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
}

// Create a helper function to format descriptions
function formatInsightDescription(description: string): string {
  return description.replace(
    /([a-z_]+)/g,
    (match) => {
      if (match.includes('_')) {
        return formatSnakeCase(match);
      }
      return match;
    }
  );
}
export default function InsightsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { cacheInsight } = useInsightCache();
  const [activeFilter, setActiveFilter] = useState<InsightFilter>('all');
  const { data: storedInsights, isLoading } = useInsights(20);

  // Fetch data for health score calculation
  const { data: scoreData } = useQuery({
    queryKey: ['health-score-summary', user?.id],
    queryFn: async () => {
      if (!user) return { metrics: [], logs: [] };
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [metricsRes, logsRes] = await Promise.all([
        supabase
          .from('health_metrics')
          .select('metric_type, value, recorded_at')
          .eq('user_id', user.id)
          .neq('source', 'apple_health_mock')
          .gte('recorded_at', sevenDaysAgo),
        supabase
          .from('manual_logs')
          .select('log_type, value, logged_at')
          .eq('user_id', user.id)
          .gte('logged_at', sevenDaysAgo),
      ]);
      return { metrics: metricsRes.data || [], logs: logsRes.data || [] };
    },
    enabled: !!user,
  });

  const healthScore = calculateHealthScore(scoreData?.metrics || [], scoreData?.logs || []);
  const dataPointsCount = (scoreData?.metrics?.length || 0) + (scoreData?.logs?.length || 0);

  // Use stored insights or fallback
  const allInsights = storedInsights && storedInsights.length > 0
    ? storedInsights.map(i => ({
        id: i.id,
        type: i.insight_type,
        title: i.title,
        description: i.description,
        confidence: i.confidence || 0.75,
      }))
    : fallbackInsights;

  const filteredInsights = activeFilter === 'all' 
    ? allInsights 
    : allInsights.filter(i => i.type === activeFilter);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>AI Insights</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Personalized health correlations & predictions</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/health-score')}
        >
          <LinearGradient
            colors={[colors.primary, '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryIcon}>
              <Ionicons name="sparkles" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>Your Health Score</Text>
              <Text style={styles.summaryDescription}>
                Based on {dataPointsCount} data points this week.
              </Text>
              <View style={styles.tapHintRow}>
                <Text style={styles.tapHint}>Tap to learn more</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
              </View>
            </View>
            <View style={[styles.scoreCircle, { backgroundColor: colors.card }]}>
              <Text style={[styles.scoreValue, { color: colors.primary }]}>{healthScore}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterButton, { backgroundColor: colors.card }, activeFilter === filter.id && { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}
              onPress={() => setActiveFilter(filter.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterLabel, { color: colors.textSecondary }, activeFilter === filter.id && { color: colors.primary }]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading insights...</Text>
          </View>
        ) : (
          <View style={styles.insightsList}>
            {filteredInsights.map((insight) => (
              <InsightCard 
                key={insight.id} 
                {...insight} 
                onPress={() => {
                  cacheInsight({
                    id: insight.id,
                    type: insight.type as 'correlation' | 'prediction' | 'recommendation',
                    title: insight.title,
                    description: insight.description,
                    confidence: insight.confidence,
                    relatedMetrics: [],
                    createdAt: new Date().toISOString(),
                  });
                  router.push(`/insight/${insight.id}`);
                }}
              >
                <Text style={styles.description}>{formatInsightDescription(insight.description)}</Text>
              </InsightCard>
            ))}
          </View>
        )}

        <View style={styles.dataNote}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.dataNoteText, { color: colors.textSecondary }]}>
            Insights are generated from your logged data. The more you log, the better the predictions.
          </Text>
        </View>

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
  summaryCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContent: {
    flex: 1,
    marginLeft: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  summaryDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  tapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 2,
  },
  tapHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  filters: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterButtonActive: {},
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterLabelActive: {},
  insightsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  dataNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 8,
  },
  dataNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  description: {
    fontSize: 14,
    color: staticColors.grayDark,
    marginTop: 4,
  },
});