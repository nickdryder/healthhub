import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRecentLogs } from '@/hooks/useHealthData';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { colors } from '@/constants/colors';
import { EditLogTimeModal } from './EditLogTimeModal';
import { formatLogValue } from '@/services/log-formatting';
import { EmptyState } from '@/components/ui/EmptyState';

const logTypeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  symptom: 'medical',
  bristol_stool: 'analytics',
  caffeine: 'cafe',
  exercise: 'barbell',
  supplement: 'flask',
  custom: 'create',
};

const logTypeColors: Record<string, string> = {
  symptom: colors.error,
  bristol_stool: colors.warning,
  caffeine: colors.calories,
  exercise: colors.info,
  supplement: colors.success,
  custom: colors.primary,
};

export function RecentLogs() {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const { data: logs, isLoading: loading, refetch } = useRecentLogs(5);
  const [editingLog, setEditingLog] = useState<any>(null);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Recent Entries</Text>
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Recent Entries</Text>
        <EmptyState
          icon="document-text-outline"
          title="No entries yet"
          description="Start logging your health data"
          actionLabel="Add Entry"
          onAction={() => router.push('/(tabs)/log')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Entries</Text>
        <TouchableOpacity 
          onPress={() => router.push('/log-history')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.viewAllButton}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.list}>
        {logs.map((log) => (
          <TouchableOpacity 
            key={log.id} 
            style={styles.logItem}
            onPress={() => setEditingLog(log)}
            activeOpacity={0.6}
          >
            <View style={[styles.logIcon, { backgroundColor: `${logTypeColors[log.log_type] || colors.gray400}15` }]}>
              <Ionicons 
                name={logTypeIcons[log.log_type] || 'document'} 
                size={16} 
                color={logTypeColors[log.log_type] || colors.gray400} 
              />
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logValue}>{formatLogValue(log.log_type, log.value)}</Text>
              {log.severity && (
                <Text style={styles.logSeverity}>Severity: {log.severity}/10</Text>
              )}
            </View>
            <View style={styles.logTimeContainer}>
              <Text style={styles.logTime}>{formatTime(log.logged_at)}</Text>
              <Ionicons name="pencil" size={14} color={colors.gray400} style={styles.editIcon} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {editingLog && (
        <EditLogTimeModal
          visible={!!editingLog}
          logId={editingLog.id}
          currentTime={editingLog.logged_at}
          logType={editingLog.log_type}
          logValue={editingLog.value}
          onClose={() => setEditingLog(null)}
          onUpdate={() => {
            refetch();
            setEditingLog(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
  },
  viewAllButton: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  list: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logContent: {
    flex: 1,
    marginLeft: 12,
  },
  logValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray800,
  },
  logSeverity: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  logTimeContainer: {
    alignItems: 'center',
    gap: 4,
  },
  logTime: {
    fontSize: 12,
    color: colors.gray400,
  },
  editIcon: {
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray400,
    marginTop: 8,
  },
});