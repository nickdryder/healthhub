import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

/**
 * PRIVACY & SECURITY NOTES:
 *
 * This service implements AES-256 encryption for menstrual cycle data to protect
 * against unauthorized access, including government subpoenas of device data.
 *
 * - Encryption key is stored in device secure storage (hardware-backed on iOS)
 * - Data is encrypted with AES-256-CBC before storage
 * - Cycle data is NEVER synced to cloud servers (Supabase or any backend)
 * - Data remains on-device only and is protected by device encryption + app encryption
 *
 * In case of device seizure:
 * - Data is encrypted and unreadable without the encryption key
 * - Encryption key is in device secure enclave (requires device unlock)
 * - No cloud backup means no server to subpoena
 */

interface CycleEntry {
  date: string; // YYYY-MM-DD
  phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
  flow: 'light' | 'normal' | 'heavy';
  notes?: string;
  timestamp: number;
}

const CYCLE_DATA_KEY = '@health_hub_cycle_data';
const CYCLE_ENABLED_KEY = '@health_hub_cycle_enabled';
const ENCRYPTION_KEY_STORAGE = 'cycle_encryption_key_v1';

class CycleTrackingService {
  /**
   * Gets or creates a secure encryption key for cycle data.
   * Key is stored in device secure storage (Keychain on iOS, KeyStore on Android).
   */
  private async getEncryptionKey(): Promise<string> {
    try {
      // Try to get existing key from secure storage
      let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);

      if (!key) {
        // Generate a new random 256-bit key
        const randomBytes = await Crypto.getRandomBytesAsync(32);
        key = Array.from(randomBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Store in secure storage (hardware-backed on iOS)
        await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE, key);
        console.log('Generated and stored new encryption key in secure storage');
      }

      return key;
    } catch (error) {
      console.error('Error managing encryption key:', error);
      throw new Error('Failed to initialize secure encryption');
    }
  }

  async enableCycleTracking(): Promise<void> {
    console.log('enableCycleTracking: Enabling cycle tracking');
    await AsyncStorage.setItem(CYCLE_ENABLED_KEY, 'true');
  }

  async disableCycleTracking(): Promise<void> {
    console.log('disableCycleTracking: Disabling cycle tracking');
    await AsyncStorage.setItem(CYCLE_ENABLED_KEY, 'false');
  }

  async isCycleTrackingEnabled(): Promise<boolean> {
    const enabled = await AsyncStorage.getItem(CYCLE_ENABLED_KEY);
    console.log('isCycleTrackingEnabled:', enabled === 'true');
    return enabled === 'true';
  }


  // Predict cycle phases based on menstruation dates
  private fillInPredictedPhases(menstruationEntries: CycleEntry[]): CycleEntry[] {
    const allEntries = [...menstruationEntries];
    
    if (menstruationEntries.length === 0) {
      return allEntries;
    }

    // Calculate average cycle length (default to 28 days if not enough data)
    let avgCycleLength = 28;
    if (menstruationEntries.length >= 2) {
      const sortedDates = menstruationEntries
        .map(e => new Date(e.date).getTime())
        .sort((a, b) => a - b);
      
      let totalDays = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        totalDays += (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
      }
      avgCycleLength = Math.round(totalDays / (sortedDates.length - 1));
    }

    console.log('📊 Calculated avg cycle length:', avgCycleLength);

    // Get the last menstruation date
    const lastMenstruationDate = new Date(
      Math.max(...menstruationEntries.map(e => new Date(e.date).getTime()))
    );

    // Predict next days from last menstruation (35 days max for longer cycles)
    const today = new Date();
    const maxDaysToPredict = 35;
    
    for (let i = 0; i < maxDaysToPredict; i++) {
      const currentDate = new Date(lastMenstruationDate.getTime() + i * 24 * 60 * 60 * 1000);
      
      // Clamp to valid date range (not too far in past or future)
      const daysFromNow = (currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      if (daysFromNow > 35 || daysFromNow < -90) {
        continue;
      }
      
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Skip if this date already has a logged entry
      if (allEntries.some(e => e.date === dateStr)) {
        continue;
      }

      // Predict phase based on position in cycle
      const dayInCycle = i % avgCycleLength;
      let phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
      
      if (dayInCycle < 5) {
        phase = 'menstruation';
      } else if (dayInCycle < 14) {
        phase = 'follicular';
      } else if (dayInCycle < 16) {
        phase = 'ovulation';
      } else {
        phase = 'luteal';
      }

      allEntries.push({
        date: dateStr,
        phase,
        timestamp: Date.now(),
      });
    }

    return allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Encrypts data using AES-256-CBC with a securely stored key.
   * This provides strong encryption to protect sensitive cycle data.
   */
  private async encrypt(data: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const encrypted = CryptoJS.AES.encrypt(data, key).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypts AES-256 encrypted data using the securely stored key.
   */
  private async decrypt(encrypted: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const decrypted = CryptoJS.AES.decrypt(encrypted, key);
      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

      if (!plaintext) {
        throw new Error('Decryption failed - invalid key or corrupted data');
      }

      return plaintext;
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  async addCycleEntry(entry: Omit<CycleEntry, 'timestamp'>): Promise<void> {
    try {
      console.log('addCycleEntry: Adding new cycle entry', entry);
      const enabled = await this.isCycleTrackingEnabled();
      if (!enabled) {
        throw new Error('Cycle tracking is disabled');
      }

      const entries = await this.getCycleEntries();
      const newEntry: CycleEntry = {
        ...entry,
        timestamp: Date.now(),
      };

      entries.push(newEntry);
      const json = JSON.stringify(entries);
      const encrypted = await this.encrypt(json);
      await AsyncStorage.setItem(CYCLE_DATA_KEY, encrypted);
      console.log('addCycleEntry: Entry added successfully');
    } catch (error) {
      console.error('Error adding cycle entry:', error);
      throw error;
    }
  }

  async getCycleEntries(): Promise<CycleEntry[]> {
    try {
      const encrypted = await AsyncStorage.getItem(CYCLE_DATA_KEY);
      console.log('🔍 getCycleEntries: Found encrypted data?', !!encrypted);

      if (!encrypted) {
        console.log('❌ getCycleEntries: No encrypted data found');
        return [];
      }

      const json = await this.decrypt(encrypted);
      const entries = JSON.parse(json);
      console.log('✨ getCycleEntries: Parsed', entries.length, 'entries');
      return entries;
    } catch (error) {
      console.error('Error reading cycle entries:', error);
      return [];
    }
  }

  async deleteCycleEntry(date: string): Promise<void> {
    try {
      console.log('deleteCycleEntry: Deleting entry for date', date);
      const entries = await this.getCycleEntries();
      const filtered = entries.filter(e => e.date !== date);
      const json = JSON.stringify(filtered);
      const encrypted = await this.encrypt(json);
      await AsyncStorage.setItem(CYCLE_DATA_KEY, encrypted);
      console.log('deleteCycleEntry: Entry deleted successfully');
    } catch (error) {
      console.error('Error deleting cycle entry:', error);
      throw error;
    }
  }

  async updateCycleEntry(date: string, updates: Partial<Omit<CycleEntry, 'date' | 'timestamp'>>): Promise<void> {
    try {
      console.log('updateCycleEntry: Updating entry for date', date, 'with updates', updates);
      const entries = await this.getCycleEntries();
      const entry = entries.find(e => e.date === date);
      if (!entry) throw new Error('Entry not found');

      Object.assign(entry, updates);
      const json = JSON.stringify(entries);
      const encrypted = await this.encrypt(json);
      await AsyncStorage.setItem(CYCLE_DATA_KEY, encrypted);
      console.log('updateCycleEntry: Entry updated successfully');
    } catch (error) {
      console.error('Error updating cycle entry:', error);
      throw error;
    }
  }

  async getCycleEntriesForDateRange(startDate: string, endDate: string): Promise<CycleEntry[]> {
    try {
      console.log('getCycleEntriesForDateRange: Fetching entries from', startDate, 'to', endDate);
      const entries = await this.getCycleEntries();
      const filtered = entries.filter(e => e.date >= startDate && e.date <= endDate);
      console.log(`getCycleEntriesForDateRange: Found ${filtered.length} entries`);
      return filtered;
    } catch (error) {
      console.error('Error fetching date range:', error);
      return [];
    }
  }

  async getCurrentPhase(): Promise<CycleEntry | null> {
    try {
      console.log('getCurrentPhase: Getting current phase');
      const entries = await this.getCycleEntries();
      if (entries.length === 0) {
        console.log('getCurrentPhase: No entries found');
        return null;
      }

      const today = new Date().toISOString().split('T')[0];
      const current = entries.find(e => e.date === today) || null;
      console.log('getCurrentPhase: Current phase entry', current);
      return current;
    } catch (error) {
      console.error('Error getting current phase:', error);
      return null;
    }
  }

  async clearAllCycleData(): Promise<void> {
    try {
      console.log('clearAllCycleData: Clearing all cycle data');
      await AsyncStorage.removeItem(CYCLE_DATA_KEY);
      await this.disableCycleTracking();
      console.log('clearAllCycleData: All data cleared and tracking disabled');
    } catch (error) {
      console.error('Error clearing cycle data:', error);
      throw error;
    }
  }

  // Export cycle data for user backup
  async exportCycleData(): Promise<string> {
    try {
      console.log('exportCycleData: Exporting cycle data');
      const entries = await this.getCycleEntries();
      const exported = JSON.stringify(entries, null, 2);
      console.log('exportCycleData: Export successful');
      return exported;
    } catch (error) {
      console.error('Error exporting cycle data:', error);
      throw error;
    }
  }
}

export const cycleTracking = new CycleTrackingService();
export type { CycleEntry };