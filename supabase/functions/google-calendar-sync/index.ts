import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, daysBack = 30, daysForward = 14 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get access token
    const { data: integration, error: fetchError } = await supabase
      .from('integrations')
      .select('access_token, token_expires_at')
      .eq('user_id', userId)
      .eq('provider', 'google_calendar')
      .single();

    if (fetchError || !integration?.access_token) {
      return new Response(
        JSON.stringify({ error: 'Not connected to Google Calendar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (new Date(integration.token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Token expired, please reconnect' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate time range
    const timeMin = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + daysForward * 24 * 60 * 60 * 1000).toISOString();

    // Fetch events from Google Calendar
    const eventsUrl = `${GOOGLE_CALENDAR_API}/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=250`;

    const eventsResponse = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${integration.access_token}` },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('Google Calendar API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventsData = await eventsResponse.json();
    const rawEvents = eventsData.items || [];

    // Filter out auto-generated events (e.g., from scheduling programs)
    const events = rawEvents.filter((event: any) => {
      const title = event.summary || '';
      // Exclude events starting with [auto]
      if (title.toLowerCase().startsWith('[auto]')) {
        console.log(`Filtering out auto event: ${title}`);
        return false;
      }
      return true;
    });

    console.log(`Filtered ${rawEvents.length - events.length} auto events, keeping ${events.length}`);

    // Delete old events for this user in the time range
    await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .gte('start_time', timeMin)
      .lte('start_time', timeMax);

    // Insert new events
    const calendarEvents = events.map((event: any) => {
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      
      // Categorize event type based on title keywords
      let eventType = 'other';
      const title = (event.summary || '').toLowerCase();
      if (title.includes('shift') || title.includes('work') || title.includes('meeting')) {
        eventType = 'work';
      } else if (title.includes('gym') || title.includes('workout') || title.includes('exercise')) {
        eventType = 'exercise';
      } else if (title.includes('doctor') || title.includes('appointment') || title.includes('dentist')) {
        eventType = 'health';
      } else if (title.includes('birthday') || title.includes('party') || title.includes('dinner')) {
        eventType = 'social';
      }

      return {
        user_id: userId,
        google_event_id: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || null,
        start_time: startTime,
        end_time: endTime,
        event_type: eventType,
        is_all_day: !event.start?.dateTime,
        location: event.location || null,
      };
    });

    if (calendarEvents.length > 0) {
      const { error: insertError } = await supabase
        .from('calendar_events')
        .insert(calendarEvents);

      if (insertError) {
        console.error('Failed to insert events:', insertError);
      }
    }

    // Update last sync time
    await supabase
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', 'google_calendar');

    return new Response(
      JSON.stringify({ success: true, eventsCount: calendarEvents.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});