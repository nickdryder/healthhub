import { Platform } from 'react-native';
import { supabase } from '@/integrations/supabase/client';

// Check if we're on iOS (HealthKit only available on iOS)
export const isHealthKitAvailable = Platform.OS === 'ios';

// Dynamic import type for HealthKit
let HealthKit: typeof import('@kingstinct/react-native-healthkit') | null = null;

// Fallback identifiers (HealthKit accepts string identifiers directly)
const HK_QUANTITY_IDS = {
  stepCount: 'HKQuantityTypeIdentifierStepCount',
  heartRate: 'HKQuantityTypeIdentifierHeartRate',
  restingHeartRate: 'HKQuantityTypeIdentifierRestingHeartRate',
  heartRateVariabilitySDNN: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  oxygenSaturation: 'HKQuantityTypeIdentifierOxygenSaturation',
  activeEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  bodyMass: 'HKQuantityTypeIdentifierBodyMass',
};
const HK_CATEGORY_IDS = {
  sleepAnalysis: 'HKCategoryTypeIdentifierSleepAnalysis',
};

// Helper to get quantity type identifier
function getQuantityId(key: keyof typeof HK_QUANTITY_IDS): string {
  return HealthKit?.HKQuantityTypeIdentifier?.[key] ?? HK_QUANTITY_IDS[key];
}
function getCategoryId(key: keyof typeof HK_CATEGORY_IDS): string {
  return HealthKit?.HKCategoryTypeIdentifier?.[key] ?? HK_CATEGORY_IDS[key];
}

/**
 * Apple Health Integration Service
 * 
 * Works in development builds with @kingstinct/react-native-healthkit.
 * Falls back to mock data in Expo Go or web.
 */
class HealthKitService {
  private isInitialized = false;
  private isRealHealthKit = false;

  async initialize(): Promise<boolean> {
    if (!isHealthKitAvailable) {
      console.log('HealthKit is only available on iOS');
      return false;
    }

    if (this.isInitialized) return true;

    try {
      // Try to dynamically import HealthKit (only works in dev builds)
      HealthKit = await import('@kingstinct/react-native-healthkit');

      const isAvailable = await HealthKit.default.isHealthDataAvailable();
      if (!isAvailable) {
        console.log('HealthKit not available on this device');
        return false;
      }

      this.isRealHealthKit = true;
      this.isInitialized = true;
      console.log('HealthKit initialized successfully (real mode)');
      return true;
    } catch (error) {
      // Falls back to mock mode (Expo Go doesn't have native modules)
      console.log('HealthKit native module not available - using mock mode');
      console.log('To enable real HealthKit: npx expo prebuild && npx expo run:ios');
      this.isRealHealthKit = false;
      this.isInitialized = true;
      return true;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isRealHealthKit || !HealthKit) {
      console.log('Using mock HealthKit permissions');
      return true;
    }

    try {
      const permissions = {
        read: [
          getQuantityId('stepCount'),
          getQuantityId('heartRate'),
          getQuantityId('restingHeartRate'),
          getQuantityId('heartRateVariabilitySDNN'),
          getQuantityId('oxygenSaturation'),
          getQuantityId('activeEnergyBurned'),
          getQuantityId('bodyMass'),
          getCategoryId('sleepAnalysis'),
        ],
        write: [] as string[],
      };

      await HealthKit.default.requestAuthorization(permissions.read, permissions.write);
      console.log('HealthKit permissions granted');
      return true;
    } catch (error: any) {
      console.error('Failed to request HealthKit permissions:', error);
      // Provide more specific error info
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('denied') || errorMessage.includes('authorization')) {
        throw new Error('HEALTHKIT_CAPABILITY_MISSING');
      }
      throw error;
    }
  }

  async getSteps(startDate: Date, endDate: Date): Promise<number> {
    if (!this.isRealHealthKit || !HealthKit) {
      // Mock data
      return Math.floor(Math.random() * 5000) + 5000;
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        getQuantityId('stepCount'),
        { from: startDate, to: endDate }
      );
      return samples.reduce((sum, s) => sum + s.quantity, 0);
    } catch (error) {
      console.error('Failed to get steps:', error);
      return 0;
    }
  }

  async getHeartRate(startDate: Date, endDate: Date): Promise<{ value: number; date: string }[]> {
    if (!this.isRealHealthKit || !HealthKit) {
      return [{ value: 65 + Math.floor(Math.random() * 20), date: new Date().toISOString() }];
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        getQuantityId('heartRate'),
        { from: startDate, to: endDate }
      );
      return samples.map(s => ({
        value: s.quantity,
        date: s.startDate.toISOString(),
      }));
    } catch (error) {
      console.error('Failed to get heart rate:', error);
      return [];
    }
  }

  async getRestingHeartRate(startDate: Date, endDate: Date): Promise<number | null> {
    if (!this.isRealHealthKit || !HealthKit) {
      return 60 + Math.floor(Math.random() * 15);
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        getQuantityId('restingHeartRate'),
        { from: startDate, to: endDate }
      );
      if (samples.length === 0) return null;
      return Math.round(samples.reduce((sum, s) => sum + s.quantity, 0) / samples.length);
    } catch (error) {
      console.error('Failed to get resting heart rate:', error);
      return null;
    }
  }

  async getHRV(startDate: Date, endDate: Date): Promise<number | null> {
    if (!this.isRealHealthKit || !HealthKit) {
      return 30 + Math.floor(Math.random() * 40); // Mock HRV 30-70ms
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        getQuantityId('heartRateVariabilitySDNN'),
        { from: startDate, to: endDate }
      );
      if (samples.length === 0) return null;
      return Math.round(samples.reduce((sum, s) => sum + s.quantity, 0) / samples.length);
    } catch (error) {
      console.error('Failed to get HRV:', error);
      return null;
    }
  }
  async getSleep(startDate: Date, endDate: Date): Promise<{ totalHours: number; quality: number }> {
    if (!this.isRealHealthKit || !HealthKit) {
      const totalHours = 6 + Math.random() * 2;
      return { totalHours: Math.round(totalHours * 10) / 10, quality: Math.floor(70 + Math.random() * 25) };
    }

    try {
      const samples = await HealthKit.default.queryCategorySamples(
        getCategoryId('sleepAnalysis'),
        { from: startDate, to: endDate }
      );

      if (!samples || samples.length === 0) {
        return { totalHours: 0, quality: 0 };
      }

      // Calculate total sleep from samples (asleep categories)
      // Use string values as fallback for sleep analysis values
      let totalMs = 0;
      const asleepValues = HealthKit.HKCategoryValueSleepAnalysis ? [
        HealthKit.HKCategoryValueSleepAnalysis.asleepCore,
        HealthKit.HKCategoryValueSleepAnalysis.asleepDeep,
        HealthKit.HKCategoryValueSleepAnalysis.asleepREM,
        HealthKit.HKCategoryValueSleepAnalysis.asleepUnspecified,
      ] : [3, 4, 5, 2]; // Numeric fallbacks for sleep values

      samples.forEach(sample => {
        if (asleepValues.includes(sample.value as any)) {
          totalMs += sample.endDate.getTime() - sample.startDate.getTime();
        }
      });

      const totalHours = totalMs / (1000 * 60 * 60);

      // Calculate quality based on sleep stages
      const deepValue = HealthKit.HKCategoryValueSleepAnalysis?.asleepDeep ?? 4;
      const remValue = HealthKit.HKCategoryValueSleepAnalysis?.asleepREM ?? 5;
      const deepSleep = samples.filter(s => s.value === deepValue).length;
      const remSleep = samples.filter(s => s.value === remValue).length;
      const quality = Math.min(100, 50 + deepSleep * 10 + remSleep * 5);

      return { totalHours: Math.round(totalHours * 10) / 10, quality };
    } catch (error) {
      console.error('Failed to get sleep data:', error);
      return { totalHours: 0, quality: 0 };
    }
  }

  async getActiveCalories(startDate: Date, endDate: Date): Promise<number> {
    if (!this.isRealHealthKit || !HealthKit) {
      return Math.floor(Math.random() * 300) + 200;
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        getQuantityId('activeEnergyBurned'),
        { from: startDate, to: endDate }
      );
      if (!samples || samples.length === 0) return 0;
      return Math.round(samples.reduce((sum, s) => sum + s.quantity, 0));
    } catch (error) {
      console.error('Failed to get active calories:', error);
      return 0;
    }
  }

  async getWeight(startDate: Date, endDate: Date): Promise<number | null> {
    if (!this.isRealHealthKit || !HealthKit) {
      return null; // Don't mock weight
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        getQuantityId('bodyMass'),
        { from: startDate, to: endDate }
      );
      if (!samples || samples.length === 0) return null;
      // Return most recent
      return Math.round(samples[samples.length - 1].quantity * 10) / 10;
    } catch (error) {
      console.error('Failed to get weight:', error);
      return null;
    }
  }

  isUsingRealHealthKit(): boolean {
    return this.isRealHealthKit;
  }

  async syncToSupabase(userId: string): Promise<boolean> {
    if (!userId) return false;

    // Don't sync mock data - only sync real HealthKit data
    if (!this.isRealHealthKit) {
      console.log('Skipping Apple Health sync - mock mode disabled. Create a dev build for real data.');
      return false;
    }
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      // Get all health data
      const [steps, heartRateSamples, sleep, restingHR, hrv, activeCalories, weight] = await Promise.all([
        this.getSteps(yesterday, now),
        this.getHeartRate(yesterday, now),
        this.getSleep(yesterday, now),
        this.getRestingHeartRate(yesterday, now),
        this.getHRV(yesterday, now),
        this.getActiveCalories(yesterday, now),
        this.getWeight(yesterday, now),
      ]);

      const metrics = [];
      const source = 'apple_health'; // Always real now

      // Steps
      if (steps > 0) {
        metrics.push({
          user_id: userId,
          metric_type: 'steps',
          value: steps,
          unit: 'steps',
          source,
          recorded_at: now.toISOString(),
        });
      }

      // Heart rate (average)
      if (heartRateSamples.length > 0) {
        const avgHR = heartRateSamples.reduce((sum, s) => sum + s.value, 0) / heartRateSamples.length;
        metrics.push({
          user_id: userId,
          metric_type: 'heart_rate',
          value: Math.round(avgHR),
          unit: 'bpm',
          source,
          recorded_at: now.toISOString(),
        });
      }

      // Sleep
      if (sleep.totalHours > 0) {
        metrics.push({
          user_id: userId,
          metric_type: 'sleep',
          value: sleep.totalHours,
          unit: 'hours',
          source,
          recorded_at: now.toISOString(),
          metadata: { quality: sleep.quality },
        });
      }

      // Resting heart rate
      if (restingHR) {
        metrics.push({
          user_id: userId,
          metric_type: 'resting_heart_rate',
          value: restingHR,
          unit: 'bpm',
          source,
          recorded_at: now.toISOString(),
        });
      }

      // HRV (new - Fitbit doesn't provide this)
      if (hrv) {
        metrics.push({
          user_id: userId,
          metric_type: 'hrv',
          value: hrv,
          unit: 'ms',
          source,
          recorded_at: now.toISOString(),
        });
      }

      // Active calories
      if (activeCalories > 0) {
        metrics.push({
          user_id: userId,
          metric_type: 'active_calories',
          value: activeCalories,
          unit: 'kcal',
          source,
          recorded_at: now.toISOString(),
        });
      }

      // Weight
      if (weight) {
        metrics.push({
          user_id: userId,
          metric_type: 'weight',
          value: weight,
          unit: 'kg',
          source,
          recorded_at: now.toISOString(),
        });
      }

      // Insert into Supabase
      if (metrics.length > 0) {
        const { error } = await supabase.from('health_metrics').insert(metrics as any);
        if (error) throw error;
        // Update integration last sync time
        await supabase
          .from('integrations')
          .upsert({
            user_id: userId,
            provider: 'apple_health',
            is_connected: true,
            last_sync_at: now.toISOString(),
          } as any, { onConflict: 'user_id,provider' });
      }

      console.log(`Synced ${metrics.length} health metrics from Apple Health`);
      return true;
    } catch (error) {
      console.error('Failed to sync HealthKit data:', error);
      return false;
    }
  }
}

export const healthKitService = new HealthKitService();