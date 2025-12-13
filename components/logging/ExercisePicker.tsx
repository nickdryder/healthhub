import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/providers/ThemeProvider';

const UNIT_SYSTEM_KEY = '@health_hub_unit_system';

const EXERCISE_CATEGORIES = [
  {
    name: 'Upper Body',
    exercises: ['Push Ups', 'Bench Press', 'Shoulder Press', 'Bicep Curls', 'Tricep Dips', 'Pull Ups', 'Rows', 'Lateral Raises'],
  },
  {
    name: 'Lower Body', 
    exercises: ['Squats', 'Lunges', 'Deadlifts', 'Leg Press', 'Calf Raises', 'Leg Curls', 'Hip Thrusts'],
  },
  {
    name: 'Core',
    exercises: ['Planks', 'Crunches', 'Russian Twists', 'Leg Raises', 'Mountain Climbers'],
  },
  {
    name: 'Cardio',
    exercises: ['Running', 'Cycling', 'Jump Rope', 'Burpees', 'Rowing'],
  },
];

interface ExerciseEntry {
  name: string;
  weight: string;
  reps: string;
  sets: string;
}

interface ExercisePickerProps {
  value: ExerciseEntry;
  onChange: (entry: ExerciseEntry) => void;
}

export function ExercisePicker({ value, onChange }: ExercisePickerProps) {
  const { colors } = useTheme();
  const [showExercises, setShowExercises] = useState(!value.name);
  const [customExercise, setCustomExercise] = useState('');
  const [useMetric, setUseMetric] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(UNIT_SYSTEM_KEY).then(saved => {
      if (saved !== null) setUseMetric(saved === 'metric');
    });
  }, []);

  const weightUnit = useMetric ? 'kg' : 'lbs';

  const selectExercise = (name: string) => {
    onChange({ ...value, name });
    setShowExercises(false);
  };

  const handleCustomExercise = () => {
    if (customExercise.trim()) {
      selectExercise(customExercise.trim());
      setCustomExercise('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>Exercise</Text>
      {value.name ? (
        <TouchableOpacity 
          style={[styles.selectedExercise, { backgroundColor: colors.card, borderColor: colors.primary }]}
          onPress={() => setShowExercises(true)}
        >
          <Ionicons name="barbell-outline" size={20} color={colors.primary} />
          <Text style={[styles.selectedText, { color: colors.text }]}>{value.name}</Text>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}

      {showExercises && (
        <View style={[styles.exerciseList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.customInput, { borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.customTextInput, { color: colors.text }]}
              placeholder="Custom exercise..."
              placeholderTextColor={colors.textSecondary}
              value={customExercise}
              onChangeText={setCustomExercise}
              onSubmitEditing={handleCustomExercise}
            />
            {customExercise.trim() && (
              <TouchableOpacity onPress={handleCustomExercise}>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.categoriesScroll} nestedScrollEnabled>
            {EXERCISE_CATEGORIES.map((category) => (
              <View key={category.name} style={styles.category}>
                <Text style={[styles.categoryName, { color: colors.textSecondary }]}>{category.name}</Text>
                <View style={styles.exerciseChips}>
                  {category.exercises.map((exercise) => (
                    <TouchableOpacity
                      key={exercise}
                      style={[styles.exerciseChip, { backgroundColor: `${colors.primary}15` }]}
                      onPress={() => selectExercise(exercise)}
                    >
                      <Text style={[styles.chipText, { color: colors.primary }]}>{exercise}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {value.name && (
        <View style={styles.metricsRow}>
          <View style={styles.metricInput}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Sets</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.numberInput, { color: colors.text }]}
                value={value.sets}
                onChangeText={(sets) => onChange({ ...value, sets })}
                keyboardType="numeric"
                placeholder="3"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.metricInput}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Reps</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.numberInput, { color: colors.text }]}
                value={value.reps}
                onChangeText={(reps) => onChange({ ...value, reps })}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.metricInput}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Weight</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.numberInput, { color: colors.text }]}
                value={value.weight}
                onChangeText={(weight) => onChange({ ...value, weight })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.unit, { color: colors.textSecondary }]}>{weightUnit}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  selectedExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 10,
  },
  selectedText: { flex: 1, fontSize: 16, fontWeight: '600' },
  exerciseList: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 300,
    overflow: 'hidden',
  },
  customInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  customTextInput: { flex: 1, fontSize: 16, padding: 4 },
  categoriesScroll: { maxHeight: 240 },
  category: { padding: 12 },
  categoryName: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  exerciseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exerciseChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 14, fontWeight: '500' },
  metricsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  metricInput: { flex: 1 },
  metricLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  numberInput: { flex: 1, fontSize: 20, fontWeight: '700', paddingVertical: 12, textAlign: 'center' },
  unit: { fontSize: 14, fontWeight: '500' },
});