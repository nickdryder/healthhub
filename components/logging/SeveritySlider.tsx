import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '@/constants/colors';

interface SeveritySliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

const severityColors = [
  colors.success,
  '#4ADE80',
  '#86EFAC',
  '#FDE047',
  '#FCD34D',
  colors.warning,
  '#FB923C',
  '#F97316',
  '#EF4444',
  colors.error,
];

export function SeveritySlider({ value, onChange, label = 'Severity' }: SeveritySliderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: severityColors[value - 1] }]}>{value}/10</Text>
      </View>
      <View style={styles.sliderContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.dot,
              { backgroundColor: severityColors[num - 1] },
              num <= value && styles.dotActive,
              num > value && styles.dotInactive,
            ]}
            onPress={() => onChange(num)}
            activeOpacity={0.7}
          >
            {num === value && <View style={styles.selectedIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.labels}>
        <Text style={styles.labelText}>Mild</Text>
        <Text style={styles.labelText}>Severe</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    opacity: 1,
  },
  dotInactive: {
    opacity: 0.3,
  },
  selectedIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  labelText: {
    fontSize: 12,
    color: colors.gray400,
  },
});
