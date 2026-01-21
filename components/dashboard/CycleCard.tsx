import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cycleTracking, CycleEntry } from '@/services/cycle-tracking';
import { useTheme } from '@/providers/ThemeProvider';
import { CycleDetailModal } from './CycleDetailModal';

export function CycleCard() {
  const { colors } = useTheme();
  const [currentEntry, setCurrentEntry] = useState<CycleEntry | null>(null);
  const [daysToMenstruation, setDaysToMenstruation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadCycleData();
    // Retry after a short delay to allow mock data to initialize
    const timer = setTimeout(loadCycleData, 500);
    return () => clearTimeout(timer);
  }, []);

  const loadCycleData = async () => {
    try {
      console.log('🔄 CycleCard: Loading cycle data...');
      const entries = await cycleTracking.getCycleEntries();
      console.log('📊 CycleCard: Found entries:', entries.length);
      
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = entries.find(e => e.date === today);
      console.log('📅 CycleCard: Today entry:', todayEntry);
      
      setCurrentEntry(todayEntry || null);

      if (entries.length > 0) {
        const daysUntilNext = calculateDaysToMenstruation(entries);
        console.log('⏳ CycleCard: Days to menstruation:', daysUntilNext);
        setDaysToMenstruation(daysUntilNext);
      }
    } catch (error) {
      console.error('❌ CycleCard: Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDaysToMenstruation = (entries: CycleEntry[]): number => {
    // Simple estimation based on typical cycle
    // Find last menstruation date
    const menstruationEntries = entries
      .filter(e => e.phase === 'menstruation')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (menstruationEntries.length === 0) return 0;

    const lastMenstruation = new Date(menstruationEntries[0].date);
    const today = new Date();
    const daysSinceMenstruation = Math.floor(
      (today.getTime() - lastMenstruation.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Assume 28-day cycle
    const daysToNextMenstruation = Math.max(0, 28 - daysSinceMenstruation);
    return daysToNextMenstruation;
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'menstruation':
        return '#EF4444';
      case 'follicular':
        return '#3B82F6';
      case 'ovulation':
        return '#F59E0B';
      case 'luteal':
        return '#8B5CF6';
      default:
        return colors.primary;
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'menstruation':
        return 'water-outline';
      case 'follicular':
        return 'leaf-outline';
      case 'ovulation':
        return 'sparkles-outline';
      case 'luteal':
        return 'moon-outline';
      default:
        return 'heart-outline';
    }
  };

  // Show card even while loading (with skeleton state)
  const phaseColor = currentEntry ? getPhaseColor(currentEntry.phase) : colors.primary;
  const phaseIcon = currentEntry ? getPhaseIcon(currentEntry.phase) : 'heart-outline';

  return (
    <>
    <TouchableOpacity
      style={[styles.card, { backgroundColor: `${phaseColor}10`, borderColor: phaseColor }]}
      onPress={() => setModalVisible(true)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${phaseColor}20` }]}>
          <Ionicons name={phaseIcon as any} size={24} color={phaseColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.phase, { color: phaseColor }]}>
            {currentEntry ? currentEntry.phase.charAt(0).toUpperCase() + currentEntry.phase.slice(1) : 'Track Cycle'}
          </Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {currentEntry ? new Date(currentEntry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No data'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>

      {daysToMenstruation !== null && (
        <View style={[styles.daysContainer, { backgroundColor: `${phaseColor}05`, borderColor: phaseColor }]}>
          <Text style={[styles.daysLabel, { color: colors.textSecondary }]}>Days until next period</Text>
          <Text style={[styles.daysValue, { color: phaseColor }]}>{daysToMenstruation} days</Text>
        </View>
      )}

      {currentEntry?.flow && (
        <View style={styles.flowInfo}>
          <Text style={[styles.flowLabel, { color: colors.textSecondary }]}>Flow: </Text>
          <Text style={[styles.flowValue, { color: colors.text }]}>
            {currentEntry.flow.charAt(0).toUpperCase() + currentEntry.flow.slice(1)}
          </Text>
        </View>
      )}

      <Text style={[styles.tapHint, { color: colors.textSecondary }]}>Tap for details</Text>
    </TouchableOpacity>
    <CycleDetailModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  phase: {
    fontSize: 16,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    marginTop: 2,
  },
  daysContainer: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  daysLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  daysValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  flowInfo: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'baseline',
  },
  flowLabel: {
    fontSize: 13,
  },
  flowValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 11,
    marginTop: 10,
    fontStyle: 'italic',
  },
});