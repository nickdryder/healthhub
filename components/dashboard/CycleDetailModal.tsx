import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { cycleTracking, CycleEntry } from '@/services/cycle-tracking';

interface CycleDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

const PHASE_INFO = {
  menstruation: {
    icon: 'water-outline',
    lightColor: '#EF4444',
    darkColor: '#FF6B6B',
    description: 'Shedding of the uterine lining',
    tips: ['Stay hydrated', 'Rest when needed', 'Light exercise is fine'],
  },
  follicular: {
    icon: 'leaf-outline',
    lightColor: '#8B5CF6',
    darkColor: '#A78BFA',
    description: 'Growing follicles, increasing estrogen',
    tips: ['Energy levels rising', 'Good for workouts', 'Social activities'],
  },
  ovulation: {
    icon: 'star-outline',
    lightColor: '#F59E0B',
    darkColor: '#FBBF24',
    description: 'Release of egg, peak fertility',
    tips: ['Peak energy and mood', 'Best for intense exercise', 'Most social confidence'],
  },
  luteal: {
    icon: 'moon-outline',
    lightColor: '#6366F1',
    darkColor: '#818CF8',
    description: 'Progesterone rises, prepares for menstruation',
    tips: ['Plan rest days', 'Practice self-care', 'Nesting instincts common'],
  },
};

export function CycleDetailModal({ visible, onClose }: CycleDetailModalProps) {
  const { colors, isDark } = useTheme();
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getPhaseColor = (phase: string) => {
    const phaseData = PHASE_INFO[phase as keyof typeof PHASE_INFO];
    return isDark ? phaseData.darkColor : phaseData.lightColor;
  };

  useEffect(() => {
    if (visible) {
      loadEntries();
    }
  }, [visible]);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const data = await cycleTracking.getCycleEntries();
      setEntries(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error loading cycle entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentPhase = () => {
    if (entries.length === 0) return null;
    return entries[0];
  };

  const getPhaseStats = () => {
    const stats: Record<string, number> = {
      menstruation: 0,
      follicular: 0,
      ovulation: 0,
      luteal: 0,
    };

    entries.slice(0, 28).forEach(e => {
      stats[e.phase]++;
    });

    return stats;
  };

  const currentPhase = getCurrentPhase();
  const stats = getPhaseStats();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* Header - close button at top right */}
          <View style={[styles.header, { paddingTop: 12 }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              Cycle Details
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.card }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            {/* Current Phase Card */}
            {currentPhase && (
              <View style={[styles.card, { backgroundColor: colors.card, marginHorizontal: 16 }]}>
                <View style={styles.phaseHeader}>
                  <Ionicons
                    name={PHASE_INFO[currentPhase.phase].icon as any}
                    size={32}
                    color={getPhaseColor(currentPhase.phase)}
                  />
                  <View style={styles.phaseInfo}>
                    <Text
                      style={[
                        styles.phaseTitle,
                        { color: getPhaseColor(currentPhase.phase) },
                      ]}
                    >
                      {currentPhase.phase.charAt(0).toUpperCase() +
                        currentPhase.phase.slice(1)}
                    </Text>
                    <Text style={[styles.phaseDesc, { color: colors.text }]}>
                      {PHASE_INFO[currentPhase.phase].description}
                    </Text>
                  </View>
                </View>

                {currentPhase.phase === 'menstruation' && currentPhase.flow && (
                  <View
                    style={[
                      styles.flowBadge,
                      { backgroundColor: getPhaseColor(currentPhase.phase) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.flowText,
                        { color: getPhaseColor(currentPhase.phase) },
                      ]}
                    >
                      Flow: {currentPhase.flow.charAt(0).toUpperCase() +
                        currentPhase.flow.slice(1)}
                    </Text>
                  </View>
                )}

                <View style={styles.tipsSection}>
                  <Text style={[styles.tipsTitle, { color: colors.text }]}>
                    Tips for this phase:
                  </Text>
                  {PHASE_INFO[currentPhase.phase].tips.map((tip, idx) => (
                    <View key={idx} style={styles.tipItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={getPhaseColor(currentPhase.phase)}
                      />
                      <Text style={[styles.tipText, { color: colors.text }]}>
                        {tip}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Stats Card */}
            <View style={[styles.card, { backgroundColor: colors.card, marginHorizontal: 16 }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Last 28 Days
              </Text>
              <View style={styles.statsGrid}>
                {Object.entries(stats).map(([phase, count]) => (
                  <View key={phase} style={styles.statItem}>
                    <Ionicons
                      name={PHASE_INFO[phase as keyof typeof PHASE_INFO].icon as any}
                      size={24}
                      color={getPhaseColor(phase)}
                    />
                    <Text style={[styles.statCount, { color: colors.text }]}>
                      {count}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text }]}>
                      {phase === 'menstruation' ? 'Menses' : phase}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* History */}
            {entries.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, marginHorizontal: 16 }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Recent Entries
                </Text>
                {entries.slice(0, 15).map((entry, idx) => {
                  const date = new Date(entry.date);
                  const dateStr = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  const isToday =
                    date.toDateString() === new Date().toDateString();

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.historyItem,
                        {
                          borderLeftColor: getPhaseColor(entry.phase),
                          backgroundColor: getPhaseColor(entry.phase) + '15',
                        },
                      ]}
                    >
                      <View style={styles.historyLeft}>
                        <Text
                          style={[
                            styles.historyDate,
                            {
                              color: colors.text,
                              fontWeight: isToday ? '600' : '400',
                            },
                          ]}
                        >
                          {dateStr}
                        </Text>
                        <Text
                          style={[
                            styles.historyPhase,
                            { color: getPhaseColor(entry.phase) },
                          ]}
                        >
                          {entry.phase.charAt(0).toUpperCase() +
                            entry.phase.slice(1)}
                        </Text>
                      </View>
                      {entry.phase === 'menstruation' && entry.flow && (
                        <Text
                          style={[
                            styles.historyFlow,
                            { color: colors.text },
                          ]}
                        >
                          {entry.flow}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 0,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 8,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  phaseInfo: {
    marginLeft: 12,
    flex: 1,
  },
  phaseTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  phaseDesc: {
    fontSize: 13,
  },
  flowBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  flowText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tipsSection: {
    marginTop: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    marginLeft: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statCount: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  historyItem: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLeft: {
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    marginBottom: 2,
  },
  historyPhase: {
    fontSize: 12,
    fontWeight: '500',
  },
  historyFlow: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
