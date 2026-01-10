import { useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { healthKitService, isHealthKitAvailable } from '@/services/healthkit';
import { fitbitService } from '@/services/fitbit';
import { googleCalendarService } from '@/services/google-calendar';
import { aiInsightsService } from '@/services/ai-insights';
import { supabase } from '@/integrations/supabase/client';
import { localAnalysis } from '@/services/local-analysis';
import { getUserLocation, syncWeatherData } from '@/services/weather';

export type IntegrationProvider = 'apple_health' | 'fitbit' | 'google_calendar' | 'yazio';

export interface IntegrationStatus {
  provider: IntegrationProvider;
  isConnected: boolean;
  lastSync: string | null;
  isLoading: boolean;
}

export function useHealthIntegrations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const getIntegrationStatus = useCallback(async (provider: IntegrationProvider): Promise<IntegrationStatus> => {
    if (!user) {
      return { provider, isConnected: false, lastSync: null, isLoading: false };
    }

    try {
      const { data } = await supabase
        .from('integrations')
        .select('is_connected, last_sync_at')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .single();

      const record = data as { is_connected?: boolean; last_sync_at?: string } | null;
      return {
        provider,
        isConnected: record?.is_connected || false,
        lastSync: record?.last_sync_at || null,
        isLoading: false,
      };
    } catch {
      return { provider, isConnected: false, lastSync: null, isLoading: false };
    }
  }, [user]);

  const connectAppleHealth = useCallback(async (): Promise<boolean> => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to connect Apple Health.');
      return false;
    }

    if (!isHealthKitAvailable) {
      Alert.alert(
        'Not Available',
        'Apple Health is only available on iOS devices.'
      );
      return false;
    }

    setLoading(prev => ({ ...prev, apple_health: true }));

    try {
      const initialized = await healthKitService.initialize();
      if (!initialized) throw new Error('Failed to initialize HealthKit');

      const hasPermission = await healthKitService.requestPermissions();
      if (!hasPermission) throw new Error('Permission denied');

      const synced = await healthKitService.syncToSupabase(user.id);
      if (!synced) throw new Error('Failed to sync data');

      Alert.alert('Connected!', 'Apple Health is now connected and syncing.');
      return true;
    } catch (error: any) {
      Alert.alert('Connection Failed', error.message || 'Could not connect to Apple Health.');
      return false;
    } finally {
      setLoading(prev => ({ ...prev, apple_health: false }));
    }
  }, [user]);

  const connectFitbit = useCallback(async (): Promise<boolean> => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to connect Fitbit.');
      return false;
    }

    setLoading(prev => ({ ...prev, fitbit: true }));

    try {
      // First, get the client ID from Edge Function
      const { data: configData, error: configError } = await supabase.functions.invoke('fitbit-auth', {
        body: { action: 'get_client_id' },
      });

      if (configError || !configData?.clientId) {
        Alert.alert(
          'Fitbit Setup Required',
          'Fitbit credentials not configured. Please add FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET to your project secrets.',
          [{ text: 'OK' }]
        );
        return false;
      }

      const clientId = configData.clientId;
      const code = await fitbitService.startAuth(clientId);
      if (!code) throw new Error('Authorization cancelled');

      const success = await fitbitService.exchangeCodeForTokens(code, user.id);
      if (!success) throw new Error('Token exchange failed');

      await fitbitService.syncData(user.id);
      Alert.alert('Connected!', 'Fitbit is now connected and syncing.');
      return true;
    } catch (error: any) {
      console.error('Fitbit connection error:', error);
      Alert.alert('Connection Failed', error.message || 'Could not connect to Fitbit.');
      return false;
    } finally {
      setLoading(prev => ({ ...prev, fitbit: false }));
    }
  }, [user]);

  const connectGoogleCalendar = useCallback(async (): Promise<boolean> => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to connect Google Calendar.');
      return false;
    }

    setLoading(prev => ({ ...prev, google_calendar: true }));

    try {
      // Get Google Client ID from Edge Function
      const { data: configData, error: configError } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'get_client_id' },
      });

      if (configError || !configData?.clientId) {
        Alert.alert(
          'Google Calendar Setup Required',
          'Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your project secrets.',
          [{ text: 'OK' }]
        );
        return false;
      }

      const clientId = configData.clientId;
      const code = await googleCalendarService.startAuth(clientId);
      if (!code) throw new Error('Authorization cancelled');

      const success = await googleCalendarService.exchangeCodeForTokens(code, user.id);
      if (!success) throw new Error('Token exchange failed');

      // Sync events after connecting
      await googleCalendarService.syncEvents(user.id);

      Alert.alert(
        'Google Calendar Connected',
        'Your calendar events are now syncing. The AI will analyze them for health insights like sleep recommendations before early shifts.',
        [{ text: 'Great!' }]
      );
      return true;
    } catch (error: any) {
      console.error('Google Calendar connection error:', error);
      Alert.alert('Connection Failed', error.message || 'Could not connect Google Calendar.');
      return false;
    } finally {
      setLoading(prev => ({ ...prev, google_calendar: false }));
    }
  }, [user]);

  const disconnectIntegration = useCallback(async (provider: IntegrationProvider): Promise<boolean> => {
    if (!user) return false;

    try {
      if (provider === 'fitbit') {
        return await fitbitService.disconnect(user.id);
      }

      // Use type bypass for strict Supabase typing
      const { error } = await (supabase.from('integrations') as any)
        .update({ is_connected: false })
        .eq('user_id', user.id)
        .eq('provider', provider);

      return !error;
    } catch {
      return false;
    }
  }, [user]);

  const syncIntegration = useCallback(async (provider: IntegrationProvider): Promise<boolean> => {
    if (!user) return false;

    setLoading(prev => ({ ...prev, [provider]: true }));

    try {
      switch (provider) {
        case 'apple_health':
          return await healthKitService.syncToSupabase(user.id);
        case 'fitbit':
          return await fitbitService.syncData(user.id);
        case 'google_calendar':
          return await googleCalendarService.syncEvents(user.id);
        default:
          return false;
      }
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }));
    }
  }, [user]);

  const refreshInsights = useCallback(async (): Promise<boolean> => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to generate insights.');
      return false;
    }

    setLoading(prev => ({ ...prev, insights: true }));

    try {
      // Sync weather data if user has location set
      const location = await getUserLocation(user.id);
      if (location && location.lat && location.lon) {
        console.log('Syncing weather data for analysis...');
        await syncWeatherData(user.id, location.lat, location.lon);
      }

      // Run local analysis
      console.log('Running local analysis...');
      const insights = await localAnalysis.analyzeHealthData(user.id);
      console.log(`Generated ${insights.length} insights`);

      // Save to database
      if (insights.length > 0) {
        await localAnalysis.saveInsights(user.id, insights);
      }

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['weather-data'] });

      if (insights.length > 0) {
        Alert.alert('Insights Updated', `Generated ${insights.length} new insights based on your data.`);
        return true;
      } else {
        Alert.alert('No New Insights', 'Log more data to generate personalized insights.');
        return false;
      }
    } catch (error: any) {
      Alert.alert('Analysis Failed', error.message || 'Could not generate insights.');
      return false;
    } finally {
      setLoading(prev => ({ ...prev, insights: false }));
    }
  }, [user, queryClient]);

  // Silent background sync (no popups) - used on app startup
  const syncAllIntegrationsSilent = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // Get all connected integrations
      const { data: integrations } = await supabase
        .from('integrations')
        .select('provider, is_connected')
        .eq('user_id', user.id)
        .eq('is_connected', true);

      const connected = (integrations || []) as { provider: string; is_connected: boolean }[];
      if (connected.length === 0) {
        console.log('[Background Sync] No connected sources');
        return false;
      }

      let syncedCount = 0;
      for (const integration of connected) {
        try {
          const provider = integration.provider as IntegrationProvider;
          const success = await syncIntegration(provider);
          if (success) syncedCount++;
        } catch (e: any) {
          console.log(`[Background Sync] Error syncing ${integration.provider}:`, e.message);
        }
      }

      // Refresh metrics after sync
      queryClient.invalidateQueries({ queryKey: ['health-metrics'] });
      
      if (syncedCount > 0) {
        console.log(`[Background Sync] Successfully synced ${syncedCount} source(s)`);
        return true;
      }
      return false;
    } catch (error: any) {
      console.log('[Background Sync] Error:', error.message);
      return false;
    }
  }, [user, queryClient, syncIntegration]);

  // User-triggered sync (shows alerts)
  const syncAllIntegrations = useCallback(async (): Promise<boolean> => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to sync data.');
      return false;
    }

    setLoading(prev => ({ ...prev, sync_all: true }));

    try {
      // Get all connected integrations
      const { data: integrations } = await supabase
        .from('integrations')
        .select('provider, is_connected')
        .eq('user_id', user.id)
        .eq('is_connected', true);

      const connected = (integrations || []) as { provider: string; is_connected: boolean }[];
      if (connected.length === 0) {
        Alert.alert('No Connected Sources', 'Connect a health source in Settings first.');
        return false;
      }

      let syncedCount = 0;
      const syncedSources: string[] = [];
      const errors: string[] = [];

      for (const integration of connected) {
        try {
          const provider = integration.provider as IntegrationProvider;
          const success = await syncIntegration(provider);
          if (success) {
            syncedCount++;
            // Format provider name for display
            const displayName = provider === 'apple_health' ? 'Apple Health' 
              : provider === 'google_calendar' ? 'Google Calendar'
              : provider.charAt(0).toUpperCase() + provider.slice(1);
            syncedSources.push(displayName);
          }
        } catch (e: any) {
          errors.push(integration.provider);
        }
      }

      // Refresh metrics after sync
      queryClient.invalidateQueries({ queryKey: ['health-metrics'] });

      if (syncedCount > 0) {
        let message = '';
        if (syncedCount === 1) {
          message = `Successfully synced ${syncedSources[0]}.`;
        } else {
          message = `Successfully synced:\n${syncedSources.map(s => `• ${s}`).join('\n')}`;
        }
        if (errors.length > 0) {
          message += `\n\nFailed: ${errors.join(', ')}`;
        }
        Alert.alert('Sync Complete', message);
        return true;
      } else {
        Alert.alert('Sync Failed', 'Could not sync any connected sources. Try reconnecting.');
        return false;
      }
    } catch (error: any) {
      Alert.alert('Sync Error', error.message || 'Could not sync data sources.');
      return false;
    } finally {
      setLoading(prev => ({ ...prev, sync_all: false }));
    }
  }, [user, queryClient, syncIntegration]);

  return {
    loading,
    getIntegrationStatus,
    connectAppleHealth,
    connectFitbit,
    connectGoogleCalendar,
    disconnectIntegration,
    syncIntegration,
    syncAllIntegrations,
    syncAllIntegrationsSilent,
    refreshInsights,
  };
}