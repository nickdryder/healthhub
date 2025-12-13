import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/integrations/supabase/client';

// Ensure WebBrowser sessions complete properly
WebBrowser.maybeCompleteAuthSession();

const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_SCOPES = [
  'activity',
  'heartrate', 
  'sleep',
  'weight',
  'profile',
  'nutrition',
].join('%20');

export interface FitbitTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Fitbit Integration Service
 * 
 * Setup:
 * 1. Register app at https://dev.fitbit.com/apps
 * 2. Set redirect URL to: https://auth.expo.io/@your-username/your-app-slug
 * 3. Store FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET as secrets
 * 4. Deploy fitbit-auth Edge Function
 */

class FitbitService {
  private getRedirectUri(): string {
    // Use our Supabase Edge Function as the HTTPS redirect
    // This then redirects to the app via custom URL scheme
    return 'https://pxphayzjpfymnunxskan.supabase.co/functions/v1/fitbit-callback';
  }

  async startAuth(clientId: string): Promise<string | null> {
    const redirectUri = this.getRedirectUri();
    // The app listens for this scheme - Edge Function redirects here
    const appScheme = 'healthhub://fitbit-callback';
    const authUrl = `${FITBIT_AUTH_URL}?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${FITBIT_SCOPES}&` +
      `expires_in=604800`;

    console.log('Fitbit auth URL:', authUrl);
    console.log('Redirect URI:', redirectUri);
    console.log('App scheme:', appScheme);

    try {
      // Listen for the app scheme, not the Edge Function URL
      const result = await WebBrowser.openAuthSessionAsync(authUrl, appScheme);
      console.log('Auth result:', result);
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        return url.searchParams.get('code');
      }
      return null;
    } catch (error) {
      console.error('Fitbit auth error:', error);
      return null;
    }
  }

  async exchangeCodeForTokens(code: string, userId: string): Promise<boolean> {
    try {
      const redirectUri = this.getRedirectUri();
      const { data, error } = await supabase.functions.invoke('fitbit-auth', {
        body: { action: 'exchange_code', code, userId, redirectUri },
      });
      if (error) throw error;
      return data?.success === true;
    } catch (error) {
      console.error('Token exchange failed:', error);
      return false;
    }
  }

  async refreshTokens(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('fitbit-auth', {
        body: { action: 'refresh_token', userId },
      });
      if (error) throw error;
      return data?.success === true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  async syncData(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('fitbit-sync', {
        body: { userId },
      });
      if (error) throw error;
      console.log(`Fitbit sync complete: ${data?.metricsCount || 0} metrics`);
      return data?.success === true;
    } catch (error) {
      console.error('Fitbit sync failed:', error);
      return false;
    }
  }

  async isConnected(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('is_connected, token_expires_at')
        .eq('user_id', userId)
        .eq('provider', 'fitbit')
        .single();

      if (error || !data) return false;

      const record = data as { is_connected?: boolean; token_expires_at?: string } | null;
      if (record?.token_expires_at && new Date(record.token_expires_at) < new Date()) {
        return await this.refreshTokens(userId);
      }
      return record?.is_connected || false;
    } catch {
      return false;
    }
  }

  async disconnect(userId: string): Promise<boolean> {
    try {
      // Use type bypass for strict Supabase typing
      const { error } = await (supabase.from('integrations') as any)
        .update({ is_connected: false, access_token: null, refresh_token: null })
        .eq('user_id', userId)
        .eq('provider', 'fitbit');
      return !error;
    } catch {
      return false;
    }
  }
}

export const fitbitService = new FitbitService();