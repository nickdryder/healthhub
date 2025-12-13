import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface WeightPickerProps {
  value: string;
  onChange: (value: string) => void;
  unit?: 'kg' | 'lbs';
}

export function WeightPicker({ value, onChange, unit = 'kg' }: WeightPickerProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [lastWeight, setLastWeight] = useState<number | null>(null);

  useEffect(() => {
    // Fetch last logged weight to pre-populate
    const fetchLastWeight = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('health_metrics')
        .select('value')
        .eq('user_id', user.id)
        .eq('metric_type', 'weight')
        .order('recorded_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setLastWeight(data[0].value);
      }
    };

    fetchLastWeight();
  }, [user]);

  const adjustWeight = (delta: number) => {
    const current = parseFloat(value) || lastWeight || 70;
    const newValue = Math.max(0, current + delta);
    onChange(newValue.toFixed(1));
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>Current Weight</Text>
      
      <View style={styles.inputRow}>
        <TouchableOpacity 
          style={[styles.adjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => adjustWeight(-0.5)}
        >
          <Ionicons name="remove" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            placeholder={lastWeight?.toFixed(1) || '70.0'}
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.adjustButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => adjustWeight(0.5)}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {lastWeight && (
        <View style={styles.lastWeightRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.lastWeightText, { color: colors.textSecondary }]}>
            Last logged: {lastWeight.toFixed(1)} {unit}
          </Text>
        </View>
      )}

      <View style={[styles.infoCard, { backgroundColor: `${colors.primary}10` }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          We calculate a 7-day moving average to smooth out daily fluctuations from water retention, meals, etc.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    paddingVertical: 12,
    textAlign: 'center',
  },
  unit: {
    fontSize: 18,
    fontWeight: '600',
  },
  lastWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    justifyContent: 'center',
  },
  lastWeightText: {
    fontSize: 13,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
