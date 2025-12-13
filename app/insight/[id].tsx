import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { useInsightCache } from '@/providers/InsightCacheProvider';
import { supabase } from '@/integrations/supabase/client';
import { formatSnakeCase } from '@/services/formatting-utils';

interface InsightData {
  id: string;
  type: 'correlation' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  relatedMetrics: string[];
  createdAt: string;
}

export default function InsightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { getInsight } = useInsightCache();
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInsight() {
      try {
        if (!id) {
          console.log('[Insight] No ID provided');
          setLoading(false);
          return;
        }

        console.log('[Insight] Loading insight:', id);

        // Try cache first
        const cached = getInsight(id);
        if (cached) {
          console.log('[Insight] Got from cache');
          setInsight(cached);
          setLoading(false);
          return;
        }

        // Fetch from DB
        console.log('[Insight] Fetching from DB');
        const { data, error } = await supabase
          .from('ai_insights')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          console.error('[Insight] Error:', error);
          setLoading(false);
          return;
        }

        const insightData: InsightData = {
          id: data.id,
          type: data.insight_type as 'correlation' | 'prediction' | 'recommendation',
          title: data.title,
          description: data.description,
          confidence: data.confidence || 0.75,
          relatedMetrics: data.related_metrics || [],
          createdAt: data.created_at || new Date().toISOString(),
        };

        console.log('[Insight] Loaded:', insightData.title);
        setInsight(insightData);
      } catch (err) {
        console.error('[Insight] Exception:', err);
      } finally {
        setLoading(false);
      }
    }

    loadInsight();
  }, [id]);
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Insight</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!insight) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Insight</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.notFound, { color: colors.text }]}>Insight not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig: Record<string, { label: string; icon: string; gradient: string[] }> = {
    correlation: { label: 'Correlation', icon: 'link', gradient: ['#3B82F6', '#1E40AF'] },
    prediction: { label: 'Prediction', icon: 'trending-up', gradient: ['#10B981', '#047857'] },
    recommendation: { label: 'Recommendation', icon: 'bulb', gradient: ['#F59E0B', '#D97706'] },
  };
  const config = typeConfig[insight.type] || typeConfig.recommendation;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Insight</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={config.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <Ionicons name={config.icon} size={32} color="#fff" />
          <Text style={styles.label}>{config.label}</Text>
          <Text style={styles.title}>{insight.title}</Text>
          <View style={styles.confidence}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.confidenceText}>{Math.round(insight.confidence * 100)}% confidence</Text>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Details</Text>
          <Text style={[styles.description, { backgroundColor: colors.card, color: colors.text }]}>
            {insight.description}
          </Text>
        </View>

        {insight.relatedMetrics && insight.relatedMetrics.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Related Metrics</Text>
            <View style={[styles.metricsCard, { backgroundColor: colors.card }]}>
              {insight.relatedMetrics.map((metric, i) => (
                <View key={i} style={[styles.metricRow, i < insight.relatedMetrics.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                  <Text style={[styles.metricName, { color: colors.text }]}>{metric}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Generated</Text>
          <Text style={[styles.date, { color: colors.text }]}>{new Date(insight.createdAt).toLocaleDateString()}</Text>
        </View>

        <View style={[styles.disclaimer, { backgroundColor: colors.card }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            This insight is based on patterns in your logged data and should not be considered medical advice.
          </Text>
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
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    opacity: 0.9,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  confidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    padding: 16,
    borderRadius: 12,
  },
  metricsCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  metricRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  metricName: {
    fontSize: 15,
  },
  date: {
    fontSize: 15,
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  notFound: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
});