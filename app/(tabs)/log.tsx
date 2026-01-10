import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BristolScalePicker } from '@/components/logging/BristolScalePicker';
import { SymptomPicker } from '@/components/logging/SymptomPicker';
import { SeveritySlider } from '@/components/logging/SeveritySlider';
import { ExercisePicker } from '@/components/logging/ExercisePicker';
import { SupplementPicker } from '@/components/logging/SupplementPicker';
import { WeightPicker } from '@/components/logging/WeightPicker';
import { MedicationLogger } from '@/components/logging/MedicationLogger';
import { CycleEntry } from '@/components/logging/CycleEntry';
import { RecentLogs } from '@/components/logging/RecentLogs';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';
import { colors as staticColors } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { cycleTracking } from '@/services/cycle-tracking';
import { parseIntSafe, parseFloatSafe, validateExercise, validateSupplement, validateCaffeineAmount } from '@/utils/validation';
import { ManualLogInsert, HealthMetricInsert } from '@/types/database-extended';

type LogType = 'symptom' | 'bristol' | 'caffeine' | 'exercise' | 'supplement' | 'weight' | 'medication' | 'cycle' | 'custom';

const logTypes = [
  { id: 'symptom' as const, label: 'Symptom', icon: 'medical-outline' as const, color: staticColors.error },
  { id: 'exercise' as const, label: 'Exercise', icon: 'barbell-outline' as const, color: staticColors.info },
  { id: 'weight' as const, label: 'Weight', icon: 'scale-outline' as const, color: staticColors.primary },
  { id: 'medication' as const, label: 'Meds', icon: 'medkit-outline' as const, color: '#8B5CF6' },
  { id: 'supplement' as const, label: 'Supplement', icon: 'nutrition-outline' as const, color: staticColors.success },
  { id: 'caffeine' as const, label: 'Caffeine', icon: 'cafe-outline' as const, color: staticColors.calories },
  { id: 'bristol' as const, label: 'Bristol', icon: 'analytics-outline' as const, color: '#78716C' },
  { id: 'cycle' as const, label: 'Cycle', icon: 'heart-half-outline' as const, color: '#EC4899' },
];

const QuickAmount = React.memo(({ label, amount, onPress }: { label: string; amount: string; onPress: () => void }) => {
  return (
    <TouchableOpacity
      style={styles.quickAmount}
      onPress={onPress}
      accessibilityLabel={`Set caffeine amount to ${amount} milligrams, ${label}`}
      accessibilityRole="button"
    >
      <Text style={styles.quickAmountLabel}>{label}</Text>
      <Text style={styles.quickAmountValue}>{amount}mg</Text>
    </TouchableOpacity>
  );
});

const UNIT_SYSTEM_KEY = '@health_hub_unit_system';
export default function LogScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ type?: string }>();
  const [activeType, setActiveType] = useState<LogType>('symptom');
  const [bristolValue, setBristolValue] = useState<number | null>(null);
  const [bristolAmount, setBristolAmount] = useState<number>(5);
  const [useMetric, setUseMetric] = useState(true);
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false);

  // Load unit preference and cycle tracking status
  useEffect(() => {
    AsyncStorage.getItem(UNIT_SYSTEM_KEY).then(saved => {
      if (saved !== null) setUseMetric(saved === 'metric');
    });
    cycleTracking.isCycleTrackingEnabled().then(setCycleTrackingEnabled);
  }, []);

  // Handle incoming type from quick log buttons
  useEffect(() => {
    if (params.type && ['symptom', 'bristol', 'caffeine', 'exercise', 'supplement', 'weight', 'medication', 'cycle', 'custom'].includes(params.type)) {
      setActiveType(params.type as LogType);
    }
  }, [params.type]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState(5);
  const [caffeineAmount, setCaffeineAmount] = useState('');
  const [exercise, setExercise] = useState({ name: '', weight: '', reps: '', sets: '' });
  const [supplement, setSupplement] = useState({ name: '', dosage: '' });
  const [weight, setWeight] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setBristolValue(null);
    setBristolAmount(5);
    setSelectedSymptoms([]);
    setSeverity(5);
    setCaffeineAmount('');
    setExercise({ name: '', weight: '', reps: '', sets: '' });
    setSupplement({ name: '', dosage: '' });
    setWeight('');
    setCustomValue('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to log health data.');
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      const logs: ManualLogInsert[] = [];

      if (activeType === 'symptom' && selectedSymptoms.length > 0) {
        for (const symptom of selectedSymptoms) {
          logs.push({
            user_id: user.id,
            log_type: 'symptom',
            category: 'health',
            value: symptom,
            severity: severity,
            notes: notes || null,
            logged_at: now,
          });
        }
      } else if (activeType === 'bristol' && bristolValue) {
        const getAmountLabel = (amt: number) => {
          if (amt <= 2) return 'Very Small';
          if (amt <= 4) return 'Small';
          if (amt <= 6) return 'Medium';
          if (amt <= 8) return 'Large';
          return 'Very Large';
        };
        logs.push({
          user_id: user.id,
          log_type: 'bristol_stool',
          category: 'digestive',
          value: `Type ${bristolValue}`,
          severity: null,
          notes: notes || null,
          logged_at: now,
          metadata: {
            amount: bristolAmount,
            amount_label: getAmountLabel(bristolAmount),
          },
        });
      } else if (activeType === 'caffeine' && caffeineAmount) {
        const validation = validateCaffeineAmount(caffeineAmount);
        if (!validation.valid) {
          Alert.alert('Invalid Input', validation.error || 'Invalid caffeine amount');
          return;
        }
        logs.push({
          user_id: user.id,
          log_type: 'caffeine',
          category: 'food',
          value: String(validation.value),
          severity: null,
          notes: notes || null,
          logged_at: now,
        });
      } else if (activeType === 'exercise' && exercise.name) {
        const validation = validateExercise(exercise);
        if (!validation.valid) {
          Alert.alert('Invalid Input', validation.errors.join('\n'));
          return;
        }
        logs.push({
          user_id: user.id,
          log_type: 'exercise',
          category: 'fitness',
          value: exercise.name,
          severity: null,
          notes: notes || null,
          logged_at: now,
          metadata: {
            sets: parseIntSafe(exercise.sets),
            reps: parseIntSafe(exercise.reps),
            weight: parseFloatSafe(exercise.weight),
            weight_unit: useMetric ? 'kg' : 'lbs',
          },
        });
      } else if (activeType === 'supplement' && supplement.name) {
        const validation = validateSupplement(supplement);
        if (!validation.valid) {
          Alert.alert('Invalid Input', validation.errors.join('\n'));
          return;
        }
        logs.push({
          user_id: user.id,
          log_type: 'supplement',
          category: 'supplement',
          value: supplement.name,
          severity: null,
          notes: notes || null,
          logged_at: now,
          metadata: {
            dosage: supplement.dosage || null,
          },
        });
      } else if (activeType === 'weight' && weight) {
        // Insert into health_metrics for weight
        const weightValue = parseFloatSafe(weight);
        if (weightValue === null || weightValue <= 0) {
          Alert.alert('Invalid Weight', 'Please enter a valid weight.');
          setIsSubmitting(false);
          return;
        }

        const weightMetric: HealthMetricInsert = {
          user_id: user.id,
          metric_type: 'weight',
          value: weightValue,
          unit: 'kg',
          source: 'manual',
          recorded_at: now,
        };

        const { error: weightError } = await supabase.from('health_metrics').insert(weightMetric);
        if (weightError) throw weightError;

        queryClient.invalidateQueries({ queryKey: ['health-metrics'] });
        queryClient.invalidateQueries({ queryKey: ['streak'] });
        Alert.alert('Logged!', `Weight ${weightValue} kg saved successfully.`);
        resetForm();
        setIsSubmitting(false);
        return;
      } else if (activeType === 'medication') {
        // MedicationLogger handles its own submission
        setIsSubmitting(false);
        return;
      }

      if (logs.length === 0) {
        Alert.alert('Missing Data', 'Please fill in the required fields.');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('manual_logs').insert(logs);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['recent-logs'] });
      Alert.alert('Logged!', `${logs.length} ${logs.length === 1 ? 'entry' : 'entries'} saved successfully.`);
      resetForm();
    } catch (error: any) {
      console.error('Failed to save log:', error);
      Alert.alert('Error', error.message || 'Failed to save your entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Log Entry</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Track your health data manually</Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.typeSelector}
        >
          {logTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeButton, { backgroundColor: colors.card }, activeType === type.id && { borderColor: colors.primary, backgroundColor: `${colors.primary}08` }]}
              onPress={() => setActiveType(type.id)}
              activeOpacity={0.7}
              accessibilityLabel={`Log ${type.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: activeType === type.id }}
            >
              <View style={[styles.typeIcon, { backgroundColor: `${type.color}15` }]}>
                <Ionicons name={type.icon} size={24} color={type.color} />
              </View>
              <Text style={[styles.typeLabel, { color: colors.textSecondary }, activeType === type.id && { color: colors.primary }]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.form}>
          {activeType === 'symptom' && (
            <>
              <SymptomPicker selected={selectedSymptoms} onChange={setSelectedSymptoms} />
              {selectedSymptoms.length > 0 && <SeveritySlider value={severity} onChange={setSeverity} />}
            </>
          )}

          {activeType === 'bristol' && (
            <BristolScalePicker 
              value={bristolValue} 
              onChange={setBristolValue}
              amount={bristolAmount}
              onAmountChange={setBristolAmount}
            />
          )}

          {activeType === 'exercise' && (
            <ExercisePicker value={exercise} onChange={setExercise} />
          )}

          {activeType === 'supplement' && (
            <SupplementPicker value={supplement} onChange={setSupplement} />
          )}

          {activeType === 'weight' && (
            <WeightPicker value={weight} onChange={setWeight} />
          )}

          {activeType === 'medication' && (
            <MedicationLogger onComplete={resetForm} />
          )}

          {activeType === 'cycle' && cycleTrackingEnabled && (
            <CycleEntry onSuccess={resetForm} />
          )}

          {activeType === 'caffeine' && (
            <View style={styles.caffeineSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Caffeine Amount</Text>
              <View style={[styles.caffeineInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.numberInput, { color: colors.text }]}
                  value={caffeineAmount}
                  onChangeText={setCaffeineAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>mg</Text>
              </View>
              <View style={styles.quickAmounts}>
                <QuickAmount label="Coffee" amount="95" onPress={() => setCaffeineAmount('95')} />
                <QuickAmount label="Espresso" amount="63" onPress={() => setCaffeineAmount('63')} />
                <QuickAmount label="Tea" amount="47" onPress={() => setCaffeineAmount('47')} />
                <QuickAmount label="Soda" amount="34" onPress={() => setCaffeineAmount('34')} />
              </View>
            </View>
          )}

          {activeType === 'custom' && (
            <View style={styles.customSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>What are you logging?</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={customValue}
                onChangeText={setCustomValue}
                placeholder="e.g., Sodium intake, Water glasses..."
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}

          <View style={styles.notesSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional details..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <Button 
            title={isSubmitting ? "Saving..." : "Save Entry"} 
            onPress={handleSubmit} 
            style={styles.submitButton}
            disabled={isSubmitting}
          />

          <RecentLogs />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  typeSelector: { 
    paddingHorizontal: 20, 
    gap: 12, 
    paddingBottom: 24,
  },
  typeButton: {
    width: 80,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  typeLabel: { fontSize: 12, fontWeight: '600' },
  form: { paddingHorizontal: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  textInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  caffeineSection: { marginBottom: 24 },
  caffeineInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  numberInput: { flex: 1, fontSize: 32, fontWeight: '700', paddingVertical: 16 },
  unitLabel: { fontSize: 18, fontWeight: '600' },
  quickAmounts: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quickAmount: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: staticColors.gray200,
    backgroundColor: staticColors.white,
  },
  quickAmountLabel: { fontSize: 12, color: staticColors.gray600, marginBottom: 2 },
  quickAmountValue: { fontSize: 14, fontWeight: '700', color: staticColors.gray900 },
  customSection: { marginBottom: 24 },
  notesSection: { marginBottom: 24 },
  notesInput: { minHeight: 100, textAlignVertical: 'top' },
  submitButton: { marginBottom: 24 },
});