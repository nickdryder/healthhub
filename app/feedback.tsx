import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { type } = useLocalSearchParams<{ type: 'bug' | 'suggestion' }>();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const isBug = type === 'bug';
  const title = isBug ? 'Report a Bug' : 'Send Suggestion';
  const icon = isBug ? 'bug-outline' : 'bulb-outline';
  const iconColor = isBug ? '#E53935' : '#FFB300';
  const placeholder = isBug 
    ? 'Describe what happened, what you expected, and steps to reproduce...'
    : 'Share your idea for improving HealthHub...';

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Empty Message', 'Please enter a message before sending.');
      return;
    }

    setSending(true);
    
    // Compose email
    const subject = isBug 
      ? `[Bug Report] HealthHub Issue`
      : `[Suggestion] HealthHub Feedback`;
    
    const body = `${message}\n\n---\nUser: ${user?.email || 'Not signed in'}\nType: ${isBug ? 'Bug Report' : 'Suggestion'}\nApp Version: 1.0.0`;
    
    const mailtoUrl = `mailto:support@healthhub.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        setMessage('');
        Alert.alert('Thank You!', 'Your email app has been opened with your feedback.');
      } else {
        Alert.alert('Email Not Available', 'Please email us directly at support@healthhub.app');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open email app. Please try again.');
    }
    
    setSending(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon as any} size={48} color={iconColor} />
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>
          {isBug ? 'What went wrong?' : 'What would you like to see?'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isBug 
            ? 'Help us fix issues by describing the problem in detail.'
            : 'We love hearing your ideas for making HealthHub better.'}
        </Text>

        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: colors.primary }]} 
          onPress={handleSubmit}
          disabled={sending}
        >
          <Ionicons name="send" size={20} color="#FFFFFF" />
          <Text style={styles.submitText}>
            {sending ? 'Opening Email...' : 'Send Feedback'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          This will open your email app. You can also email us directly at support@healthhub.app
        </Text>
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 180,
    marginBottom: 20,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
