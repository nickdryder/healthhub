import { Platform } from 'react-native';
import { supabase } from '@/integrations/supabase/client';

// Check if we're on iOS (HealthKit only available on iOS)
export const isHealthKitAvailable = Platform.OS === 'ios';

// Dynamic import type for HealthKit
let HealthKit: typeof import('@kingstinct/react-native-healthkit') | null = null;

/**
 * Apple Health Integration Service
 *
 * Requires development builds with @kingstinct/react-native-healthkit.
 * Only works on iOS devices with native HealthKit support.
 */
class HealthKitService {
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (!isHealthKitAvailable) {
      console.log('HealthKit is only available on iOS');
      return false;
    }

    if (this.isInitialized) return true;

    try {
      // Dynamically import HealthKit (only works in dev builds)
      HealthKit = await import('@kingstinct/react-native-healthkit');

      const isAvailable = await HealthKit.default.isHealthDataAvailable();
      if (!isAvailable) {
        console.log('HealthKit not available on this device');
        return false;
      }

      this.isInitialized = true;
      console.log('HealthKit initialized successfully');
      return true;
    } catch (error) {
      console.error('HealthKit native module not available');
      console.log('To enable HealthKit: npx expo prebuild && npx expo run:ios');
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    if (!HealthKit) {
      console.error('HealthKit module not available');
      return false;
    }

    try {
      const permissions = {
        read: [
          HealthKit.HKQuantityTypeIdentifier.stepCount,
          HealthKit.HKQuantityTypeIdentifier.heartRate,
          HealthKit.HKQuantityTypeIdentifier.restingHeartRate,
          HealthKit.HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
          HealthKit.HKQuantityTypeIdentifier.oxygenSaturation,
          HealthKit.HKQuantityTypeIdentifier.activeEnergyBurned,
          HealthKit.HKQuantityTypeIdentifier.bodyMass,
          HealthKit.HKCategoryTypeIdentifier.sleepAnalysis,
        ],
        write: [] as string[],
      };

      await HealthKit.default.requestAuthorization(permissions.read, permissions.write);
      console.log('HealthKit permissions granted');
      return true;
    } catch (error) {
      console.error('Failed to request HealthKit permissions:', error);
      return false;
    }
  }

  async getSteps(startDate: Date, endDate: Date): Promise<number> {
    if (!HealthKit) {
      console.error('HealthKit not initialized');
      return 0;
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        HealthKit.HKQuantityTypeIdentifier.stepCount,
        { from: startDate, to: endDate }
      );
      return samples.reduce((sum, s) => sum + s.quantity, 0);
    } catch (error) {
      console.error('Failed to get steps:', error);
      return 0;
    }
  }

  async getHeartRate(startDate: Date, endDate: Date): Promise<{ value: number; date: string }[]> {
    if (!HealthKit) {
      console.error('HealthKit not initialized');
      return [];
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        HealthKit.HKQuantityTypeIdentifier.heartRate,
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
    if (!HealthKit) {
      console.error('HealthKit not initialized');
      return null;
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        HealthKit.HKQuantityTypeIdentifier.restingHeartRate,
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
    if (!HealthKit) {
      console.error('HealthKit not initialized');
      return null;
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        HealthKit.HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
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
    if (!HealthKit) {
      console.error('HealthKit not initialized');
      return { totalHours: 0, quality: 0 };
    }

    try {
      const samples = await HealthKit.default.queryCategorySamples(
        HealthKit.HKCategoryTypeIdentifier.sleepAnalysis,
        { from: startDate, to: endDate }
      );

      // Calculate total sleep from samples (asleep categories)
      let totalMs = 0;
      const asleepValues = [
        HealthKit.HKCategoryValueSleepAnalysis.asleepCore,
        HealthKit.HKCategoryValueSleepAnalysis.asleepDeep,
        HealthKit.HKCategoryValueSleepAnalysis.asleepREM,
        HealthKit.HKCategoryValueSleepAnalysis.asleepUnspecified,
      ];

      samples.forEach(sample => {
        if (asleepValues.includes(sample.value as any)) {
          totalMs += sample.endDate.getTime() - sample.startDate.getTime();
        }
      });

      const totalHours = totalMs / (1000 * 60 * 60);

      // Calculate quality based on sleep stages
      const deepSleep = samples.filter(s => s.value === HealthKit!.HKCategoryValueSleepAnalysis.asleepDeep).length;
      const remSleep = samples.filter(s => s.value === HealthKit!.HKCategoryValueSleepAnalysis.asleepREM).length;
      const quality = Math.min(100, 50 + deepSleep * 10 + remSleep * 5);

      return { totalHours: Math.round(totalHours * 10) / 10, quality };
    } catch (error) {
      console.error('Failed to get sleep data:', error);
      return { totalHours: 0, quality: 0 };
    }
  }

  async getActiveCalories(startDate: Date, endDate: Date): Promise<number> {
    if (!HealthKit) {
      console.error('HealthKit not initialized');
      return 0;
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        HealthKit.HKQuantityTypeIdentifier.activeEnergyBurned,
        { from: startDate, to: endDate }
      );
      return Math.round(samples.reduce((sum, s) => sum + s.quantity, 0));
    } catch (error) {
      console.error('Failed to get active calories:', error);
      return 0;
    }
  }

  async getWeight(startDate: Date, endDate: Date): Promise<number | null> {
    if (!HealthKit) {
      console.error('HealthKit not initialized');
      return null;
    }

    try {
      const samples = await HealthKit.default.queryQuantitySamples(
        HealthKit.HKQuantityTypeIdentifier.bodyMass,
        { from: startDate, to: endDate }
      );
      if (samples.length === 0) return null;
      // Return most recent
      return Math.round(samples[samples.length - 1].quantity * 10) / 10;
    } catch (error) {
      console.error('Failed to get weight:', error);
      return null;
    }
  }

  async syncToSupabase(userId: string): Promise<boolean> {
    if (!userId) return false;

    if (!HealthKit) {
      console.error('HealthKit not initialized - cannot sync');
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