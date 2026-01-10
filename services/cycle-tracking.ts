import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

interface CycleEntry {
  date: string; // YYYY-MM-DD
  phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
  flow: 'light' | 'normal' | 'heavy';
  notes?: string;
  timestamp: number;
}

const CYCLE_DATA_KEY = '@health_hub_cycle_data';
const CYCLE_ENABLED_KEY = '@health_hub_cycle_enabled';
const ENCRYPTION_KEY = 'health_hub_cycle_v1'; // Static key for this device

class CycleTrackingService {
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

  private async encrypt(data: string): Promise<string> {
    try {
      console.log('encrypt: Encoding data');
      // WARNING: This is Base64 encoding, NOT encryption. Data is NOT secure.
      // TODO: Implement proper AES-256 encryption with expo-crypto for production
      const encoded = btoa(unescape(encodeURIComponent(data)));
      console.log('encrypt: Data encoded');
      return encoded;
    } catch (error) {
      console.error('Encoding error:', error);
      throw error;
    }
  }

  private async decrypt(encoded: string): Promise<string> {
    try {
      console.log('decrypt: Decoding data');
      // WARNING: This is Base64 decoding, NOT decryption. Data is NOT secure.
      // TODO: Implement proper AES-256 decryption with expo-crypto for production
      const decoded = decodeURIComponent(escape(atob(encoded)));
      console.log('decrypt: Data decoded');
      return decoded;
    } catch (error) {
      console.error('Decoding error:', error);
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