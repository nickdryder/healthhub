import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/integrations/supabase/client';
import { colors } from '@/constants/colors';

interface EditFoodTimeModalProps {
  visible: boolean;
  entryId: string;
  currentTime: string;
  foodName: string;
  mealType: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditFoodTimeModal({
  visible,
  entryId,
  currentTime,
  foodName,
  mealType,
  onClose,
  onUpdate,
}: EditFoodTimeModalProps) {
  const [date, setDate] = useState(new Date(currentTime));
  const [loading, setLoading] = useState(false);

  const handleHourChange = (offset: number) => {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + offset);
    setDate(newDate);
  };

  const handleMinuteChange = (offset: number) => {
    const newDate = new Date(date);
    newDate.setMinutes(newDate.getMinutes() + offset);
    setDate(newDate);
  };

  const handleDateChange = (offset: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + offset);
    setDate(newDate);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('food_entries')
        .update({ logged_at: date.toISOString() })
        .eq('id', entryId);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to update food entry time');
      console.error('Error updating food entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };
    return d.toLocaleDateString('en-US', options);
  };

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Entry Time</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color={colors.gray800} />
            </TouchableOpacity>
          </View>

          <View style={styles.entryInfo}>
            <Text style={styles.infoLabel}>{mealType}</Text>
            <Text style={styles.infoValue}>{foodName}</Text>
          </View>

          {/* Date Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date</Text>
            <View style={styles.pickerRow}>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => handleDateChange(-1)}
                disabled={loading}
              >
                <Ionicons name="chevron-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.pickerValue}>{formatDate(date)}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => handleDateChange(1)}
                disabled={loading}
              >
                <Ionicons name="chevron-forward" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Time Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time</Text>
            <View style={styles.timeRow}>
              {/* Hours */}
              <View style={styles.timeColumn}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => handleHourChange(1)}
                  disabled={loading}
                >
                  <Ionicons name="chevron-up" size={20} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{String(date.getHours()).padStart(2, '0')}</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => handleHourChange(-1)}
                  disabled={loading}
                >
                  <Ionicons name="chevron-down" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Minutes */}
              <View style={styles.timeColumn}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => handleMinuteChange(1)}
                  disabled={loading}
                >
                  <Ionicons name="chevron-up" size={20} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{String(date.getMinutes()).padStart(2, '0')}</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => handleMinuteChange(-1)}
                  disabled={loading}
                >
                  <Ionicons name="chevron-down" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.fullTime}>{formatTime(date)}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.disabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray800,
  },
  entryInfo: {
    backgroundColor: `${colors.primary}10`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.gray500,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 12,
  },
  pickerButton: {
    padding: 8,
  },
  pickerValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray800,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 12,
    paddingVertical: 16,
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeButton: {
    padding: 4,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.gray800,
    marginVertical: 4,
  },
  timeSeparator: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray800,
    marginHorizontal: 8,
  },
  fullTime: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.gray100,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  disabled: {
    opacity: 0.6,
  },
});
