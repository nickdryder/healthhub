import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface Symptom {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: string;
}

const symptoms: Symptom[] = [
  { id: 'headache', label: 'Headache', icon: 'bandage-outline', category: 'pain' },
  { id: 'migraine', label: 'Migraine', icon: 'flash-outline', category: 'pain' },
  { id: 'joint_pain', label: 'Joint Pain', icon: 'body-outline', category: 'pain' },
  { id: 'muscle_pain', label: 'Muscle Pain', icon: 'fitness-outline', category: 'pain' },
  { id: 'fatigue', label: 'Fatigue', icon: 'battery-dead-outline', category: 'energy' },
  { id: 'bloating', label: 'Bloating', icon: 'ellipse-outline', category: 'digestive' },
  { id: 'nausea', label: 'Nausea', icon: 'medical-outline', category: 'digestive' },
  { id: 'brain_fog', label: 'Brain Fog', icon: 'cloudy-outline', category: 'mental' },
  { id: 'anxiety', label: 'Anxiety', icon: 'pulse-outline', category: 'mental' },
  { id: 'insomnia', label: 'Insomnia', icon: 'moon-outline', category: 'sleep' },
  { id: 'heartburn', label: 'Heartburn', icon: 'flame-outline', category: 'digestive' },
  { id: 'dizziness', label: 'Dizziness', icon: 'sync-outline', category: 'general' },
];

interface SymptomPickerProps {
  selected: string[];
  onChange: (symptoms: string[]) => void;
}

export function SymptomPicker({ selected, onChange }: SymptomPickerProps) {
  const toggleSymptom = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Symptoms</Text>
      <View style={styles.grid}>
        {symptoms.map((symptom) => {
          const isSelected = selected.includes(symptom.id);
          return (
            <TouchableOpacity
              key={symptom.id}
              style={[styles.item, isSelected && styles.itemSelected]}
              onPress={() => toggleSymptom(symptom.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={symptom.icon}
                size={20}
                color={isSelected ? colors.primary : colors.gray500}
              />
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {symptom.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.gray50,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  itemSelected: {
    backgroundColor: `${colors.primary}10`,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray600,
  },
  labelSelected: {
    color: colors.primary,
  },
});