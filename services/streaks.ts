import { supabase } from '@/integrations/supabase/client';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastLogDate: string | null;
  isActiveToday: boolean;
}

class StreakService {
  async calculateStreak(userId: string): Promise<StreakInfo> {
    // Get all unique dates with logs or metrics
    const [logsRes, metricsRes, medsRes] = await Promise.all([
      supabase
        .from('manual_logs')
        .select('logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false }),
      supabase
        .from('health_metrics')
        .select('recorded_at')
        .eq('user_id', userId)
        .eq('source', 'manual')
        .order('recorded_at', { ascending: false }),
      supabase
        .from('medication_logs')
        .select('logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false }),
    ]);

    // Combine all dates
    const allDates = new Set<string>();
    
    (logsRes.data || []).forEach(l => {
      allDates.add(new Date(l.logged_at).toISOString().split('T')[0]);
    });
    (metricsRes.data || []).forEach(m => {
      allDates.add(new Date(m.recorded_at).toISOString().split('T')[0]);
    });
    (medsRes.data || []).forEach(m => {
      allDates.add(new Date(m.logged_at).toISOString().split('T')[0]);
    });

    if (allDates.size === 0) {
      return { currentStreak: 0, longestStreak: 0, lastLogDate: null, isActiveToday: false };
    }

    // Sort dates descending
    const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const isActiveToday = sortedDates[0] === today;
    const lastLogDate = sortedDates[0];

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = isActiveToday ? today : yesterday;
    
    // If last log wasn't today or yesterday, streak is broken
    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
      currentStreak = 0;
    } else {
      // Count consecutive days
      for (const date of sortedDates) {
        if (date === checkDate) {
          currentStreak++;
          // Move to previous day
          const prevDate = new Date(checkDate);
          prevDate.setDate(prevDate.getDate() - 1);
          checkDate = prevDate.toISOString().split('T')[0];
        } else if (date < checkDate) {
          // Gap found, streak ends
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: string | null = null;

    // Sort ascending for longest streak calculation
    const ascDates = Array.from(allDates).sort();
    
    for (const date of ascDates) {
      if (prevDate === null) {
        tempStreak = 1;
      } else {
        const prev = new Date(prevDate);
        const curr = new Date(date);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
        
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      prevDate = date;
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
      currentStreak,
      longestStreak,
      lastLogDate,
      isActiveToday,
    };
  }
}

export const streakService = new StreakService();
