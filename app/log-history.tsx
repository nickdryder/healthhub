import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { colors as staticColors } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import { EditLogTimeModal } from '@/components/logging/EditLogTimeModal';
import { formatLogValue } from '@/services/log-formatting';

const logTypeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  symptom: 'medical',
  bristol_stool: 'analytics',
  caffeine: 'cafe',
  exercise: 'barbell',
  supplement: 'flask',
  medication: 'medkit',
  weight: 'scale',
  custom: 'create',
};

const logTypeColors: Record<string, string> = {
  symptom: staticColors.error,
  bristol_stool: staticColors.warning,
  caffeine: staticColors.calories,
  exercise: staticColors.info,
  supplement: staticColors.success,
  medication: '#8B5CF6',
  weight: staticColors.primary,
  custom: staticColors.primary,
};

export default function LogHistoryScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<any>(null);

  // Fetch all logs
  const { data: allLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['log-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('manual_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Get unique log types for filtering
  const logTypes = useMemo(() => {
    const types = new Set(allLogs.map(log => log.log_type));
    return Array.from(types);
  }, [allLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!selectedFilter) return allLogs;
    return allLogs.filter(log => log.log_type === selectedFilter);
  }, [allLogs, selectedFilter]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Text style={{ color: colors.text }}>Please sign in</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Log History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            !selectedFilter && { backgroundColor: colors.primary, borderColor: colors.primary },
            selectedFilter && { borderColor: colors.border, backgroundColor: colors.card }
          ]}
          onPress={() => setSelectedFilter(null)}
        >
          <Text style={[
            styles.filterTabText,
            !selectedFilter && { color: '#fff', fontWeight: '600' },
            selectedFilter && { color: colors.text }
          ]}>
            All
          </Text>
        </TouchableOpacity>

        {logTypes.map(type => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterTab,
              selectedFilter === type && { backgroundColor: logTypeColors[type] || colors.primary, borderColor: logTypeColors[type] || colors.primary },
              selectedFilter !== type && { borderColor: colors.border, backgroundColor: colors.card }
            ]}
            onPress={() => setSelectedFilter(type)}
          >
            <Ionicons 
              name={logTypeIcons[type] || 'document'} 
              size={14} 
              color={selectedFilter === type ? '#fff' : (logTypeColors[type] || colors.text)}
              style={{ marginRight: 4 }}
            />
            <Text style={[
              styles.filterTabText,
              selectedFilter === type && { color: '#fff', fontWeight: '600' },
              selectedFilter !== type && { color: colors.text }
            ]}>
              {type.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logs list */}
      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No logs found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: log }) => (
            <TouchableOpacity
              style={[styles.logItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setEditingLog(log)}
              activeOpacity={0.6}
            >
              <View style={[styles.logIcon, { backgroundColor: `${logTypeColors[log.log_type] || colors.gray400}20` }]}>
                <Ionicons 
                  name={logTypeIcons[log.log_type] || 'document'} 
                  size={18}
                  color={logTypeColors[log.log_type] || colors.text}
                />
              </View>
              <View style={styles.logInfo}>
                <Text style={[styles.logType, { color: colors.text }]}>
                  {log.log_type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={[styles.logValue, { color: colors.textSecondary }]}>
                  {formatLogValue(log.log_type, log.value)}
                </Text>
              </View>
              <View style={styles.logRight}>
                <Text style={[styles.logTime, { color: colors.textSecondary }]}>
                  {formatTime(log.logged_at)}
                </Text>
                <Ionicons name="pencil" size={14} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

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
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  filterScroll: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
    marginLeft: 12,
  },
  logType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logValue: {
    fontSize: 14,
    marginTop: 4,
  },
  logRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  logTime: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});