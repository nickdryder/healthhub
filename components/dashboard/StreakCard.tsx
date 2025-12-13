import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { streakService } from '@/services/streaks';
import { colors as staticColors } from '@/constants/colors';

export function StreakCard() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const { data: streak } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => user ? streakService.calculateStreak(user.id) : null,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (!streak || streak.currentStreak === 0) {
    return null;
  }

  const getStreakEmoji = (days: number) => {
    if (days >= 30) return '🏆';
    if (days >= 14) return '🔥';
    if (days >= 7) return '⚡';
    if (days >= 3) return '✨';
    return '🌱';
  };

  const getStreakColor = (days: number) => {
    if (days >= 14) return staticColors.warning;
    if (days >= 7) return staticColors.success;
    return staticColors.primary;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.left}>
        <Text style={styles.emoji}>{getStreakEmoji(streak.currentStreak)}</Text>
        <View>
          <Text style={[styles.streakCount, { color: getStreakColor(streak.currentStreak) }]}>
            {streak.currentStreak} day streak
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {streak.isActiveToday ? 'Logged today' : 'Log today to continue!'}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.bestLabel, { color: colors.textSecondary }]}>Best</Text>
        <Text style={[styles.bestValue, { color: colors.text }]}>{streak.longestStreak}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  streakCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    alignItems: 'center',
  },
  bestLabel: {
    fontSize: 11,
  },
  bestValue: {
    fontSize: 20,
    fontWeight: '700',
  },
});
