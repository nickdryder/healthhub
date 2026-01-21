import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { searchCities, GeocodingResult, saveUserLocation, getUserLocation } from '@/services/weather';
import { useAuth } from '@/providers/AuthProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors as staticColors } from '@/constants/colors';
import { useRouter } from 'expo-router';

export function LocationPicker() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch saved location
  const { data: savedLocation } = useQuery({
    queryKey: ['user-location', user?.id],
    queryFn: () => user ? getUserLocation(user.id) : null,
    enabled: !!user,
  });

  // Save location mutation
  const saveMutation = useMutation({
    mutationFn: async (location: GeocodingResult) => {
      if (!user) throw new Error('Not authenticated');
      const displayName = location.admin1
        ? `${location.name}, ${location.admin1}, ${location.country}`
        : `${location.name}, ${location.country}`;
      return saveUserLocation(user.id, displayName, location.latitude, location.longitude);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-location'] });
      queryClient.invalidateQueries({ queryKey: ['weather-data'] });
      setIsEditing(false);
      setQuery('');
      setResults([]);
    },
    onError: (error) => {
      if (error.message === 'Not authenticated') {
        Alert.alert(
          'Sign In Required',
          'Please sign in to save your weather location.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign In', onPress: () => router.push('/auth') },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to save location. Please try again.');
      }
    },
  });

  // Debounced search
  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    
    if (text.length < 2) {
      setResults([]);
      return;
    }
    
    setSearching(true);
    const cities = await searchCities(text);
    setResults(cities);
    setSearching(false);
  }, []);

  const handleSelectCity = (city: GeocodingResult) => {
    saveMutation.mutate(city);
  };

  const handleClearLocation = async () => {
    if (!user) return;
    // Clear location by setting to null values
    await saveUserLocation(user.id, '', 0, 0);
    queryClient.invalidateQueries({ queryKey: ['user-location'] });
  };

  if (!isEditing && savedLocation) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${staticColors.primary}15` }]}>
            <Ionicons name="location" size={20} color={staticColors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Weather Location</Text>
            <Text style={[styles.cityName, { color: colors.text }]}>{savedLocation.city}</Text>
          </View>
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
            <Ionicons name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Weather data syncs daily to find correlations with symptoms
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${staticColors.primary}15` }]}>
          <Ionicons name="location" size={20} color={staticColors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Weather Location</Text>
        {isEditing && savedLocation && (
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Set your city once to track weather correlations (e.g., joint pain on rainy days). No location tracking needed.
      </Text>

      <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Search for your city..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="words"
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {results.length > 0 && (
        <View style={[styles.results, { borderColor: colors.border }]}>
          {results.map((city, index) => (
            <TouchableOpacity
              key={`${city.latitude}-${city.longitude}`}
              style={[
                styles.resultItem,
                index < results.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
              onPress={() => handleSelectCity(city)}
              disabled={saveMutation.isPending}
            >
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <View style={styles.resultText}>
                <Text style={[styles.resultCity, { color: colors.text }]}>{city.name}</Text>
                <Text style={[styles.resultRegion, { color: colors.textSecondary }]}>
                  {city.admin1 ? `${city.admin1}, ${city.country}` : city.country}
                </Text>
              </View>
              {saveMutation.isPending && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
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
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  label: {
    fontSize: 12,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  editButton: {
    padding: 8,
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 14,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  results: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  resultText: {
    flex: 1,
  },
  resultCity: {
    fontSize: 15,
    fontWeight: '500',
  },
  resultRegion: {
    fontSize: 13,
    marginTop: 2,
  },
});
