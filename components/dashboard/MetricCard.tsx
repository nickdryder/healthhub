import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { colors as staticColors } from '@/constants/colors';

interface MetricCardProps {
  title: string;
  value: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  trend?: { value: number; isPositive: boolean };
  invertTrendColors?: boolean; // When true, down=green, up=red (for metrics like HR, weight)
  subtitle?: string;
  onPress?: () => void;
}

export function MetricCard({ title, value, unit, icon, color, trend, invertTrendColors, subtitle, onPress }: MetricCardProps) {
  const { colors } = useTheme();

  // Determine colors based on direction and inversion
  const getTrendColor = () => {
    if (!trend) return staticColors.success;
    const isUp = trend.isPositive;
    if (invertTrendColors) {
      // Inverted: up is bad (red), down is good (green)
      return isUp ? staticColors.error : staticColors.success;
    }
    // Normal: up is good (green), down is bad (red)
    return isUp ? staticColors.success : staticColors.error;
  };

  const trendColor = getTrendColor();

  const content = (
    <>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        {trend && (
          <View style={[styles.trend, { backgroundColor: `${trendColor}15` }]}>
            <Ionicons
              name={trend.isPositive ? 'trending-up' : 'trending-down'}
              size={12}
              color={trendColor}
            />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {Math.abs(trend.value)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text>
      </View>
      {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      {onPress && (
        <View style={styles.tapHint}>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity 
        style={[styles.card, { borderLeftColor: color, backgroundColor: colors.card }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, { borderLeftColor: color, backgroundColor: colors.card }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flex: 1,
    minWidth: 150,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 13,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
  },
  unit: {
    fontSize: 14,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  tapHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    opacity: 0.5,
  },
});