import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FITBIT_API = 'https://api.fitbit.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get access token
    const { data: integration, error: fetchError } = await supabase
      .from('integrations')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'fitbit')
      .single();

    if (fetchError || !integration?.access_token) {
      throw new Error('Fitbit not connected');
    }

    const token = integration.access_token;
    const today = new Date().toISOString().split('T')[0];
    const headers = { 'Authorization': `Bearer ${token}` };

    // Fetch data from Fitbit API
    const [activityRes, sleepRes, heartRes, foodRes] = await Promise.all([
      fetch(`${FITBIT_API}/1/user/-/activities/date/${today}.json`, { headers }),
      fetch(`${FITBIT_API}/1.2/user/-/sleep/date/${today}.json`, { headers }),
      fetch(`${FITBIT_API}/1/user/-/activities/heart/date/${today}/1d.json`, { headers }),
      fetch(`${FITBIT_API}/1/user/-/foods/log/date/${today}.json`, { headers }),
    ]);

    const metrics = [];
    const now = new Date().toISOString();

    // Process activity data
    if (activityRes.ok) {
      const activity = await activityRes.json();
      if (activity.summary) {
        metrics.push({
          user_id: userId,
          metric_type: 'steps',
          value: activity.summary.steps || 0,
          unit: 'steps',
          source: 'fitbit',
          recorded_at: now,
        });
        metrics.push({
          user_id: userId,
          metric_type: 'calories_burned',
          value: activity.summary.caloriesOut || 0,
          unit: 'kcal',
          source: 'fitbit',
          recorded_at: now,
        });
      }
    }

    // Process sleep data
    if (sleepRes.ok) {
      const sleep = await sleepRes.json();
      console.log('Fitbit sleep response:', JSON.stringify(sleep, null, 2));
      if (sleep.summary?.totalMinutesAsleep) {
        // Use the actual sleep end time from the main sleep record, or fallback to today
        const mainSleep = sleep.sleep?.find((s: any) => s.isMainSleep) || sleep.sleep?.[0];
        const sleepEndTime = mainSleep?.endTime || now;
        metrics.push({
          user_id: userId,
          metric_type: 'sleep',
          value: Math.round(sleep.summary.totalMinutesAsleep / 60 * 10) / 10,
          unit: 'hours',
          source: 'fitbit',
          recorded_at: sleepEndTime,
          metadata: { 
            efficiency: sleep.summary.efficiency,
            date: today,
          },
        });
      }
    }

    // Process heart rate data
    if (heartRes.ok) {
      const heart = await heartRes.json();
      const heartData = heart['activities-heart']?.[0]?.value;
      if (heartData?.restingHeartRate) {
        metrics.push({
          user_id: userId,
          metric_type: 'resting_heart_rate',
          value: heartData.restingHeartRate,
          unit: 'bpm',
          source: 'fitbit',
          recorded_at: now,
        });
      }
    }

    // Process food/calorie intake data
    if (foodRes.ok) {
      const food = await foodRes.json();
      console.log('Fitbit food response:', JSON.stringify(food, null, 2));
      // Summary totals are in food.summary
      if (food.summary) {
        const summary = food.summary;
        metrics.push({
          user_id: userId,
          metric_type: 'calories_consumed',
          value: summary.calories || 0,
          unit: 'kcal',
          source: 'fitbit',
          recorded_at: now,
          metadata: {
            carbs: summary.carbs || 0,
            fat: summary.fat || 0,
            protein: summary.protein || 0,
            fiber: summary.fiber || 0,
            sodium: summary.sodium || 0,
            water: summary.water || 0,
          },
        });
      }

      // Process individual food entries for ingredient tracking
      const foodEntries: any[] = [];
      const foods = food.foods || [];
      // Common dairy keywords for lactose detection (English + German)
      const dairyKeywords = ['milk', 'milch', 'cheese', 'käse', 'yogurt', 'joghurt', 'cream', 'sahne', 'butter', 'ice cream', 'eis', 'latte', 'cappuccino', 'whey', 'casein', 'lactose', 'laktose', 'dairy', 'quark', 'skyr', 'kefir', 'molke'];
      const glutenKeywords = ['bread', 'brot', 'pasta', 'nudel', 'wheat', 'weizen', 'flour', 'mehl', 'cereal', 'müsli', 'oat', 'hafer', 'barley', 'gerste', 'rye', 'roggen', 'pizza', 'bagel', 'muffin', 'cake', 'kuchen', 'cookie', 'keks', 'cracker', 'brötchen', 'semmel'];
      const caffeineKeywords = ['coffee', 'kaffee', 'espresso', 'latte', 'cappuccino', 'tea', 'tee', 'energy drink', 'red bull', 'monster', 'cola', 'pepsi', 'coke', 'matcha'];

      for (const item of foods) {
        const loggedFood = item.loggedFood || {};
        const nutritionalValues = item.nutritionalValues || {};
        const foodName = (loggedFood.name || '').toLowerCase();
        const brand = (loggedFood.brand || '').toLowerCase();
        const fullName = `${foodName} ${brand}`;

        // Detect common ingredients
        const containsDairy = dairyKeywords.some(k => fullName.includes(k));
        const containsGluten = glutenKeywords.some(k => fullName.includes(k));
        const containsCaffeine = caffeineKeywords.some(k => fullName.includes(k));

        foodEntries.push({
          user_id: userId,
          food_name: loggedFood.name || 'Unknown',
          brand: loggedFood.brand || null,
          meal_type: loggedFood.mealTypeId ? ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack', 'anytime'][loggedFood.mealTypeId - 1] || 'anytime' : 'anytime',
          calories: nutritionalValues.calories || loggedFood.calories || 0,
          carbs: nutritionalValues.carbs || 0,
          fat: nutritionalValues.fat || 0,
          protein: nutritionalValues.protein || 0,
          fiber: nutritionalValues.fiber || 0,
          sodium: nutritionalValues.sodium || 0,
          sugar: nutritionalValues.sugar || 0,
          contains_dairy: containsDairy,
          contains_gluten: containsGluten,
          contains_caffeine: containsCaffeine,
          source: 'fitbit',
          external_id: String(item.logId || ''),
          logged_at: item.logDate ? `${item.logDate}T12:00:00Z` : now,
        });
      }

      // Insert food entries (upsert to avoid duplicates)
      if (foodEntries.length > 0) {
        for (const entry of foodEntries) {
          // Check if entry already exists
          const { data: existing } = await supabase
            .from('food_entries')
            .select('id')
            .eq('user_id', userId)
            .eq('external_id', entry.external_id)
            .single();

          if (!existing) {
            await supabase.from('food_entries').insert(entry);
          }
        }
        console.log(`Processed ${foodEntries.length} food entries`);
      }
    }

    // Insert metrics into database (delete today's old Fitbit metrics first)
    if (metrics.length > 0) {
      console.log(`Inserting ${metrics.length} metrics for date ${today}`);
      console.log('Metrics to insert:', JSON.stringify(metrics, null, 2));

      // Delete existing Fitbit metrics for TODAY only (by checking the date in metadata)
      // Use the specific date range for today to avoid timezone issues
      const todayStart = `${today}T00:00:00.000Z`;
      const todayEnd = `${today}T23:59:59.999Z`;

      // Delete existing Fitbit metrics for today (non-sleep)
      const { error: deleteNonSleepError } = await supabase
        .from('health_metrics')
        .delete()
        .eq('user_id', userId)
        .eq('source', 'fitbit')
        .neq('metric_type', 'sleep')
        .gte('recorded_at', todayStart)
        .lte('recorded_at', todayEnd);

      if (deleteNonSleepError) {
        console.error('Error deleting non-sleep metrics:', deleteNonSleepError);
      }

      // For sleep, delete any from last 36 hours to handle overnight sleep properly
      const sleepLookback = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

      const { error: deleteSleepError } = await supabase
        .from('health_metrics')
        .delete()
        .eq('user_id', userId)
        .eq('source', 'fitbit')
        .eq('metric_type', 'sleep')
        .gte('recorded_at', sleepLookback);

      if (deleteSleepError) {
        console.error('Error deleting sleep metrics:', deleteSleepError);
      }

      const { data: insertedData, error: insertError } = await supabase
        .from('health_metrics')
        .insert(metrics)
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      console.log(`Successfully inserted ${insertedData?.length || 0} metrics`);
    }

    // Update last sync time
    await supabase
      .from('integrations')
      .update({ last_sync_at: now })
      .eq('user_id', userId)
      .eq('provider', 'fitbit');

    return new Response(
      JSON.stringify({ success: true, metricsCount: metrics.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Fitbit sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});