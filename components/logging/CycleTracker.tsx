import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cycleTracking, type CycleEntry } from '@/services/cycle-tracking';
import { useTheme } from '@/providers/ThemeProvider';
import { colors as staticColors } from '@/constants/colors';

const PHASES = [
  { id: 'menstruation', label: 'Period', icon: 'water-outline', color: '#FF6B6B' },
  { id: 'follicular', label: 'Follicular', icon: 'sunny-outline', color: '#FFD93D' },
  { id: 'ovulation', label: 'Ovulation', icon: 'heart-outline', color: '#FF85E3' },
  { id: 'luteal', label: 'Luteal', icon: 'moon-outline', color: '#9D84B7' },
];

const FLOWS = [
  { id: 'light', label: 'Light', droplets: 1 },
  { id: 'normal', label: 'Normal', droplets: 2 },
  { id: 'heavy', label: 'Heavy', droplets: 3 },
];

interface CycleTrackerProps {
  date: string; // YYYY-MM-DD
  onSave?: () => void;
}

export default function CycleTracker({ date, onSave }: CycleTrackerProps) {
  const { colors } = useTheme();
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedPhase) {
      Alert.alert('Please select a cycle phase');
      return;
    }

    setSaving(true);
    try {
      await cycleTracking.addCycleEntry({
        date,
        phase: selectedPhase as any,
        flow: (selectedFlow || 'normal') as any,
        notes: notes || undefined,
      });
      Alert.alert('Saved', 'Cycle entry recorded privately on your device.');
      onSave?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to save cycle entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Ionicons name="heart" size={24} color={staticColors.cycle} />
        <Text style={[styles.title, { color: colors.text }]}>Cycle Tracking</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Private • Device-only</Text>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Cycle Phase</Text>
      <View style={styles.phaseGrid}>
        {PHASES.map(phase => (
          <TouchableOpacity
            key={phase.id}
            style={[
              styles.phaseButton,
              selectedPhase === phase.id && { backgroundColor: `${phase.color}20`, borderColor: phase.color, borderWidth: 2 },
              { borderColor: colors.border },
            ]}
            onPress={() => setSelectedPhase(phase.id)}
          >
            <Ionicons name={phase.icon as any} size={28} color={phase.color} />
            <Text style={[styles.phaseLabel, { color: colors.text }]}>{phase.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedPhase === 'menstruation' && (
        <>
          <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Flow</Text>
          <View style={styles.flowGrid}>
            {FLOWS.map(flow => (
              <TouchableOpacity
                key={flow.id}
                style={[
                  styles.flowButton,
                  selectedFlow === flow.id && [styles.flowButtonActive, { borderColor: staticColors.cycle }],
                  { borderColor: colors.border },
                ]}
                onPress={() => setSelectedFlow(flow.id)}
              >
                <Text style={[styles.droplets, { color: selectedFlow === flow.id ? staticColors.cycle : colors.textSecondary }]}>
                  {'🩸'.repeat(flow.droplets)}
                </Text>
                <Text style={[styles.flowLabel, { color: colors.text }]}>{flow.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity 
        style={[styles.saveButton, { backgroundColor: staticColors.cycle, opacity: saving ? 0.6 : 1 }]} 
        onPress={handleSave}
        disabled={saving}
      >
        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Entry'}</Text>
      </TouchableOpacity>

      <Text style={[styles.privacy, { color: colors.textSecondary }]}>
        Your cycle data is encrypted and stored only on this device. It is never shared with servers.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  phaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  phaseButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  flowGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  flowButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  flowButtonActive: {
    borderWidth: 2,
  },
  droplets: {
    fontSize: 18,
    marginBottom: 4,
  },
  flowLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  privacy: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
