import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, question } = await req.json();

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!anthropicKey) {
      throw new Error('Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your secrets.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's health data (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [metricsRes, logsRes, eventsRes] = await Promise.all([
      supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', userId)
        .gte('recorded_at', thirtyDaysAgo)
        .order('recorded_at', { ascending: false }),
      supabase
        .from('manual_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', thirtyDaysAgo)
        .order('logged_at', { ascending: false }),
      supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', thirtyDaysAgo)
        .order('start_time', { ascending: false }),
    ]);

    const healthData = {
      metrics: metricsRes.data || [],
      logs: logsRes.data || [],
      events: eventsRes.data || [],
    };

    // Build prompt for Claude
    const systemPrompt = `You are a health insights AI assistant. Analyze the user's health data and provide actionable insights.

Your responses should be:
- Evidence-based and cite specific data points from their logs
- Actionable with clear recommendations
- Empathetic and encouraging
- NOT medical advice - always recommend consulting healthcare providers for medical decisions

When generating insights, categorize them as:
- correlation: patterns between two or more health metrics (e.g., "coffee after 2pm correlates with poor sleep")
- prediction: forecasts based on current trends and calendar events (e.g., "early shift tomorrow means you should sleep early")
- recommendation: actionable tips to improve health based on patterns

Pay special attention to:
- Calendar events that might affect sleep schedules (early shifts, late meetings)
- Correlations between logged symptoms and other factors (caffeine, sleep, activity)
- Day-of-week patterns in stress, energy, or symptoms`;

    const dataPrompt = `Here is the user's health data from the last 30 days:

HEALTH METRICS (steps, sleep, heart rate, etc):
${JSON.stringify(healthData.metrics.slice(0, 100), null, 2)}

MANUAL LOGS (symptoms, caffeine, bristol scale, custom entries):
${JSON.stringify(healthData.logs.slice(0, 50), null, 2)}

CALENDAR EVENTS (work shifts, appointments, etc):
${JSON.stringify(healthData.events.slice(0, 50), null, 2)}`;

    let userPrompt: string;

    if (question) {
      userPrompt = `${dataPrompt}

User's question: ${question}

Please provide a helpful, data-driven answer based on their logged health data.`;
    } else {
      userPrompt = `${dataPrompt}

Based on this data, generate 3-5 personalized health insights. For each insight provide a JSON object with:
- type: "correlation", "prediction", or "recommendation"
- title: short, catchy title (under 40 chars)
- description: 1-2 sentence explanation citing specific data
- confidence: number between 0.6 and 0.95 based on data strength
- relatedMetrics: array of metric/log types involved

If there's limited data, still provide helpful general insights but with lower confidence scores.

Respond ONLY with a valid JSON array of insights, no other text.`;
    }

    // Call Anthropic Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Claude API error: ${errorText}`);
    }

    const claudeData = await claudeResponse.json();
    const content = claudeData.content?.[0]?.text || '';

    if (question) {
      return new Response(
        JSON.stringify({ answer: content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse insights from response
    let insights = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse insights:', parseError);
      // Generate fallback insights if parsing fails
      insights = [
        {
          type: 'recommendation',
          title: 'Start logging more data',
          description: 'Log symptoms, caffeine intake, and sleep to get personalized AI insights.',
          confidence: 0.9,
          relatedMetrics: ['manual_logs'],
        }
      ];
    }

    // Save insights to database
    if (insights.length > 0) {
      const insightRecords = insights.map((insight: any) => ({
        user_id: userId,
        insight_type: insight.type,
        title: insight.title,
        description: insight.description,
        confidence: insight.confidence,
        related_metrics: insight.relatedMetrics || [],
      }));

      await supabase.from('ai_insights').insert(insightRecords);
    }

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});