import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, code, userId, redirectUri } = await req.json();
    
    const clientId = Deno.env.get('FITBIT_CLIENT_ID');
    const clientSecret = Deno.env.get('FITBIT_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!clientId || !clientSecret) {
      throw new Error('Fitbit credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const authHeader = btoa(`${clientId}:${clientSecret}`);

    if (action === 'get_client_id') {
      // Return client ID for the OAuth flow (not secret)
      return new Response(
        JSON.stringify({ clientId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'exchange_code') {
      // Exchange authorization code for tokens
      const response = await fetch(FITBIT_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Fitbit token exchange failed: ${error}`);
      }

      const tokens = await response.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Store tokens in database
      const { error: dbError } = await supabase
        .from('integrations')
        .upsert({
          user_id: userId,
          provider: 'fitbit',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          is_connected: true,
          last_sync_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });

      if (dbError) throw dbError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'refresh_token') {
      // Get current refresh token
      const { data: integration, error: fetchError } = await supabase
        .from('integrations')
        .select('refresh_token')
        .eq('user_id', userId)
        .eq('provider', 'fitbit')
        .single();

      if (fetchError || !integration?.refresh_token) {
        throw new Error('No refresh token found');
      }

      // Refresh the token
      const response = await fetch(FITBIT_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokens = await response.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Update tokens
      await supabase
        .from('integrations')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', userId)
        .eq('provider', 'fitbit');

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Fitbit auth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});