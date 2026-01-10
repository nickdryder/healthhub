import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { formatSnakeCase } from '@/services/formatting-utils';

interface InsightCardProps {
  title: string;
  description: string;
  type: 'correlation' | 'prediction' | 'recommendation';
  confidence?: number;
  onPress?: () => void;
}

const typeConfig = {
  correlation: {
    icon: 'git-compare' as const,
    gradient: ['#6366F1', '#8B5CF6'] as [string, string],
    label: 'Correlation',
  },
  prediction: {
    icon: 'analytics' as const,
    gradient: ['#F59E0B', '#EF4444'] as [string, string],
    label: 'Prediction',
  },
  recommendation: {
    icon: 'bulb' as const,
    gradient: ['#10B981', '#06B6D4'] as [string, string],
    label: 'Tip',
  },
};

const InsightCardComponent = ({ title, description, type, confidence, onPress }: InsightCardProps) => {
  const { colors } = useTheme();
  const config = typeConfig[type];

  // Memoize title formatting to avoid regex on every render
  const formattedTitle = useMemo(() => {
    return title.replace(
      /([a-z_]+)/g,
      (match) => {
        if (match.includes('_')) {
          return formatSnakeCase(match);
        }
        return match;
      }
    );
  }, [title]);

  // Memoize description formatting to avoid regex on every render
  const formattedDescription = useMemo(() => {
    return description.replace(
      /([a-z_]+)/g,
      (match) => {
        // Only format if it contains underscores (snake_case pattern)
        if (match.includes('_')) {
          return formatSnakeCase(match);
        }
        return match;
      }
    );
  }, [description]);

  const confidenceText = useMemo(() => {
    return confidence ? `${Math.round(confidence * 100)}% confident` : undefined;
  }, [confidence]);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${config.label}: ${formattedTitle}. ${formattedDescription}`}
      accessibilityRole="button"
      accessibilityHint="Tap to view insight details"
    >
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconGradient}
      >
        <Ionicons name={config.icon} size={20} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.label, { color: colors.primary }]}>{config.label}</Text>
          {confidenceText && (
            <Text style={[styles.confidence, { color: colors.textSecondary }]}>{confidenceText}</Text>
          )}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{formattedTitle}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>{formattedDescription}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.gray300} />
    </TouchableOpacity>
  );
};

export const InsightCard = React.memo(InsightCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  iconGradient: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confidence: {
    fontSize: 11,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
});