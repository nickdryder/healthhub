import { supabase } from '@/integrations/supabase/client';

// Weather codes from Open-Meteo
const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
};

export interface WeatherData {
  date: string;
  temperatureHigh: number;
  temperatureLow: number;
  precipitationMm: number;
  humidityAvg: number;
  pressureHpa: number;
  weatherCode: number;
  weatherDescription: string;
}

export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // State/region
}

// Search for cities using Open-Meteo Geocoding API
export async function searchCities(query: string): Promise<GeocodingResult[]> {
  if (query.length < 2) return [];
  
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
    );
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    
    if (!data.results) return [];
    
    return data.results.map((r: any) => ({
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      country: r.country,
      admin1: r.admin1,
    }));
  } catch (error) {
    console.error('City search failed:', error);
    return [];
  }
}

// Fetch weather for the past 7 days and extract timezone
export async function fetchWeatherHistory(lat: number, lon: number): Promise<{ data: WeatherData[]; timezone?: string }> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,surface_pressure_mean,weather_code&timezone=auto&start_date=${startDate}&end_date=${endDate}`
    );
    
    if (!response.ok) throw new Error('Weather fetch failed');
    
    const data = await response.json();
    const daily = data.daily;
    const timezone = data.timezone; // e.g., "Asia/Tokyo", "America/New_York"
    
    const weatherData: WeatherData[] = [];
    
    for (let i = 0; i < daily.time.length; i++) {
      const code = daily.weather_code[i] || 0;
      weatherData.push({
        date: daily.time[i],
        temperatureHigh: daily.temperature_2m_max[i],
        temperatureLow: daily.temperature_2m_min[i],
        precipitationMm: daily.precipitation_sum[i] || 0,
        humidityAvg: Math.round(daily.relative_humidity_2m_mean[i] || 0),
        pressureHpa: Math.round(daily.surface_pressure_mean[i] || 1013),
        weatherCode: code,
        weatherDescription: WEATHER_CODES[code] || 'Unknown',
      });
    }
    
    console.log(`[Weather] Timezone from Open-Meteo: ${timezone}`);
    return { data: weatherData, timezone };
  } catch (error) {
    console.error('Weather fetch failed:', error);
    return { data: [], timezone: undefined };
  }
}

// Save weather data to Supabase
export async function syncWeatherData(userId: string, lat: number, lon: number): Promise<boolean> {
  try {
    const result = await fetchWeatherHistory(lat, lon);
    const weatherHistory = result.data;
    
    if (weatherHistory.length === 0) return false;
    
    // Upsert weather data
    const records = weatherHistory.map(w => ({
      user_id: userId,
      date: w.date,
      temperature_high: w.temperatureHigh,
      temperature_low: w.temperatureLow,
      precipitation_mm: w.precipitationMm,
      humidity_avg: w.humidityAvg,
      pressure_hpa: w.pressureHpa,
      weather_code: w.weatherCode,
      weather_description: w.weatherDescription,
    }));
    
    const { error } = await supabase
      .from('weather_data')
      .upsert(records as any, { onConflict: 'user_id,date' });
    
    if (error) {
      console.error('Weather sync error:', error);
      return false;
    }
    
    console.log(`Synced ${records.length} days of weather data`);
    return true;
  } catch (error) {
    console.error('Weather sync failed:', error);
    return false;
  }
}

// Save user location to profile
export async function saveUserLocation(
  userId: string, 
  city: string, 
  lat: number, 
  lon: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        location_city: city,
        location_lat: lat,
        location_lon: lon,
      } as any)
      .eq('id', userId);
    
    if (error) throw error;
    
    // Also sync weather data immediately
    await syncWeatherData(userId, lat, lon);
    
    return true;
  } catch (error) {
    console.error('Save location failed:', error);
    return false;
  }
}

// Get user's saved location
export async function getUserLocation(userId: string): Promise<{ city: string; lat: number; lon: number } | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('location_city, location_lat, location_lon')
      .eq('id', userId)
      .single();
    
    if (error || !data?.location_city) return null;
    
    return {
      city: data.location_city,
      lat: data.location_lat,
      lon: data.location_lon,
    };
  } catch (error) {
    return null;
  }
}

// Check if it's a "bad weather" day (for correlations)
export function isRainyDay(weatherCode: number): boolean {
  return [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96].includes(weatherCode);
}

export function isLowPressure(pressureHpa: number): boolean {
  return pressureHpa < 1000; // Below 1000 hPa is considered low
}

export function isHighHumidity(humidity: number): boolean {
  return humidity > 80;
}