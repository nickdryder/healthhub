import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { colors as staticColors } from '@/constants/colors';

interface Props {
  onComplete?: () => void;
}

export function MedicationLogger({ onComplete }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const logMutation = useMutation({
    mutationFn: async (tookMedication: boolean) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('medication_logs').insert({
        user_id: user.id,
        took_medication: tookMedication,
        notes: notes.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, tookMedication) => {
      queryClient.invalidateQueries({ queryKey: ['medication-logs'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      setNotes('');
      setShowNotes(false);
      Alert.alert(
        tookMedication ? 'Great job!' : 'Logged',
        tookMedication 
          ? 'Medication taken - keep it up!' 
          : "No worries, it happens. We'll track this for insights."
      );
      onComplete?.();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Could not log medication.');
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${staticColors.primary}15` }]}>
          <Ionicons name="medical" size={24} color={staticColors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Daily Medication</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Did you take your prescribed medications today?
          </Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.tookButton, { backgroundColor: staticColors.success }]}
          onPress={() => logMutation.mutate(true)}
          disabled={logMutation.isPending}
        >
          <Ionicons name="checkmark-circle" size={24} color="#FFF" />
          <Text style={styles.buttonText}>I took my meds</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.forgotButton, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={() => logMutation.mutate(false)}
          disabled={logMutation.isPending}
        >
          <Ionicons name="close-circle" size={24} color={staticColors.error} />
          <Text style={[styles.forgotButtonText, { color: colors.text }]}>Oops, I forgot!</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.notesToggle} 
        onPress={() => setShowNotes(!showNotes)}
      >
        <Ionicons 
          name={showNotes ? 'chevron-up' : 'chevron-down'} 
          size={16} 
          color={colors.textSecondary} 
        />
        <Text style={[styles.notesToggleText, { color: colors.textSecondary }]}>
          Add notes (optional)
        </Text>
      </TouchableOpacity>

      {showNotes && (
        <TextInput
          style={[styles.notesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any notes about today's medication..."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={2}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  buttons: {
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  tookButton: {},
  forgotButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  forgotButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  notesToggleText: {
    fontSize: 13,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
