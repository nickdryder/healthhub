import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { CycleCard } from '@/components/dashboard/CycleCard';
import { useHealthMetrics, useInsights, MacroData } from '@/hooks/useHealthData';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { colors as staticColors } from '@/constants/colors';
import { cycleTracking } from '@/services/cycle-tracking';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { data: metrics, isLoading: metricsLoading } = useHealthMetrics();
  const { data: storedInsights, isLoading: insightsLoading } = useInsights(3);
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false);

  // Fetch food entries for today to calculate macros
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: foodEntries = [] } = useQuery({
    queryKey: ['food-entries-today', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', todayStart.toISOString())
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    cycleTracking.isCycleTrackingEnabled().then(setCycleTrackingEnabled);
  }, []);

  // Memoize greeting to avoid recalculation on every render
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Memoize date string to avoid recalculation
  const today = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  // Navigate to settings - memoized to prevent recreation
  const handleProfilePress = useCallback(() => {
    router.push('/(tabs)/settings');
  }, []);

  // Navigate to auth - memoized
  const handleSignInPress = useCallback(() => {
    router.push('/auth');
  }, []);

  // Navigate to insights - memoized
  const handleSeeAllInsights = useCallback(() => {
    router.push('/(tabs)/insights');
  }, []);

  // Navigate to metric detail - memoized with metricType parameter
  const handleMetricPress = useCallback((metricType: string) => {
    return () => router.push(`/metric/${metricType}` as any);
  }, []);

  // Navigate to insight detail - memoized with insightId parameter
  const handleInsightPress = useCallback((insightId: string, insightTitle: string) => {
    return () => {
      console.log('[Dashboard] Navigating to insight:', insightId, insightTitle);
      router.push(`/insight/${insightId}` as any);
    };
  }, []);

  // Memoize metrics array - only recalculate when metrics data changes
  const displayMetrics = useMemo(() => [
    { 
      title: 'Sleep', 
      value: metrics?.sleep?.value?.toString() || '--', 
      unit: 'hrs', 
      icon: 'moon' as const, 
      color: staticColors.sleep, 
      trend: metrics?.sleep?.trend ? { value: Math.abs(metrics.sleep.trend), isPositive: metrics.sleep.trend > 0 } : undefined,
      metricType: 'sleep',
    },
    { 
      title: 'Heart Rate', 
      value: metrics?.heartRate?.value?.toString() || '--', 
      unit: 'bpm', 
      icon: 'heart' as const, 
      color: staticColors.heartRate, 
      trend: metrics?.heartRate?.trend ? { value: Math.abs(metrics.heartRate.trend), isPositive: metrics.heartRate.trend > 0 } : undefined,
      invertTrendColors: true,
      metricType: 'heart_rate',
    },
    { 
      title: 'Steps', 
      value: metrics?.steps?.value ? Math.floor(metrics.steps.value).toLocaleString() : '--', 
      unit: 'steps', 
      icon: 'footsteps' as const, 
      color: staticColors.steps, 
      trend: metrics?.steps?.trend ? { value: Math.abs(metrics.steps.trend), isPositive: metrics.steps.trend > 0 } : undefined,
      metricType: 'steps',
    },
    { 
      title: 'Weight', 
      value: metrics?.weight?.movingAvg?.toString() || '--', 
      unit: 'kg', 
      icon: 'scale' as const, 
      color: staticColors.primary,
      subtitle: metrics?.weight ? `7-day avg` : undefined,
      trend: metrics?.weight?.trend ? { value: Math.abs(metrics.weight.trend), isPositive: metrics.weight.trend > 0 } : undefined,
      invertTrendColors: true,
      metricType: 'weight',
    },
  ], [metrics]); // Only recalculate when metrics change

  // Memoize insights mapping - only recalculate when storedInsights change
  const displayInsights = useMemo(() =>
    (storedInsights || []).map(i => ({
    id: i.id,
    type: i.insight_type,
    title: i.title,
    description: i.description,
    confidence: i.confidence || 0.75,
  })), [storedInsights]); // Only recalculate when insights change

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>{greeting}</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{today}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfilePress}
            accessibilityLabel="Open settings"
            accessibilityRole="button"
          >
            <Ionicons name="person-circle-outline" size={40} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.streakSection}>
          <StreakCard />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Overview</Text>
          {metricsLoading ? (
            <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading health data...</Text>
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              {displayMetrics.map((metric) => (
                <MetricCard
                  key={metric.metricType} 
                  title={metric.title}
                  value={metric.value}
                  unit={metric.unit}
                  icon={metric.icon}
                  color={metric.color}
                  trend={metric.trend}
                  invertTrendColors={metric.invertTrendColors}
                  subtitle={metric.subtitle}
                  onPress={handleMetricPress(metric.metricType)}
                />
              ))}
            </View>
          )}
          {!user && (
            <TouchableOpacity
              style={[styles.signInPrompt, { backgroundColor: `${colors.primary}15` }]}
              onPress={handleSignInPress}
              accessibilityLabel="Sign in to sync health data"
              accessibilityRole="button"
            >
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.signInText, { color: colors.primary }]}>Sign in to sync your health data</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Insights</Text>
            <TouchableOpacity
              onPress={handleSeeAllInsights}
              accessibilityLabel="See all insights"
              accessibilityRole="button"
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {insightsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : displayInsights.length > 0 ? (
            <View style={styles.insightsList}>
              {displayInsights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  {...insight}
                  onPress={handleInsightPress(insight.id, insight.title)}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyInsights, { backgroundColor: colors.card }]}>
              <Ionicons name="bulb-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyInsightsText, { color: colors.textSecondary }]}>Log more health data to unlock AI insights</Text>
            </View>
          )}
        </View>

        {(foodEntries.length > 0 || !metricsLoading) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition</Text>
            <MacroCard 
              foodEntries={foodEntries} 
              colors={colors} 
            />
          </View>
        )}

        {cycleTrackingEnabled && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Cycle Tracking</Text>
            <CycleCard />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Log</Text>
          <View style={styles.quickLogGrid}>
            <QuickLogButton icon="cafe" label="Caffeine" color={staticColors.warning} cardBg={colors.card} textColor={colors.text} logType="caffeine" />
            <QuickLogButton icon="scale" label="Weight" color={staticColors.primary} cardBg={colors.card} textColor={colors.text} logType="weight" />
            <QuickLogButton icon="pulse" label="Symptom" color={staticColors.error} cardBg={colors.card} textColor={colors.text} logType="symptom" />
            <QuickLogButton icon="barbell" label="Exercise" color={staticColors.success} cardBg={colors.card} textColor={colors.text} logType="exercise" />
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const QuickLogButton = React.memo(({ icon, label, color, cardBg, textColor, logType }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; cardBg: string; textColor: string; logType: string }) => {
  const handlePress = useCallback(() => {
    router.push({ pathname: '/(tabs)/log', params: { type: logType } });
  }, [logType]);

  return (
    <TouchableOpacity
      style={[styles.quickLogButton, { backgroundColor: cardBg }]}
      activeOpacity={0.7}
      onPress={handlePress}
      accessibilityLabel={`Log ${label.toLowerCase()}`}
      accessibilityRole="button"
    >
      <View style={[styles.quickLogIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.quickLogLabel, { color: textColor }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
});

interface FoodEntry {
  id: string;
  user_id: string;
  logged_at: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  [key: string]: any;
}

const MacroCard = React.memo(({ foodEntries = [], colors }: { foodEntries?: FoodEntry[]; colors: any }) => {
  // Memoize macro calculations - only recalculate when foodEntries change
  const macros = useMemo(() => {
    const totalCalories = Math.round(foodEntries?.reduce((sum, e) => sum + (Number(e.calories) || 0), 0) || 0);
    const proteinRaw = foodEntries?.reduce((sum, e) => sum + (Number(e.protein) || 0), 0) || 0;
    const carbsRaw = foodEntries?.reduce((sum, e) => sum + (Number(e.carbs) || 0), 0) || 0;
    const fatRaw = foodEntries?.reduce((sum, e) => sum + (Number(e.fat) || 0), 0) || 0;

    // Format to 1 decimal place
    const protein = Math.round(proteinRaw * 10) / 10;
    const carbs = Math.round(carbsRaw * 10) / 10;
    const fat = Math.round(fatRaw * 10) / 10;
    const total = protein + carbs + fat;

    const proteinPct = total > 0 ? (protein / total) * 100 : 0;
    const carbsPct = total > 0 ? (carbs / total) * 100 : 0;
    const fatPct = total > 0 ? (fat / total) * 100 : 0;

    return { totalCalories, protein, carbs, fat, proteinPct, carbsPct, fatPct };
  }, [foodEntries]);

  const handlePress = useCallback(() => {
    router.push('/food-log' as any);
  }, []);

  return (
    <TouchableOpacity
      style={[styles.macroCard, { backgroundColor: colors.card }]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`View food log. Today's intake: ${macros.totalCalories} calories`}
      accessibilityRole="button"
    >
      <View style={styles.macroHeader}>
        <Text style={[styles.macroTitle, { color: colors.text }]}>Today's Intake</Text>
        <View style={styles.macroHeaderRight}>
          <Text style={[styles.macroCalories, { color: colors.textSecondary }]}>{macros.totalCalories} kcal</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.macroBar}>
        <View style={[styles.macroSegment, { flex: macros.proteinPct, backgroundColor: '#FF6B6B' }]} />
        <View style={[styles.macroSegment, { flex: macros.carbsPct, backgroundColor: '#4ECDC4' }]} />
        <View style={[styles.macroSegment, { flex: macros.fatPct, backgroundColor: '#FFE66D' }]} />
      </View>

      <View style={styles.macroLegend}>
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: '#FF6B6B' }]} />
          <View>
            <Text style={[styles.macroValue, { color: colors.text }]}>{macros.protein}g</Text>
            <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Protein</Text>
          </View>
        </View>
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: '#4ECDC4' }]} />
          <View>
            <Text style={[styles.macroValue, { color: colors.text }]}>{macros.carbs}g</Text>
            <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Carbs</Text>
          </View>
        </View>
        <View style={[styles.macroItem]}>
          <View style={[styles.macroDot, { backgroundColor: '#FFE66D' }]} />
          <View>
            <Text style={[styles.macroValue, { color: colors.text }]}>{macros.fat}g</Text>
            <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Fat</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.tapHint, { color: colors.textSecondary }]}>Tap to view food items & add tags</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
  },
  date: {
    fontSize: 15,
    marginTop: 2,
  },
  streakSection: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  profileButton: {
    padding: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  insightsList: {
    gap: 12,
  },
  quickLogGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickLogButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickLogIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLogLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  signInPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  signInText: {
    fontSize: 14,
    fontWeight: '500',
  },
  macroCard: {
    borderRadius: 16,
    padding: 16,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  macroTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  macroCalories: {
    fontSize: 14,
    fontWeight: '500',
  },
  macroBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  macroSegment: {
    height: '100%',
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  macroLabel: {
    fontSize: 12,
  },
  macroHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyInsights: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    gap: 8,
  },
  emptyInsightsText: {
    fontSize: 14,
    textAlign: 'center',
  },
});