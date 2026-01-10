import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useHealthIntegrations, IntegrationProvider } from '@/hooks/useHealthIntegrations';
import { AnalysisFrequencyPicker, AnalysisFrequency } from '@/components/settings/AnalysisFrequencyPicker';
import { LocationPicker } from '@/components/settings/LocationPicker';
import { notificationService } from '@/services/notifications';
import { dataExportService } from '@/services/data-export';
import { cycleTracking } from '@/services/cycle-tracking';
import { supabase } from '@/integrations/supabase/client';
import { colors as staticColors } from '@/constants/colors';

const FREQUENCY_KEY = '@health_hub_analysis_frequency';
const UNIT_SYSTEM_KEY = '@health_hub_unit_system';
const MEDICATION_REMINDER_KEY = '@health_hub_medication_reminder';

const integrationConfig = [
  { id: 'apple_health' as IntegrationProvider, name: 'Apple Health', icon: 'heart-outline' as const, color: '#FF2D55' },
  { id: 'fitbit' as IntegrationProvider, name: 'Fitbit', icon: 'watch-outline' as const, color: '#00B0B9', description: 'Includes Yazio nutrition data' },
  { id: 'google_calendar' as IntegrationProvider, name: 'Google Calendar', icon: 'calendar-outline' as const, color: '#4285F4' },
];

function SettingRow({ icon, label, value, hasToggle, hasArrow, isEnabled, onToggle, colors }: { 
  icon: keyof typeof Ionicons.glyphMap; 
  label: string; 
  value?: string;
  hasToggle?: boolean;
  hasArrow?: boolean;
  isEnabled?: boolean;
  onToggle?: (value: boolean) => void;
  colors: any;
}) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      {value && <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text>}
      {hasToggle && (
        <Switch
          value={isEnabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.gray200, true: colors.primaryLight }}
          thumbColor="#FFFFFF"
        />
      )}
      {hasArrow && <Ionicons name="chevron-forward" size={20} color={colors.gray300} />}
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { isDark, colors, toggleDarkMode } = useTheme();
  const { loading, connectAppleHealth, connectFitbit, connectGoogleCalendar, getIntegrationStatus, refreshInsights, syncAllIntegrations } = useHealthIntegrations();
  // Initialize with disconnected state, will update after mount
  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, boolean>>({
    apple_health: false,
    fitbit: false,
    google_calendar: false,
  });
  const [analysisFrequency, setAnalysisFrequency] = useState<AnalysisFrequency>('30min');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [weeklySummaryDay, setWeeklySummaryDay] = useState(0);
  const [aiInsights, setAiInsights] = useState(true);
  const [useMetric, setUseMetric] = useState(true);
  const [medicationReminderEnabled, setMedicationReminderEnabled] = useState(false);
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dataRequirementsExpanded, setDataRequirementsExpanded] = useState(false);

  // Fetch user profile to get sex
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('sex')
        .eq('id', user.id)
        .single();
      return data as { sex: string } | null;
    },
    enabled: !!user,
  });

  // Function to refresh all integration statuses from database
  const refreshIntegrationStatuses = useCallback(async () => {
    if (!user) return;
    const statuses: Record<string, boolean> = {};
    for (const integration of integrationConfig) {
      const status = await getIntegrationStatus(integration.id);
      statuses[integration.id] = status.isConnected;
    }
    setIntegrationStatuses(statuses);
  }, [user, getIntegrationStatus]);

  useEffect(() => {
    AsyncStorage.getItem(FREQUENCY_KEY).then(saved => {
      if (saved) setAnalysisFrequency(saved as AnalysisFrequency);
    });
    AsyncStorage.getItem(UNIT_SYSTEM_KEY).then(saved => {
      if (saved !== null) setUseMetric(saved === 'metric');
    });
    AsyncStorage.getItem(MEDICATION_REMINDER_KEY).then(saved => {
      if (saved !== null) setMedicationReminderEnabled(saved === 'true');
    });
    notificationService.isEnabled().then(setNotificationsEnabled);
    notificationService.getWeeklySummaryDay().then(setWeeklySummaryDay);
    cycleTracking.isCycleTrackingEnabled().then(setCycleTrackingEnabled);
    refreshIntegrationStatuses();
  }, [user, refreshIntegrationStatuses]);

  const handleFrequencyChange = async (frequency: AnalysisFrequency) => {
    setAnalysisFrequency(frequency);
    await AsyncStorage.setItem(FREQUENCY_KEY, frequency);
  };

  const handleUnitSystemChange = async (isMetric: boolean) => {
    setUseMetric(isMetric);
    await AsyncStorage.setItem(UNIT_SYSTEM_KEY, isMetric ? 'metric' : 'imperial');
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await notificationService.setEnabled(enabled);
    if (enabled) {
      Alert.alert('Notifications Enabled', 'You\'ll receive weekly health summaries and important insights.');
    }
  };

  const handleWeeklySummaryDayChange = async () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    Alert.alert(
      'Weekly Summary Day',
      'Choose when to receive your weekly health summary',
      days.map((day, index) => ({
        text: day,
        onPress: async () => {
          setWeeklySummaryDay(index);
          await notificationService.setWeeklySummaryDay(index);
        },
      }))
    );
  };

  const handleSendTestSummary = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to test notifications.');
      return;
    }
    await notificationService.sendWeeklySummaryNow(user.id);
    Alert.alert('Test Sent', 'Check your notifications for the weekly summary.');
  };

  const handleConnectIntegration = async (id: IntegrationProvider, name: string) => {
    let success = false;
    switch (id) {
      case 'apple_health':
        success = await connectAppleHealth();
        break;
      case 'fitbit':
        success = await connectFitbit();
        break;
      case 'google_calendar':
        success = await connectGoogleCalendar();
        break;
      default:
        Alert.alert('Coming Soon', `${name} integration will be available in a future update.`);
        return;
    }
    // Refresh statuses from database after successful connection
    if (success) {
      await refreshIntegrationStatuses();
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleMedicationReminderToggle = async (enabled: boolean) => {
    setMedicationReminderEnabled(enabled);
    await AsyncStorage.setItem(MEDICATION_REMINDER_KEY, enabled ? 'true' : 'false');
  };

  const handleExportData = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to export data.');
      return;
    }
    setExporting(true);
    try {
      await dataExportService.shareExport(user.id);
    } finally {
      setExporting(false);
    }
  };

  const handleSyncAll = async () => {
    const success = await syncAllIntegrations();
    if (success) {
      await refreshIntegrationStatuses();
    }
  };

  const handleCycleTrackingToggle = async (enabled: boolean) => {
    if (enabled) {
      cycleTracking.enableCycleTracking();
      setCycleTrackingEnabled(true);
      Alert.alert(
        'Cycle Tracking Enabled',
        'Your cycle data will be stored encrypted on this device only, never synced to servers. You have full control and can disable anytime.'
      );
    } else {
      Alert.alert('Disable Cycle Tracking', 'Are you sure? This will not delete existing data.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await cycleTracking.disableCycleTracking();
            setCycleTrackingEnabled(false);
          },
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        </View>

        {user && (
          <View style={[styles.profileSection, { backgroundColor: colors.card }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Ionicons name="person" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>{user.email}</Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>Signed in</Text>
            </View>
          </View>
        )}

        {user && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Profile</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <TouchableOpacity
                onPress={() => router.push('/profile')}
                accessibilityLabel="Profile and Goals"
                accessibilityRole="button"
                accessibilityHint="View and edit your profile, BMI, height, and health goals"
              >
                <SettingRow icon="body-outline" label="Profile & Goals" value="BMI, Height, Goals" hasArrow colors={colors} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data Sources</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {integrationConfig.map((integration, index) => {
              const isConnected = integrationStatuses[integration.id];
              const isLoading = loading[integration.id];
              return (
                <TouchableOpacity
                  key={integration.id}
                  style={[styles.integrationRow, index < integrationConfig.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => handleConnectIntegration(integration.id, integration.name)}
                  activeOpacity={0.7}
                  disabled={isLoading}
                  accessibilityLabel={`${integration.name} integration, ${isConnected ? 'connected' : 'not connected'}`}
                  accessibilityRole="button"
                  accessibilityHint={isConnected ? `Tap to manage ${integration.name} connection` : `Tap to connect ${integration.name}`}
                >
                  <View style={[styles.integrationIcon, { backgroundColor: `${integration.color}15` }]}>
                    <Ionicons name={integration.icon} size={22} color={integration.color} />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={[styles.integrationName, { color: colors.text }]}>{integration.name}</Text>
                    <Text style={[styles.integrationStatus, { color: colors.textSecondary }]}>
                      {isLoading ? 'Connecting...' : isConnected ? 'Connected' : 'Not connected'}
                    </Text>
                  </View>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View style={[styles.statusDot, { backgroundColor: isConnected ? staticColors.success : colors.gray300 }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.syncButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleSyncAll}
            disabled={loading.sync_all}
            accessibilityLabel="Sync all data sources"
            accessibilityRole="button"
            accessibilityHint="Synchronize health data from all connected sources"
            accessibilityState={{ disabled: loading.sync_all }}
          >
            {loading.sync_all ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="sync" size={20} color={colors.primary} />
            )}
            <Text style={[styles.syncButtonText, { color: colors.primary }]}>
              {loading.sync_all ? 'Syncing...' : 'Sync All Sources Now'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AI Analysis</Text>
          <AnalysisFrequencyPicker value={analysisFrequency} onChange={handleFrequencyChange} />
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.primary }]}
            onPress={refreshInsights}
            disabled={loading.insights}
            accessibilityLabel="Generate new AI insights"
            accessibilityRole="button"
            accessibilityHint="Analyze your health data to generate new insights and recommendations"
            accessibilityState={{ disabled: loading.insights }}
          >
            {loading.insights ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.refreshButtonText}>
              {loading.insights ? 'Analyzing...' : 'Generate New Insights'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dataRequirementsCard, { backgroundColor: colors.card }]}
            onPress={() => setDataRequirementsExpanded(!dataRequirementsExpanded)}
            activeOpacity={0.7}
            accessibilityLabel="Data requirements for insights"
            accessibilityRole="button"
            accessibilityHint={dataRequirementsExpanded ? "Collapse data requirements" : "Expand to view data requirements"}
            accessibilityState={{ expanded: dataRequirementsExpanded }}
          >
            <View style={styles.dataRequirementsHeader}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.dataRequirementsTitle, { color: colors.text }]}>Data needed for insights</Text>
              <Ionicons 
                name={dataRequirementsExpanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={colors.textSecondary}
                style={{ marginLeft: 'auto' }}
              />
            </View>
            {dataRequirementsExpanded && (
              <View style={styles.requirementsList}>
                <View style={styles.requirementItem}>
                  <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>Sleep patterns</Text>
                  <Text style={[styles.requirementValue, { color: colors.text }]}>3+ sleep records</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>Caffeine & sleep</Text>
                  <Text style={[styles.requirementValue, { color: colors.text }]}>3+ caffeine + 3+ sleep</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>Symptom patterns</Text>
                  <Text style={[styles.requirementValue, { color: colors.text }]}>2+ of same symptom</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>Day-of-week trends</Text>
                  <Text style={[styles.requirementValue, { color: colors.text }]}>5+ symptom logs</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>Activity trends</Text>
                  <Text style={[styles.requirementValue, { color: colors.text }]}>5+ step records</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>Exercise progress</Text>
                  <Text style={[styles.requirementValue, { color: colors.text }]}>2+ same exercise</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={[styles.requirementLabel, { color: colors.textSecondary }]}>Weather correlations</Text>
                  <Text style={[styles.requirementValue, { color: colors.text }]}>Set location + 3+ symptoms</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Weather Correlations</Text>
          <View style={{ paddingHorizontal: 20 }}>
            <LocationPicker />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <SettingRow icon="notifications-outline" label="Push Notifications" hasToggle isEnabled={notificationsEnabled} onToggle={handleNotificationsToggle} colors={colors} />
            {notificationsEnabled && (
              <>
                <TouchableOpacity
                  onPress={handleWeeklySummaryDayChange}
                  accessibilityLabel={`Weekly summary day, currently ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weeklySummaryDay]}`}
                  accessibilityRole="button"
                  accessibilityHint="Change the day you receive weekly health summaries"
                >
                  <SettingRow
                    icon="calendar-outline"
                    label="Weekly Summary Day"
                    value={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weeklySummaryDay]}
                    hasArrow
                    colors={colors}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSendTestSummary}
                  accessibilityLabel="Send test summary"
                  accessibilityRole="button"
                  accessibilityHint="Send a test notification to verify your notification settings"
                >
                  <SettingRow icon="paper-plane-outline" label="Send Test Summary" hasArrow colors={colors} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <SettingRow icon="moon-outline" label="Dark Mode" hasToggle isEnabled={isDark} onToggle={toggleDarkMode} colors={colors} />
            <SettingRow icon="analytics-outline" label="AI Insights" hasToggle isEnabled={aiInsights} onToggle={setAiInsights} colors={colors} />
            <SettingRow icon="speedometer-outline" label="Use Metric Units" value={useMetric ? 'kg, cm' : 'lb, in'} hasToggle isEnabled={useMetric} onToggle={handleUnitSystemChange} colors={colors} />
            <SettingRow icon="medkit-outline" label="Medication Reminders" hasToggle isEnabled={medicationReminderEnabled} onToggle={handleMedicationReminderToggle} colors={colors} />
            {profile?.sex?.toLowerCase() === 'female' && (
              <SettingRow 
                icon="heart-outline" 
                label="Cycle Tracking" 
                hasToggle 
                isEnabled={cycleTrackingEnabled} 
                onToggle={handleCycleTrackingToggle} 
                colors={colors} 
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data Export</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              onPress={handleExportData}
              disabled={exporting}
              accessibilityLabel="Export health data to CSV"
              accessibilityRole="button"
              accessibilityHint="Download all your health data as a CSV file"
              accessibilityState={{ disabled: exporting }}
            >
              <SettingRow icon="download-outline" label={exporting ? 'Exporting...' : 'Export Health Data (CSV)'} hasArrow colors={colors} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.exportHint, { color: colors.textSecondary }]}>
            Share with healthcare providers or backup your data
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <SettingRow icon="information-circle-outline" label="App Version" value="1.0.0" colors={colors} />
            <TouchableOpacity
              onPress={() => router.push('/privacy')}
              accessibilityLabel="Privacy Policy"
              accessibilityRole="button"
              accessibilityHint="View the app's privacy policy"
            >
              <SettingRow icon="shield-checkmark-outline" label="Privacy Policy" hasArrow colors={colors} />
            </TouchableOpacity>
          </View>
        </View>

        {user && (
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            accessibilityHint="Sign out of your account"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { marginLeft: 14, flex: 1 },
  profileName: { fontSize: 16, fontWeight: '600' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  profileLink: { fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10, paddingHorizontal: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
  integrationRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowBorder: { borderBottomWidth: 1 },
  integrationIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  integrationInfo: { flex: 1, marginLeft: 14 },
  integrationName: { fontSize: 16, fontWeight: '600' },
  integrationStatus: { fontSize: 13, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  settingLabel: { flex: 1, fontSize: 16 },
  settingValue: { fontSize: 16 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: `${staticColors.error}10`,
    borderRadius: 12,
    gap: 8,
  },
  signOutText: { fontSize: 16, fontWeight: '600', color: staticColors.error },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  refreshButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  syncButtonText: { fontSize: 15, fontWeight: '600' },
  dataRequirementsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
  },
  dataRequirementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dataRequirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  requirementsList: {
    gap: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requirementLabel: {
    fontSize: 13,
  },
  requirementValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  exportHint: {
    fontSize: 12,
    marginHorizontal: 20,
    marginTop: 8,
  },
});