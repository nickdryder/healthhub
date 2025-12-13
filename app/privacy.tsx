import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';

const sections = [
  {
    title: 'Data Collection',
    content: `HealthHub collects health and wellness data that you choose to share with us, including:

• Health metrics from connected services (Fitbit, Apple Health)
• Food and nutrition data from connected apps (Yazio via Fitbit)
• Calendar events from Google Calendar (for schedule-based insights)
• Manual logs you enter (symptoms, caffeine, water intake, etc.)

We only collect data necessary to provide personalized health insights.`,
  },
  {
    title: 'How We Use Your Data',
    content: `Your health data is used to:

• Generate personalized AI insights and correlations
• Identify patterns in your health and lifestyle
• Provide predictions and recommendations
• Sync across your devices when signed in

Your data is processed locally on your device when possible. Cloud processing is used only for features that require it.`,
  },
  {
    title: 'Data Storage & Security',
    content: `• All data is encrypted in transit and at rest
• We use Supabase for secure cloud storage
• Your data is stored in compliance with GDPR
• Access tokens for connected services are encrypted
• We never sell your personal health data`,
  },
  {
    title: 'Third-Party Services',
    content: `HealthHub integrates with third-party services you choose to connect:

• Fitbit - Activity, sleep, heart rate, nutrition data
• Apple Health - Health metrics from your iPhone/Watch
• Google Calendar - Calendar events for schedule insights

Each service has its own privacy policy. We only access data you explicitly authorize.`,
  },
  {
    title: 'Your Rights',
    content: `You have the right to:

• Access all data we store about you
• Export your data at any time
• Delete your account and all associated data
• Disconnect any integrated service
• Opt out of AI insights and notifications

To exercise these rights, visit Settings or contact support.`,
  },
  {
    title: 'Data Retention',
    content: `• Active accounts: Data retained while account is active
• Deleted accounts: All data permanently deleted within 30 days
• You can manually delete specific logs at any time`,
  },
  {
    title: 'Contact Us',
    content: `For privacy-related questions or concerns:

Email: privacy@healthhub.app

Last updated: December 2024`,
  },
];

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.intro, { backgroundColor: colors.card }]}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          <Text style={[styles.introText, { color: colors.text }]}>
            Your privacy matters to us. This policy explains how HealthHub handles your personal health data.
          </Text>
        </View>

        {sections.map((section, index) => (
          <View key={index} style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>{section.content}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
  },
  introText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 22,
  },
});
