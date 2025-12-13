import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from './LineChart';
import { colors } from '@/constants/colors';

interface DataPoint {
  date: string;
  value: number;
}

interface TrendCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  data: DataPoint[];
  unit: string;
  cardBg: string;
  textColor: string;
  textSecondary: string;
}

export function TrendCard({ 
  title, 
  icon, 
  color, 
  data, 
  unit,
  cardBg,
  textColor,
  textSecondary,
}: TrendCardProps) {
  const hasData = data.length >= 2;
  
  // Calculate stats
  const values = data.map(d => d.value);
  const isSteps = unit.toLowerCase() === 'steps';
  const rounding = isSteps ? Math.floor : Math.round;
  const avg = values.length > 0 ? rounding(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  const min = values.length > 0 ? rounding(Math.min(...values)) : 0;
  const max = values.length > 0 ? rounding(Math.max(...values)) : 0;
  const latest = values.length > 0 ? rounding(values[values.length - 1]) : 0;

  // Calculate trend
  let trendPct = 0;
  if (values.length >= 2) {
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    trendPct = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;
  }

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        </View>
        {hasData && (
          <View style={styles.trendBadge}>
            <Ionicons 
              name={trendPct >= 0 ? 'trending-up' : 'trending-down'} 
              size={14} 
              color={trendPct >= 0 ? colors.success : colors.error} 
            />
            <Text style={[styles.trendText, { color: trendPct >= 0 ? colors.success : colors.error }]}>
              {Math.abs(trendPct)}%
            </Text>
          </View>
        )}
      </View>

      {hasData ? (
        <>
          <View style={styles.chartContainer}>
            <LineChart data={data} color={color} height={160} showDots={data.length <= 14} />
          </View>

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{latest}</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Latest {unit}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{avg}</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Avg {unit}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{min}-{max}</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Range {unit}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={32} color={colors.gray300} />
          <Text style={[styles.emptyText, { color: textSecondary }]}>
            Not enough data yet
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.gray400 }]}>
            Keep logging to see trends
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    marginHorizontal: -8,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
  },
});