import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/integrations/supabase/client';

const NOTIFICATION_ENABLED_KEY = '@health_hub_notifications_enabled';
const WEEKLY_SUMMARY_DAY_KEY = '@health_hub_weekly_summary_day';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface WeeklySummary {
  avgSleep: number;
  avgSteps: number;
  avgHeartRate: number;
  totalWorkouts: number;
  totalCalories: number;
  topInsight: string | null;
  symptomsCount: number;
}

class NotificationService {
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return false;
      }

      // Set up notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('health-insights', {
          name: 'Health Insights',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  async isEnabled(): Promise<boolean> {
    const enabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
    return enabled === 'true';
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, enabled.toString());
    
    if (enabled) {
      await this.scheduleWeeklySummary();
    } else {
      await this.cancelAllScheduled();
    }
  }

  async getWeeklySummaryDay(): Promise<number> {
    const day = await AsyncStorage.getItem(WEEKLY_SUMMARY_DAY_KEY);
    return day ? parseInt(day) : 0; // Default to Sunday
  }

  async setWeeklySummaryDay(day: number): Promise<void> {
    await AsyncStorage.setItem(WEEKLY_SUMMARY_DAY_KEY, day.toString());
    await this.scheduleWeeklySummary();
  }

  async scheduleWeeklySummary(): Promise<void> {
    const isEnabled = await this.isEnabled();
    if (!isEnabled) return;

    await this.initialize();

    // Cancel existing weekly summary notifications
    await Notifications.cancelScheduledNotificationAsync('weekly-summary').catch(() => {});

    const summaryDay = await this.getWeeklySummaryDay();

    // Schedule for 9am on the selected day
    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly-summary',
      content: {
        title: '📊 Your Weekly Health Summary',
        body: 'Tap to see your health trends and insights from the past week.',
        data: { type: 'weekly-summary' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: summaryDay + 1, // expo-notifications uses 1-7, not 0-6
        hour: 9,
        minute: 0,
      },
    });

    console.log(`Scheduled weekly summary for day ${summaryDay} at 9am`);
  }

  async generateWeeklySummary(userId: string): Promise<WeeklySummary> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [metricsRes, logsRes, insightsRes] = await Promise.all([
      supabase.from('health_metrics').select('*').eq('user_id', userId).gte('recorded_at', weekAgo),
      supabase.from('manual_logs').select('*').eq('user_id', userId).gte('logged_at', weekAgo),
      supabase.from('ai_insights').select('title').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    ]);

    const metrics = (metricsRes.data || []) as { metric_type: string; value: number }[];
    const logs = (logsRes.data || []) as { log_type: string }[];
    const insights = (insightsRes.data || []) as { title: string }[];

    // Calculate averages
    const sleepData = metrics.filter(m => m.metric_type === 'sleep');
    const stepsData = metrics.filter(m => m.metric_type === 'steps');
    const hrData = metrics.filter(m => m.metric_type === 'resting_heart_rate' || m.metric_type === 'heart_rate');
    const caloriesData = metrics.filter(m => m.metric_type === 'calories_consumed');
    const workouts = logs.filter(l => l.log_type === 'exercise');
    const symptoms = logs.filter(l => l.log_type === 'symptom');

    return {
      avgSleep: sleepData.length > 0 
        ? Math.round((sleepData.reduce((sum, m) => sum + m.value, 0) / sleepData.length) * 10) / 10 
        : 0,
      avgSteps: stepsData.length > 0 
        ? Math.round(stepsData.reduce((sum, m) => sum + m.value, 0) / stepsData.length) 
        : 0,
      avgHeartRate: hrData.length > 0 
        ? Math.round(hrData.reduce((sum, m) => sum + m.value, 0) / hrData.length) 
        : 0,
      totalWorkouts: workouts.length,
      totalCalories: caloriesData.reduce((sum, m) => sum + m.value, 0),
      topInsight: insights.length > 0 ? insights[0].title : null,
      symptomsCount: symptoms.length,
    };
  }

  async sendWeeklySummaryNow(userId: string): Promise<void> {
    await this.initialize();

    const summary = await this.generateWeeklySummary(userId);
    
    const bodyParts = [];
    if (summary.avgSleep > 0) bodyParts.push(`😴 ${summary.avgSleep}h avg sleep`);
    if (summary.avgSteps > 0) bodyParts.push(`👟 ${summary.avgSteps.toLocaleString()} avg steps`);
    if (summary.totalWorkouts > 0) bodyParts.push(`💪 ${summary.totalWorkouts} workouts`);
    if (summary.symptomsCount > 0) bodyParts.push(`🩺 ${summary.symptomsCount} symptoms logged`);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Your Weekly Health Summary',
        body: bodyParts.length > 0 ? bodyParts.join(' • ') : 'Keep logging to build your health profile!',
        data: { type: 'weekly-summary', summary },
      },
      trigger: null, // Send immediately
    });
  }

  async sendInsightNotification(title: string, body: string): Promise<void> {
    const isEnabled = await this.isEnabled();
    if (!isEnabled) return;

    await this.initialize();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💡 ${title}`,
        body,
        data: { type: 'insight' },
      },
      trigger: null,
    });
  }

  async sendEarlyShiftReminder(eventTitle: string, suggestedBedtime: string): Promise<void> {
    const isEnabled = await this.isEnabled();
    if (!isEnabled) return;

    await this.initialize();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 Early Start Tomorrow',
        body: `"${eventTitle}" is early tomorrow. Consider sleeping by ${suggestedBedtime} for 8 hours of rest.`,
        data: { type: 'bedtime-reminder' },
      },
      trigger: null,
    });
  }

  async cancelAllScheduled(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Listen for notification responses
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

export const notificationService = new NotificationService();
