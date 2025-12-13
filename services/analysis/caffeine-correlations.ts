import { AnalyzedInsight, AnalysisContext, getDateStr } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeCaffeineCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const caffeineLogs = ctx.logs.filter(l => l.log_type === 'caffeine');
  if (caffeineLogs.length < 3) return insights;

  // Caffeine timing vs resting HR
  const hrData = ctx.metrics.filter(m => m.metric_type === 'heart_rate' || m.metric_type === 'resting_hr');
  if (hrData.length >= 5) {
    const hrByDate: Record<string, number[]> = {};
    hrData.forEach(h => {
      const date = getDateStr(h.recorded_at);
      if (!hrByDate[date]) hrByDate[date] = [];
      hrByDate[date].push(h.value);
    });

    let lateCaffeineHR = 0, lateDays = 0;
    let earlyCaffeineHR = 0, earlyDays = 0;

    caffeineLogs.forEach(c => {
      const date = getDateStr(c.logged_at);
      const hour = getHourInTimezone(c.logged_at, ctx.userTimezone);
      const hrs = hrByDate[date];
      if (!hrs || hrs.length === 0) return;
      const avgHR = hrs.reduce((a, b) => a + b, 0) / hrs.length;

      // Debug log to track timezone-aware hour extraction
      console.log(`[Caffeine HR] Log at ${c.logged_at}, timezone=${ctx.userTimezone || 'local'}, extracted hour=${hour}`);

      if (hour >= 14) {
        lateCaffeineHR += avgHR;
        lateDays++;
      } else {
        earlyCaffeineHR += avgHR;
        earlyDays++;
      }
    });

    if (lateDays >= 2 && earlyDays >= 2) {
      const lateAvg = lateCaffeineHR / lateDays;
      const earlyAvg = earlyCaffeineHR / earlyDays;
      if (lateAvg - earlyAvg > 5) {
        insights.push({
          type: 'correlation',
          title: 'Afternoon caffeine raises HR',
          description: `Your resting HR is ${Math.round(lateAvg - earlyAvg)} bpm higher on days with late caffeine.`,
          confidence: 0.77,
          relatedMetrics: ['caffeine', 'heart_rate'],
        });
      }
    }
  }

  // Caffeine vs poop timing
  const bristolLogs = ctx.logs.filter(l => l.log_type === 'bristol_stool');
  if (bristolLogs.length >= 5 && caffeineLogs.length >= 5) {
    let caffeineFirst = 0, noCaffeineFirst = 0;
    const caffeineByDate: Record<string, number> = {};
    caffeineLogs.forEach(c => {
      const date = getDateStr(c.logged_at);
      const hour = getHourInTimezone(c.logged_at, ctx.userTimezone);
      if (!caffeineByDate[date] || hour < caffeineByDate[date]) {
        caffeineByDate[date] = hour;
      }
    });

    bristolLogs.forEach(b => {
      const date = getDateStr(b.logged_at);
      const hour = getHourInTimezone(b.logged_at, ctx.userTimezone);
      const caffeineHour = caffeineByDate[date];

      if (caffeineHour !== undefined && hour > caffeineHour && hour - caffeineHour <= 2) {
        caffeineFirst++;
      } else {
        noCaffeineFirst++;
      }
    });

    const total = caffeineFirst + noCaffeineFirst;
    if (total >= 5 && caffeineFirst / total > 0.5) {
      insights.push({
        type: 'correlation',
        title: 'Caffeine triggers bowel movements',
        description: `${Math.round((caffeineFirst / total) * 100)}% of BMs occur within 2h of caffeine.`,
        confidence: 0.80,
        relatedMetrics: ['caffeine', 'bristol'],
      });
    }
  }

  // Caffeine vs HRV
  const hrvData = ctx.metrics.filter(m => m.metric_type === 'hrv');
  if (hrvData.length >= 5 && caffeineLogs.length >= 5) {
    const hrvByDate: Record<string, number> = {};
    hrvData.forEach(h => { hrvByDate[getDateStr(h.recorded_at)] = h.value; });

    const caffeineByDate: Record<string, number> = {};
    caffeineLogs.forEach(c => {
      const date = getDateStr(c.logged_at);
      const amt = parseInt(c.value) || 100;
      caffeineByDate[date] = (caffeineByDate[date] || 0) + amt;
    });

    let highCaffeineHRV = 0, highDays = 0;
    let lowCaffeineHRV = 0, lowDays = 0;

    Object.entries(caffeineByDate).forEach(([date, amt]) => {
      const hrv = hrvByDate[date];
      if (!hrv) return;
      if (amt > 200) {
        highCaffeineHRV += hrv;
        highDays++;
      } else if (amt < 100) {
        lowCaffeineHRV += hrv;
        lowDays++;
      }
    });

    if (highDays >= 2 && lowDays >= 2) {
      const highAvg = highCaffeineHRV / highDays;
      const lowAvg = lowCaffeineHRV / lowDays;
      if (lowAvg - highAvg > 5) {
        insights.push({
          type: 'correlation',
          title: 'High caffeine lowers HRV',
          description: `Days with 200mg+ caffeine show ${Math.round(lowAvg - highAvg)}ms lower HRV.`,
          confidence: 0.76,
          relatedMetrics: ['caffeine', 'hrv'],
        });
      }
    }
  }

  // Late caffeine insight - only show if RECENT pattern (last 7 days has mostly late caffeine)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCaffeine = caffeineLogs.filter(l => new Date(l.logged_at) >= sevenDaysAgo);
  // Debug: show each caffeine log and its hour
  console.log('[Analysis] Analyzing recent caffeine logs (past 7 days):');
  recentCaffeine.forEach(l => {
    const hour = getHourInTimezone(l.logged_at, ctx.userTimezone);
    console.log(`  - ${l.logged_at} → hour=${hour} (${hour >= 14 ? '❌ LATE' : '✅ EARLY'})`);
  });

  const recentLateCaffeine = recentCaffeine.filter(l => getHourInTimezone(l.logged_at, ctx.userTimezone) >= 14);
  if (recentLateCaffeine.length >= 3 && recentCaffeine.length >= 5) {
    const ratio = recentLateCaffeine.length / recentCaffeine.length;
    console.log('[Analysis] Recent caffeine timing - Late:', recentLateCaffeine.length, 'Total (7d):', recentCaffeine.length, 'Ratio:', ratio);
    if (ratio > 0.6) {
      insights.push({
        type: 'recommendation',
        title: 'Consider earlier caffeine',
        description: `${Math.round(ratio * 100)}% of your caffeine in the past week is after 2pm. This may affect sleep.`,
        confidence: 0.82,
        relatedMetrics: ['caffeine', 'sleep'],
      });
    }
  }

  return insights;
}