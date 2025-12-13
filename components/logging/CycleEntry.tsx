import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cycleTracking } from '@/services/cycle-tracking';
import { useTheme } from '@/providers/ThemeProvider';

type Phase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
type Flow = 'light' | 'normal' | 'heavy';

interface Props {
  onSuccess?: () => void;
}

export function CycleEntry({ onSuccess }: Props) {
  const { colors } = useTheme();
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phases: { id: Phase; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { id: 'menstruation', label: 'Menstruation', icon: 'water-outline', color: '#EF4444' },
    { id: 'follicular', label: 'Follicular', icon: 'leaf-outline', color: '#3B82F6' },
    { id: 'ovulation', label: 'Ovulation', icon: 'sparkles-outline', color: '#F59E0B' },
    { id: 'luteal', label: 'Luteal', icon: 'moon-outline', color: '#8B5CF6' },
  ];

  const flows: { id: Flow; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'normal', label: 'Normal' },
    { id: 'heavy', label: 'Heavy' },
  ];

  const handleSubmit = async () => {
    if (!selectedPhase) {
      Alert.alert('Missing Data', 'Please select a cycle phase.');
      return;
    }

    if (selectedPhase === 'menstruation' && !selectedFlow) {
      Alert.alert('Missing Data', 'Please select flow level for menstruation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await cycleTracking.addCycleEntry({
        date: today,
        phase: selectedPhase,
        flow: selectedFlow || 'normal',
      });

      Alert.alert('Logged', `Cycle entry saved for ${today}`);
      setSelectedPhase(null);
      setSelectedFlow(null);
      onSuccess?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to save cycle entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>Cycle Phase</Text>
      <View style={styles.phaseGrid}>
        {phases.map((phase) => (
          <TouchableOpacity
            key={phase.id}
            style={[
              styles.phaseButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedPhase === phase.id && { backgroundColor: `${phase.color}20`, borderColor: phase.color },
            ]}
            onPress={() => setSelectedPhase(phase.id)}
          >
            <Ionicons
              name={phase.icon}
              size={24}
              color={selectedPhase === phase.id ? phase.color : colors.textSecondary}
            />
            <Text
              style={[
                styles.phaseLabel,
                { color: selectedPhase === phase.id ? phase.color : colors.text },
              ]}
            >
              {phase.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedPhase === 'menstruation' && (
        <>
          <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Flow Level</Text>
          <View style={styles.flowGrid}>
            {flows.map((flow) => (
              <TouchableOpacity
                key={flow.id}
                style={[
                  styles.flowButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedFlow === flow.id && { backgroundColor: '#EF444420', borderColor: '#EF4444' },
                ]}
                onPress={() => setSelectedFlow(flow.id)}
              >
                <Text
                  style={[
                    styles.flowLabel,
                    { color: selectedFlow === flow.id ? '#EF4444' : colors.text },
                  ]}
                >
                  {flow.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.6 : 1 }]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Ionicons name="checkmark" size={20} color="#FFF" />
        <Text style={styles.submitButtonText}>{isSubmitting ? 'Saving...' : 'Save Entry'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  phaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  phaseButton: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  phaseLabel: { fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  flowGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  flowButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
  },
  flowLabel: { fontSize: 13, fontWeight: '600' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
