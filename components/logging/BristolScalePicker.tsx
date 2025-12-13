import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors } from '@/constants/colors';

interface BristolScalePickerProps {
  value: number | null;
  onChange: (value: number) => void;
  amount: number;
  onAmountChange: (amount: number) => void;
}

const bristolTypes = [
  { type: 1, emoji: '🥜', label: 'Type 1', description: 'Hard lumps' },
  { type: 2, emoji: '🌰', label: 'Type 2', description: 'Lumpy sausage' },
  { type: 3, emoji: '🌭', label: 'Type 3', description: 'Cracked sausage' },
  { type: 4, emoji: '🍌', label: 'Type 4', description: 'Smooth snake' },
  { type: 5, emoji: '☁️', label: 'Type 5', description: 'Soft blobs' },
  { type: 6, emoji: '🥣', label: 'Type 6', description: 'Mushy' },
  { type: 7, emoji: '💧', label: 'Type 7', description: 'Liquid' },
];

const getAmountLabel = (amount: number): string => {
  if (amount <= 2) return 'Very Small';
  if (amount <= 4) return 'Small';
  if (amount <= 6) return 'Medium';
  if (amount <= 8) return 'Large';
  return 'Very Large';
};

export function BristolScalePicker({ value, onChange, amount, onAmountChange }: BristolScalePickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bristol Stool Scale</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {bristolTypes.map((item) => (
          <TouchableOpacity
            key={item.type}
            style={[styles.item, value === item.type && styles.itemSelected]}
            onPress={() => onChange(item.type)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={[styles.label, value === item.type && styles.labelSelected]}>{item.label}</Text>
            <Text style={[styles.description, value === item.type && styles.descriptionSelected]}>
              {item.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.amountSection}>
        <View style={styles.amountHeader}>
          <Text style={styles.title}>Amount</Text>
          <View style={styles.amountBadge}>
            <Text style={styles.amountValue}>{amount}</Text>
            <Text style={styles.amountLabel}>{getAmountLabel(amount)}</Text>
          </View>
        </View>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>1</Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={amount}
            onValueChange={onAmountChange}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.gray200}
            thumbTintColor={colors.primary}
          />
          <Text style={styles.sliderLabel}>10</Text>
        </View>
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
  scroll: {
    gap: 10,
    paddingRight: 20,
  },
  item: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.gray50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 85,
  },
  itemSelected: {
    backgroundColor: `${colors.primary}10`,
    borderColor: colors.primary,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
  },
  labelSelected: {
    color: colors.primary,
  },
  description: {
    fontSize: 10,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: 2,
  },
  descriptionSelected: {
    color: colors.primary,
  },
  amountSection: {
    marginTop: 20,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  amountLabel: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray500,
    width: 20,
    textAlign: 'center',
  },
});