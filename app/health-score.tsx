import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { colors as staticColors } from '@/constants/colors';

interface ScoreComponent {
  name: string;
  score: number;
  maxScore: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
  status: 'good' | 'fair' | 'needs-attention';
}

function calculateHealthScore(metrics: any, logs: any) {
  const components: ScoreComponent[] = [];
  let totalScore = 0;
  let totalPossible = 0;

  // Sleep Score (0-25 points)
  const sleepMax = 25;
  totalPossible += sleepMax;
  const sleepData = metrics.filter((m: any) => m.metric_type === 'sleep');
  if (sleepData.length > 0) {
    const avgSleep = sleepData.reduce((sum: number, m: any) => sum + m.value, 0) / sleepData.length;
    // Optimal sleep: 7-9 hours = full points, <6 or >10 = reduced
    let sleepScore = 0;
    if (avgSleep >= 7 && avgSleep <= 9) {
      sleepScore = sleepMax;
    } else if (avgSleep >= 6 && avgSleep < 7) {
      sleepScore = sleepMax * 0.7;
    } else if (avgSleep > 9 && avgSleep <= 10) {
      sleepScore = sleepMax * 0.8;
    } else if (avgSleep >= 5) {
      sleepScore = sleepMax * 0.5;
    } else {
      sleepScore = sleepMax * 0.3;
    }
    totalScore += sleepScore;
    components.push({
      name: 'Sleep',
      score: Math.round(sleepScore),
      maxScore: sleepMax,
      icon: 'moon',
      color: staticColors.sleep,
      description: `Avg ${avgSleep.toFixed(1)} hrs/night. ${avgSleep >= 7 && avgSleep <= 9 ? 'Optimal range!' : avgSleep < 7 ? 'Try for 7+ hours.' : 'Consider slightly less sleep.'}`,
      status: avgSleep >= 7 && avgSleep <= 9 ? 'good' : avgSleep >= 6 ? 'fair' : 'needs-attention',
    });
  } else {
    components.push({
      name: 'Sleep',
      score: 0,
      maxScore: sleepMax,
      icon: 'moon',
      color: staticColors.sleep,
      description: 'No sleep data. Sync a device or log manually.',
      status: 'needs-attention',
    });
  }

  // Activity Score (0-25 points)
  const activityMax = 25;
  totalPossible += activityMax;
  const stepsData = metrics.filter((m: any) => m.metric_type === 'steps');
  if (stepsData.length > 0) {
    const avgSteps = stepsData.reduce((sum: number, m: any) => sum + m.value, 0) / stepsData.length;
    let activityScore = 0;
    if (avgSteps >= 10000) {
      activityScore = activityMax;
    } else if (avgSteps >= 7500) {
      activityScore = activityMax * 0.85;
    } else if (avgSteps >= 5000) {
      activityScore = activityMax * 0.65;
    } else if (avgSteps >= 3000) {
      activityScore = activityMax * 0.45;
    } else {
      activityScore = activityMax * 0.25;
    }
    totalScore += activityScore;
    components.push({
      name: 'Activity',
      score: Math.round(activityScore),
      maxScore: activityMax,
      icon: 'footsteps',
      color: staticColors.steps,
      description: `Avg ${Math.floor(avgSteps).toLocaleString()} steps/day. ${avgSteps >= 7500 ? 'Great activity!' : 'Try to reach 7,500+ steps.'}`,
      status: avgSteps >= 7500 ? 'good' : avgSteps >= 5000 ? 'fair' : 'needs-attention',
    });
  } else {
    components.push({
      name: 'Activity',
      score: 0,
      maxScore: activityMax,
      icon: 'footsteps',
      color: staticColors.steps,
      description: 'No activity data. Sync a device to track steps.',
      status: 'needs-attention',
    });
  }

  // Heart Health Score (0-20 points)
  const heartMax = 20;
  totalPossible += heartMax;
  const hrData = metrics.filter((m: any) => m.metric_type === 'resting_heart_rate' || m.metric_type === 'heart_rate');
  if (hrData.length > 0) {
    const avgHR = hrData.reduce((sum: number, m: any) => sum + m.value, 0) / hrData.length;
    let heartScore = 0;
    // Lower resting HR generally better (50-70 optimal for most)
    if (avgHR >= 50 && avgHR <= 70) {
      heartScore = heartMax;
    } else if (avgHR > 70 && avgHR <= 80) {
      heartScore = heartMax * 0.8;
    } else if (avgHR > 80 && avgHR <= 90) {
      heartScore = heartMax * 0.6;
    } else if (avgHR < 50) {
      heartScore = heartMax * 0.7; // Very low can be athletic or concerning
    } else {
      heartScore = heartMax * 0.4;
    }
    totalScore += heartScore;
    components.push({
      name: 'Heart Health',
      score: Math.round(heartScore),
      maxScore: heartMax,
      icon: 'heart',
      color: staticColors.heartRate,
      description: `Avg ${Math.round(avgHR)} bpm. ${avgHR <= 70 ? 'Healthy range!' : 'Consider cardio exercise.'}`,
      status: avgHR <= 70 ? 'good' : avgHR <= 80 ? 'fair' : 'needs-attention',
    });
  } else {
    components.push({
      name: 'Heart Health',
      score: 0,
      maxScore: heartMax,
      icon: 'heart',
      color: staticColors.heartRate,
      description: 'No heart rate data. Sync a device to track.',
      status: 'needs-attention',
    });
  }

  // Consistency Score (0-15 points) - based on logging frequency
  const consistencyMax = 15;
  totalPossible += consistencyMax;
  const totalEntries = metrics.length + logs.length;
  const daysWithData = new Set([
    ...metrics.map((m: any) => new Date(m.recorded_at).toDateString()),
    ...logs.map((l: any) => new Date(l.logged_at).toDateString()),
  ]).size;
  
  let consistencyScore = 0;
  if (daysWithData >= 7) {
    consistencyScore = consistencyMax;
  } else if (daysWithData >= 5) {
    consistencyScore = consistencyMax * 0.8;
  } else if (daysWithData >= 3) {
    consistencyScore = consistencyMax * 0.5;
  } else if (daysWithData >= 1) {
    consistencyScore = consistencyMax * 0.3;
  }
  totalScore += consistencyScore;
  components.push({
    name: 'Consistency',
    score: Math.round(consistencyScore),
    maxScore: consistencyMax,
    icon: 'calendar',
    color: staticColors.primary,
    description: `Logged data on ${daysWithData} of last 7 days. ${daysWithData >= 5 ? 'Great habit!' : 'Log daily for better insights.'}`,
    status: daysWithData >= 5 ? 'good' : daysWithData >= 3 ? 'fair' : 'needs-attention',
  });

  // Wellness Awareness Score (0-15 points) - based on symptom/supplement tracking
  const awarenessMax = 15;
  totalPossible += awarenessMax;
  const symptomLogs = logs.filter((l: any) => l.log_type === 'symptom');
  const supplementLogs = logs.filter((l: any) => l.log_type === 'supplement');
  const exerciseLogs = logs.filter((l: any) => l.log_type === 'exercise');
  const totalWellnessLogs = symptomLogs.length + supplementLogs.length + exerciseLogs.length;
  
  let awarenessScore = 0;
  if (totalWellnessLogs >= 10) {
    awarenessScore = awarenessMax;
  } else if (totalWellnessLogs >= 5) {
    awarenessScore = awarenessMax * 0.7;
  } else if (totalWellnessLogs >= 2) {
    awarenessScore = awarenessMax * 0.4;
  } else if (totalWellnessLogs >= 1) {
    awarenessScore = awarenessMax * 0.2;
  }
  totalScore += awarenessScore;
  components.push({
    name: 'Wellness Tracking',
    score: Math.round(awarenessScore),
    maxScore: awarenessMax,
    icon: 'fitness',
    color: staticColors.success,
    description: `${totalWellnessLogs} wellness entries (symptoms, supplements, exercise). ${totalWellnessLogs >= 5 ? 'Good tracking!' : 'Log more for better insights.'}`,
    status: totalWellnessLogs >= 5 ? 'good' : totalWellnessLogs >= 2 ? 'fair' : 'needs-attention',
  });

  const finalScore = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  return { score: finalScore, components, totalEntries };
}

export default function HealthScoreScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['health-score-data', user?.id],
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
          .select('log_type, value, severity, logged_at')
          .eq('user_id', user.id)
          .gte('logged_at', sevenDaysAgo),
      ]);

      return {
        metrics: metricsRes.data || [],
        logs: logsRes.data || [],
      };
    },
    enabled: !!user,
  });

  const { score, components, totalEntries } = calculateHealthScore(
    data?.metrics || [],
    data?.logs || []
  );

  const getScoreColor = (s: number) => {
    if (s >= 80) return staticColors.success;
    if (s >= 60) return staticColors.warning;
    return staticColors.error;
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'good': return 'checkmark-circle';
      case 'fair': return 'remove-circle';
      default: return 'alert-circle';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return staticColors.success;
      case 'fair': return staticColors.warning;
      default: return staticColors.error;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Health Score</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Main Score Card */}
        <LinearGradient
          colors={[getScoreColor(score), colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scoreCard}
        >
          <View style={styles.scoreMain}>
            <Text style={styles.scoreNumber}>{score}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <Text style={styles.scoreLabel}>
            {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Attention'}
          </Text>
          <Text style={styles.scoreSubtitle}>
            Based on {totalEntries} data points from the last 7 days
          </Text>
        </LinearGradient>

        {/* How It Works */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={22} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>How It's Calculated</Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Your Health Score is a weighted combination of 5 key health dimensions, calculated from your last 7 days of data. Each component contributes to your overall wellness picture.
          </Text>
        </View>

        {/* Score Breakdown */}
        <Text style={[styles.breakdownTitle, { color: colors.text }]}>Score Breakdown</Text>
        
        {components.map((component, index) => (
          <View key={index} style={[styles.componentCard, { backgroundColor: colors.card }]}>
            <View style={styles.componentHeader}>
              <View style={[styles.componentIcon, { backgroundColor: `${component.color}15` }]}>
                <Ionicons name={component.icon} size={22} color={component.color} />
              </View>
              <View style={styles.componentInfo}>
                <Text style={[styles.componentName, { color: colors.text }]}>{component.name}</Text>
                <Text style={[styles.componentScore, { color: colors.textSecondary }]}>
                  {component.score} / {component.maxScore} pts
                </Text>
              </View>
              <Ionicons 
                name={getStatusIcon(component.status)} 
                size={24} 
                color={getStatusColor(component.status)} 
              />
            </View>
            
            {/* Progress Bar */}
            <View style={[styles.progressBar, { backgroundColor: colors.gray100 }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${(component.score / component.maxScore) * 100}%`,
                    backgroundColor: component.color,
                  }
                ]} 
              />
            </View>
            
            <Text style={[styles.componentDesc, { color: colors.textSecondary }]}>
              {component.description}
            </Text>
          </View>
        ))}

        {/* Tips Section */}
        <View style={[styles.section, { backgroundColor: colors.card, marginBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={22} color={staticColors.warning} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Improve Your Score</Text>
          </View>
          <View style={styles.tipsList}>
            <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
              • Aim for 7-9 hours of sleep each night
            </Text>
            <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
              • Target 7,500+ steps daily
            </Text>
            <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
              • Log symptoms, supplements & exercise regularly
            </Text>
            <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
              • Sync your health devices for automatic tracking
            </Text>
            <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
              • Keep a consistent logging habit (daily if possible)
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  scoreCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  scoreMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    fontSize: 72,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scoreMax: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 4,
  },
  scoreLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
  },
  componentCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  componentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  componentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  componentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  componentName: {
    fontSize: 16,
    fontWeight: '600',
  },
  componentScore: {
    fontSize: 13,
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 12,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  componentDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 14,
    lineHeight: 20,
  },
});