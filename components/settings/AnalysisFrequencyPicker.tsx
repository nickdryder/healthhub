import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';

export type AnalysisFrequency = '5min' | '15min' | '30min' | '1hr' | '2hr';

interface FrequencyOption {
  id: AnalysisFrequency;
  label: string;
  description: string;
}

const frequencyOptions: FrequencyOption[] = [
  { id: '5min', label: '5 minutes', description: 'Real-time updates' },
  { id: '15min', label: '15 minutes', description: 'Frequent updates' },
  { id: '30min', label: '30 minutes', description: 'Balanced' },
  { id: '1hr', label: '1 hour', description: 'Hourly digest' },
  { id: '2hr', label: '2 hours', description: 'Minimal notifications' },
];

interface AnalysisFrequencyPickerProps {
  value: AnalysisFrequency;
  onChange: (value: AnalysisFrequency) => void;
}

export function AnalysisFrequencyPicker({ value, onChange }: AnalysisFrequencyPickerProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const selectedOption = frequencyOptions.find(opt => opt.id === value) || frequencyOptions[2];

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Ionicons name="time-outline" size={20} color={colors.primary} />
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: colors.text }]}>Analysis Frequency</Text>
          <Text style={[styles.selectedValue, { color: colors.textSecondary }]}>
            {selectedOption.label}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {expanded && (
        <>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            How often should the AI analyze your data and send insights?
          </Text>
          <View style={styles.options}>
            {frequencyOptions.map((option) => {
              const isSelected = value === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.option,
                    { backgroundColor: isSelected ? `${colors.primary}15` : colors.background },
                    isSelected && { borderColor: colors.primary }
                  ]}
                  onPress={() => {
                    onChange(option.id);
                    setExpanded(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionLabel,
                      { color: isSelected ? colors.primary : colors.text }
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      styles.optionDescription,
                      { color: isSelected ? colors.primary : colors.textSecondary }
                    ]}>
                      {option.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedValue: {
    fontSize: 13,
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
});