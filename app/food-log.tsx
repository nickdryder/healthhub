import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { colors as staticColors } from '@/constants/colors';
import { EditFoodTimeModal } from '@/components/logging/EditFoodTimeModal';

interface FoodEntry {
  id: string;
  food_name: string;
  brand: string | null;
  meal_type: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  contains_dairy: boolean;
  contains_gluten: boolean;
  contains_caffeine: boolean;
  logged_at: string;
  source: string;
}

const TAG_OPTIONS = [
  { id: 'dairy', label: 'Dairy', icon: 'water-outline' as const, color: '#5B9BD5' },
  { id: 'gluten', label: 'Gluten', icon: 'leaf-outline' as const, color: '#C4A35A' },
  { id: 'caffeine', label: 'Caffeine', icon: 'cafe-outline' as const, color: '#8B4513' },
  { id: 'fast_food', label: 'Fast Food', icon: 'fast-food-outline' as const, color: '#FF6B6B' },
  { id: 'spicy', label: 'Spicy', icon: 'flame-outline' as const, color: '#FF4500' },
  { id: 'fried', label: 'Fried', icon: 'restaurant-outline' as const, color: '#DAA520' },
  { id: 'processed', label: 'Processed', icon: 'cube-outline' as const, color: '#808080' },
  { id: 'high_sugar', label: 'High Sugar', icon: 'nutrition-outline' as const, color: '#FF69B4' },
];

export default function FoodLogScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTimeEntry, setEditingTimeEntry] = useState<FoodEntry | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: foodEntries, isLoading } = useQuery({
    queryKey: ['food-entries', user?.id],
    queryFn: async (): Promise<FoodEntry[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', today.toISOString())
        .order('logged_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FoodEntry[];
    },
    enabled: !!user,
  });

  const toggleTag = async (entryId: string, tagField: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('food_entries')
        .update({ [tagField]: !currentValue })
        .eq('id', entryId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['food-entries'] });
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update tag');
    }
  };

  const getMealIcon = (mealType: string): keyof typeof Ionicons.glyphMap => {
    switch (mealType) {
      case 'breakfast': return 'sunny-outline';
      case 'lunch': return 'partly-sunny-outline';
      case 'dinner': return 'moon-outline';
      default: return 'restaurant-outline';
    }
  };

  const formatMealType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };

  const totalCalories = foodEntries?.reduce((sum, e) => sum + (Number(e.calories) || 0), 0) || 0;
  const totalProtein = foodEntries?.reduce((sum, e) => sum + (Number(e.protein) || 0), 0) || 0;
  const totalCarbs = foodEntries?.reduce((sum, e) => sum + (Number(e.carbs) || 0), 0) || 0;
  const totalFat = foodEntries?.reduce((sum, e) => sum + (Number(e.fat) || 0), 0) || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Today's Food</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Daily Summary</Text>
          <Text style={[styles.calorieTotal, { color: colors.primary }]}>{totalCalories} kcal</Text>
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: '#FF6B6B' }]} />
              <Text style={[styles.macroValue, { color: colors.text }]}>{Math.round(totalProtein)}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: '#4ECDC4' }]} />
              <Text style={[styles.macroValue, { color: colors.text }]}>{Math.round(totalCarbs)}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: '#FFE66D' }]} />
              <Text style={[styles.macroValue, { color: colors.text }]}>{Math.round(totalFat)}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Fat</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Food Items ({foodEntries?.length || 0})
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !foodEntries || foodEntries.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Ionicons name="nutrition-outline" size={48} color={colors.gray300} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No food entries today</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Sync your Fitbit or add food manually
            </Text>
          </View>
        ) : (
          foodEntries.map((entry) => (
            <View key={entry.id} style={[styles.foodCard, { backgroundColor: colors.card }]}>
              <TouchableOpacity 
                style={styles.foodHeader}
                onPress={() => setEditingId(editingId === entry.id ? null : entry.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.mealIcon, { backgroundColor: `${staticColors.primary}15` }]}>
                  <Ionicons name={getMealIcon(entry.meal_type)} size={20} color={staticColors.primary} />
                </View>
                <View style={styles.foodInfo}>
                  <Text style={[styles.foodName, { color: colors.text }]} numberOfLines={1}>
                    {entry.food_name}
                  </Text>
                  <Text style={[styles.foodMeta, { color: colors.textSecondary }]}>
                    {formatMealType(entry.meal_type)} • {Math.round(Number(entry.calories))} kcal
                  </Text>
                </View>
                <View style={styles.activeTags}>
                  {entry.contains_dairy && (
                    <View style={[styles.miniTag, { backgroundColor: '#5B9BD515' }]}>
                      <Ionicons name="water" size={12} color="#5B9BD5" />
                    </View>
                  )}
                  {entry.contains_gluten && (
                    <View style={[styles.miniTag, { backgroundColor: '#C4A35A15' }]}>
                      <Ionicons name="leaf" size={12} color="#C4A35A" />
                    </View>
                  )}
                  {entry.contains_caffeine && (
                    <View style={[styles.miniTag, { backgroundColor: '#8B451315' }]}>
                      <Ionicons name="cafe" size={12} color="#8B4513" />
                    </View>
                  )}
                </View>
                <Ionicons 
                  name={editingId === entry.id ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color={colors.textSecondary} 
                />
              </TouchableOpacity>

              {editingId === entry.id && (
                <View style={styles.tagSection}>
                  <TouchableOpacity 
                    style={styles.timeEditButton}
                    onPress={() => setEditingTimeEntry(entry)}
                  >
                    <Ionicons name="time-outline" size={16} color={staticColors.primary} />
                    <Text style={[styles.timeEditText, { color: staticColors.primary }]}>
                      Edit Time: {new Date(entry.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </Text>
                    <Ionicons name="pencil" size={14} color={staticColors.primary} />
                  </TouchableOpacity>

                  <Text style={[styles.tagSectionTitle, { color: colors.textSecondary }]}>
                    Add tags for tracking
                  </Text>
                  <View style={styles.tagGrid}>
                    {TAG_OPTIONS.map((tag) => {
                      const fieldMap: Record<string, keyof FoodEntry> = {
                        dairy: 'contains_dairy',
                        gluten: 'contains_gluten',
                        caffeine: 'contains_caffeine',
                      };
                      const field = fieldMap[tag.id];
                      const isActive = field ? entry[field] : false;

                      return (
                        <TouchableOpacity
                          key={tag.id}
                          style={[
                            styles.tagButton,
                            { backgroundColor: isActive ? `${tag.color}20` : colors.background, borderColor: isActive ? tag.color : colors.border },
                          ]}
                          onPress={() => {
                            if (field) {
                              toggleTag(entry.id, field, isActive as boolean);
                            } else {
                              Alert.alert('Coming Soon', `${tag.label} tagging will be available soon.`);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={tag.icon} size={16} color={isActive ? tag.color : colors.textSecondary} />
                          <Text style={[styles.tagLabel, { color: isActive ? tag.color : colors.textSecondary }]}>
                            {tag.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.nutritionDetail, { borderTopColor: colors.border }]}>
                    <View style={styles.nutritionRow}>
                      <Text style={[styles.nutritionLabel, { color: colors.textSecondary }]}>Protein</Text>
                      <Text style={[styles.nutritionValue, { color: colors.text }]}>{Math.round(Number(entry.protein))}g</Text>
                    </View>
                    <View style={styles.nutritionRow}>
                      <Text style={[styles.nutritionLabel, { color: colors.textSecondary }]}>Carbs</Text>
                      <Text style={[styles.nutritionValue, { color: colors.text }]}>{Math.round(Number(entry.carbs))}g</Text>
                    </View>
                    <View style={styles.nutritionRow}>
                      <Text style={[styles.nutritionLabel, { color: colors.textSecondary }]}>Fat</Text>
                      <Text style={[styles.nutritionValue, { color: colors.text }]}>{Math.round(Number(entry.fat))}g</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {editingTimeEntry && (
        <EditFoodTimeModal
          visible={!!editingTimeEntry}
          entryId={editingTimeEntry.id}
          currentTime={editingTimeEntry.logged_at}
          foodName={editingTimeEntry.food_name}
          mealType={editingTimeEntry.meal_type}
          onClose={() => setEditingTimeEntry(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['food-entries'] });
            setEditingTimeEntry(null);
          }}
        />
      )}
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
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryTitle: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  calorieTotal: { fontSize: 36, fontWeight: '700' },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
  },
  macroItem: { alignItems: 'center' },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  macroValue: { fontSize: 16, fontWeight: '600' },
  macroLabel: { fontSize: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  foodCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 15, fontWeight: '600' },
  foodMeta: { fontSize: 13, marginTop: 2 },
  activeTags: { flexDirection: 'row', gap: 4 },
  miniTag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagSection: { paddingHorizontal: 14, paddingBottom: 14 },
  timeEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: `${staticColors.primary}10`,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
  },
  timeEditText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  tagSectionTitle: { fontSize: 12, fontWeight: '500', marginBottom: 10 },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  tagLabel: { fontSize: 13, fontWeight: '500' },
  nutritionDetail: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionLabel: { fontSize: 14 },
  nutritionValue: { fontSize: 14, fontWeight: '600' },
  emptyState: {
    marginHorizontal: 20,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
});