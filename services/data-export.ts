import { supabase } from '@/integrations/supabase/client';
import * as Clipboard from 'expo-clipboard';
import { Alert, Share, Platform } from 'react-native';

export interface ExportData {
  healthMetrics: any[];
  manualLogs: any[];
  foodEntries: any[];
  medicationLogs: any[];
}

class DataExportService {
  async fetchAllData(userId: string): Promise<ExportData> {
    const [metricsRes, logsRes, foodRes, medRes] = await Promise.all([
      supabase.from('health_metrics').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }),
      supabase.from('manual_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      supabase.from('food_entries').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      supabase.from('medication_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
    ]);

    return {
      healthMetrics: metricsRes.data || [],
      manualLogs: logsRes.data || [],
      foodEntries: foodRes.data || [],
      medicationLogs: medRes.data || [],
    };
  }

  convertToCSV(data: any[], columns: string[]): string {
    if (data.length === 0) return '';
    
    const header = columns.join(',');
    const rows = data.map(row => 
      columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [header, ...rows].join('\n');
  }

  async exportHealthMetrics(userId: string): Promise<string> {
    const { data } = await supabase
      .from('health_metrics')
      .select('metric_type, value, unit, source, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false });

    return this.convertToCSV(data || [], ['recorded_at', 'metric_type', 'value', 'unit', 'source']);
  }

  async exportManualLogs(userId: string): Promise<string> {
    const { data } = await supabase
      .from('manual_logs')
      .select('log_type, value, severity, notes, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false });

    return this.convertToCSV(data || [], ['logged_at', 'log_type', 'value', 'severity', 'notes']);
  }

  async exportMedicationLogs(userId: string): Promise<string> {
    const { data } = await supabase
      .from('medication_logs')
      .select('logged_at, took_medication, notes')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false });

    return this.convertToCSV(data || [], ['logged_at', 'took_medication', 'notes']);
  }

  async exportAllAsCSV(userId: string): Promise<string> {
    const [metrics, logs, meds] = await Promise.all([
      this.exportHealthMetrics(userId),
      this.exportManualLogs(userId),
      this.exportMedicationLogs(userId),
    ]);

    const sections = [];
    
    if (metrics) {
      sections.push('=== HEALTH METRICS ===\n' + metrics);
    }
    if (logs) {
      sections.push('=== MANUAL LOGS ===\n' + logs);
    }
    if (meds) {
      sections.push('=== MEDICATION LOGS ===\n' + meds);
    }

    return sections.join('\n\n');
  }

  async shareExport(userId: string): Promise<void> {
    try {
      const csvData = await this.exportAllAsCSV(userId);
      
      if (!csvData) {
        Alert.alert('No Data', 'You have no health data to export yet.');
        return;
      }

      if (Platform.OS === 'web') {
        // On web, copy to clipboard
        await Clipboard.setStringAsync(csvData);
        Alert.alert('Copied!', 'Your health data has been copied to clipboard as CSV.');
      } else {
        // On mobile, use share sheet
        await Share.share({
          message: csvData,
          title: 'Health Data Export',
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Export Failed', 'Could not export your health data. Please try again.');
    }
  }
}

export const dataExportService = new DataExportService();
