import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';

type BiologicalSex = 'female' | 'male' | null;

interface ProfileData {
  height_cm: number | null;
  sex: string | null;
  step_goal: number;
  sleep_goal: number;
  weight_goal: number | null;
}

function calculateBMI(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm === 0) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [stepGoal, setStepGoal] = useState('10000');
  const [sleepGoal, setSleepGoal] = useState('8');
  const [weightGoal, setWeightGoal] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Fetch profile data
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('height_cm, sex, step_goal, sleep_goal, weight_goal')
        .eq('id', user.id)
        .single();
      return data as ProfileData | null;
    },
    enabled: !!user,
  });

  // Fetch current weight (moving average)
  const { data: weightData } = useQuery({
    queryKey: ['current-weight', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('health_metrics')
        .select('value')
        .eq('user_id', user.id)
        .eq('metric_type', 'weight')
        .gte('recorded_at', sevenDaysAgo)
        .order('recorded_at', { ascending: false });
      if (!data || data.length === 0) return null;
      const avg = data.reduce((sum, d) => sum + Number(d.value), 0) / data.length;
      return Math.round(avg * 10) / 10;
    },
    enabled: !!user,
  });

  // Update local state when profile loads
  useEffect(() => {
    if (profile) {
      setHeightCm(profile.height_cm?.toString() || '');
      // Map database values to UI options
      const sexValue = profile.sex?.toLowerCase();
      if (sexValue === 'female') {
        setSex('female');
      } else if (sexValue === 'male') {
        setSex('male');
      } else {
        setSex(null);
      }
      setStepGoal(profile.step_goal?.toString() || '10000');
      setSleepGoal(profile.sleep_goal?.toString() || '8');
      setWeightGoal(profile.weight_goal?.toString() || '');
    }
  }, [profile]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles')
        .update({
          height_cm: heightCm ? parseFloat(heightCm) : null,
          sex,
          step_goal: parseInt(stepGoal) || 10000,
          sleep_goal: parseFloat(sleepGoal) || 8,
          weight_goal: weightGoal ? parseFloat(weightGoal) : null,
        } as any)
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setIsEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Could not save profile.');
    },
  });

  const bmi = calculateBMI(weightData, parseFloat(heightCm) || null);
  const goalBmi = calculateBMI(parseFloat(weightGoal) || null, parseFloat(heightCm) || null);

  const sexOptions: { value: BiologicalSex; label: string }[] = [
    { value: 'female', label: 'AFAB' },
    { value: 'male', label: 'AMAB' },
    { value: null, label: 'Prefer not to say' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Profile & Goals</Text>
        <TouchableOpacity onPress={() => isEditing ? saveMutation.mutate() : setIsEditing(true)}>
          <Text style={[styles.editButton, { color: colors.primary }]}>
            {isEditing ? 'Save' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* BMI Card - number only, no category labels */}
        {bmi && (
          <View style={[styles.bmiCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.bmiLabel, { color: colors.textSecondary }]}>Body Mass Index</Text>
            <Text style={[styles.bmiValue, { color: colors.text }]}>{bmi.toFixed(1)}</Text>
            <Text style={[styles.bmiSubtext, { color: colors.textSecondary }]}>
              Based on {weightData}kg and {heightCm}cm
            </Text>
          </View>
        )}

        {/* Body Measurements */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Body Measurements</Text>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Height (cm)</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="numeric"
                placeholder="e.g., 175"
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {heightCm ? `${heightCm} cm` : 'Not set'}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Sex assigned at birth</Text>
            <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
              Optional · Only used for biological health metrics if needed
            </Text>
            {isEditing ? (
              <View style={styles.sexOptions}>
                {sexOptions.map((opt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.sexOption,
                      { borderColor: colors.border },
                      sex === opt.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setSex(opt.value)}
                  >
                    <Text style={[
                      styles.sexOptionText,
                      { color: sex === opt.value ? '#FFF' : colors.text },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {sex ? sexOptions.find(o => o.value === sex)?.label : 'Not set'}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Current Weight (7-day avg)</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>
              {weightData ? `${weightData} kg` : 'No data - log weight to calculate BMI'}
            </Text>
          </View>
        </View>

        {/* Health Goals */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Health Goals</Text>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Daily Step Goal</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={stepGoal}
                onChangeText={setStepGoal}
                keyboardType="numeric"
                placeholder="10000"
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {parseInt(stepGoal).toLocaleString()} steps
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Sleep Goal (hours)</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={sleepGoal}
                onChangeText={setSleepGoal}
                keyboardType="numeric"
                placeholder="8"
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {sleepGoal} hours
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Target Weight (kg)</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={weightGoal}
                onChangeText={setWeightGoal}
                keyboardType="numeric"
                placeholder="Optional"
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {weightGoal ? `${weightGoal} kg` : 'Not set'}
              </Text>
            )}
          </View>

          {/* Goal BMI Preview - number only, no category */}
          {goalBmi && heightCm && (
            <View style={[styles.goalBmiContainer, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
              <Text style={[styles.goalBmiLabel, { color: colors.textSecondary }]}>Goal BMI</Text>
              <Text style={[styles.goalBmiValue, { color: colors.text }]}>
                {goalBmi.toFixed(1)}
              </Text>
              <Text style={[styles.goalBmiHint, { color: colors.textSecondary }]}>
                At {weightGoal}kg with your height of {heightCm}cm
              </Text>
            </View>
          )}

          {!goalBmi && weightGoal && !heightCm && (
            <Text style={[styles.goalBmiHint, { color: colors.textSecondary, marginTop: -8 }]}>
              Set your height to see goal BMI
            </Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: '600' },
  editButton: { fontSize: 16, fontWeight: '600' },
  bmiCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 16,
    padding: 20,
  },
  bmiLabel: { fontSize: 14 },
  bmiValue: { fontSize: 48, fontWeight: '700', marginTop: 8 },
  bmiSubtext: { fontSize: 13, marginTop: 4 },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, marginBottom: 2 },
  fieldHint: { fontSize: 11, marginBottom: 8, fontStyle: 'italic' },
  fieldValue: { fontSize: 16, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  sexOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sexOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  sexOptionText: { fontSize: 14, fontWeight: '500' },
  goalBmiContainer: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginTop: -4,
  },
  goalBmiLabel: { fontSize: 12 },
  goalBmiValue: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  goalBmiHint: { fontSize: 12, marginTop: 8 },
});