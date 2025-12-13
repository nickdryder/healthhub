import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/constants/colors';

const SUPPLEMENTS_KEY = '@health_hub_supplements';

interface Supplement {
  id: string;
  name: string;
  defaultDosage?: string;
}

interface SupplementPickerProps {
  value: { name: string; dosage: string };
  onChange: (value: { name: string; dosage: string }) => void;
}

const DEFAULT_SUPPLEMENTS: Supplement[] = [
  { id: '1', name: 'Vitamin D', defaultDosage: '1000 IU' },
  { id: '2', name: 'Vitamin B12', defaultDosage: '1000 mcg' },
  { id: '3', name: 'Fish Oil', defaultDosage: '1000 mg' },
  { id: '4', name: 'Magnesium', defaultDosage: '400 mg' },
  { id: '5', name: 'Zinc', defaultDosage: '15 mg' },
  { id: '6', name: 'Vitamin C', defaultDosage: '500 mg' },
];

export function SupplementPicker({ value, onChange }: SupplementPickerProps) {
  const [supplements, setSupplements] = useState<Supplement[]>(DEFAULT_SUPPLEMENTS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('');

  useEffect(() => {
    loadSupplements();
  }, []);

  const loadSupplements = async () => {
    try {
      const saved = await AsyncStorage.getItem(SUPPLEMENTS_KEY);
      if (saved) {
        setSupplements(JSON.parse(saved));
      }
    } catch (e) {
      console.log('Failed to load supplements:', e);
    }
  };

  const saveSupplements = async (list: Supplement[]) => {
    try {
      await AsyncStorage.setItem(SUPPLEMENTS_KEY, JSON.stringify(list));
    } catch (e) {
      console.log('Failed to save supplements:', e);
    }
  };

  const handleSelect = (supplement: Supplement) => {
    onChange({
      name: supplement.name,
      dosage: supplement.defaultDosage || '',
    });
  };

  const handleAddNew = () => {
    if (!newName.trim()) {
      Alert.alert('Name Required', 'Please enter a supplement name.');
      return;
    }

    const exists = supplements.some(
      s => s.name.toLowerCase() === newName.trim().toLowerCase()
    );
    if (exists) {
      Alert.alert('Already Exists', 'This supplement is already in your list.');
      return;
    }

    const newSupplement: Supplement = {
      id: Date.now().toString(),
      name: newName.trim(),
      defaultDosage: newDosage.trim() || undefined,
    };

    const updated = [...supplements, newSupplement];
    setSupplements(updated);
    saveSupplements(updated);
    
    // Auto-select the new supplement
    onChange({ name: newSupplement.name, dosage: newSupplement.defaultDosage || '' });
    
    setNewName('');
    setNewDosage('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove Supplement', 'Remove this supplement from your list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const updated = supplements.filter(s => s.id !== id);
          setSupplements(updated);
          saveSupplements(updated);
          if (supplements.find(s => s.id === id)?.name === value.name) {
            onChange({ name: '', dosage: '' });
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Supplement</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollContainer}>
        <View style={styles.pillsRow}>
          {supplements.map((supplement) => (
            <TouchableOpacity
              key={supplement.id}
              style={[styles.pill, value.name === supplement.name && styles.pillSelected]}
              onPress={() => handleSelect(supplement)}
              onLongPress={() => handleDelete(supplement.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, value.name === supplement.name && styles.pillTextSelected]}>
                {supplement.name}
              </Text>
              {supplement.defaultDosage && (
                <Text style={[styles.pillDosage, value.name === supplement.name && styles.pillDosageSelected]}>
                  {supplement.defaultDosage}
                </Text>
              )}
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={styles.addPill}
            onPress={() => setShowAddForm(!showAddForm)}
            activeOpacity={0.7}
          >
            <Ionicons name={showAddForm ? "close" : "add"} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showAddForm && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Supplement name"
            placeholderTextColor={colors.gray400}
          />
          <TextInput
            style={styles.input}
            value={newDosage}
            onChangeText={setNewDosage}
            placeholder="Default dosage (optional)"
            placeholderTextColor={colors.gray400}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
            <Text style={styles.addButtonText}>Add to List</Text>
          </TouchableOpacity>
        </View>
      )}

      {value.name && (
        <View style={styles.dosageSection}>
          <Text style={styles.dosageLabel}>Dosage</Text>
          <TextInput
            style={styles.dosageInput}
            value={value.dosage}
            onChangeText={(text) => onChange({ ...value, dosage: text })}
            placeholder="e.g., 1000mg, 2 capsules"
            placeholderTextColor={colors.gray400}
          />
        </View>
      )}

      <Text style={styles.hint}>Long press to remove a supplement from your list</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  scrollContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.gray50,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pillSelected: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
  },
  pillTextSelected: {
    color: colors.primary,
  },
  pillDosage: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
  },
  pillDosageSelected: {
    color: colors.primary,
  },
  addPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addForm: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.gray50,
    borderRadius: 12,
    gap: 12,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.gray900,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dosageSection: {
    marginTop: 16,
  },
  dosageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 8,
  },
  dosageInput: {
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.gray900,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  hint: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 12,
    textAlign: 'center',
  },
});
