import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/integrations/supabase/client';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

/**
 * Google Calendar Integration Service
 * 
 * Setup:
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create OAuth 2.0 credentials (Web application)
 * 3. Add redirect URI: https://pxphayzjpfymnunxskan.supabase.co/functions/v1/google-calendar-callback
 * 4. Enable Google Calendar API
 * 5. Store GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as secrets
 */

class GoogleCalendarService {
  private getRedirectUri(): string {
    return 'https://pxphayzjpfymnunxskan.supabase.co/functions/v1/google-calendar-callback';
  }

  async startAuth(clientId: string): Promise<string | null> {
    const redirectUri = this.getRedirectUri();
    const appScheme = 'healthhub://google-calendar-callback';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId.trim(),
      redirect_uri: redirectUri,
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    });
    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    console.log('Google Calendar auth URL:', authUrl);

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, appScheme);
      console.log('Google auth result:', result);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        return url.searchParams.get('code');
      }

      return null;
    } catch (error) {
      console.error('Google Calendar auth error:', error);
      return null;
    }
  }

  async exchangeCodeForTokens(code: string, userId: string): Promise<boolean> {
    try {
      const redirectUri = this.getRedirectUri();
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'exchange_code', code, userId, redirectUri },
      });
      if (error) throw error;
      return data?.success === true;
    } catch (error) {
      console.error('Google token exchange failed:', error);
      return false;
    }
  }

  async syncEvents(userId: string, daysBack: number = 30, daysForward: number = 14): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { userId, daysBack, daysForward },
      });
      if (error) throw error;
      console.log(`Google Calendar sync complete: ${data?.eventsCount || 0} events`);
      return data?.success === true;
    } catch (error) {
      console.error('Google Calendar sync failed:', error);
      return false;
    }
  }

  async isConnected(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('is_connected, token_expires_at')
        .eq('user_id', userId)
        .eq('provider', 'google_calendar')
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

  async refreshTokens(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'refresh_token', userId },
      });
      if (error) throw error;
      return data?.success === true;
    } catch (error) {
      console.error('Google token refresh failed:', error);
      return false;
    }
  }

  async disconnect(userId: string): Promise<boolean> {
    try {
      const { error } = await (supabase.from('integrations') as any)
        .update({ is_connected: false, access_token: null, refresh_token: null })
        .eq('user_id', userId)
        .eq('provider', 'google_calendar');
      return !error;
    } catch {
      return false;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();