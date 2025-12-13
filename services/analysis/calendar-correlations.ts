import { AnalyzedInsight, AnalysisContext, getDateStr, getHour } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeCalendarCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const events = ctx.events.filter(e => !e.title.toLowerCase().startsWith('[auto]'));
  console.log('[Calendar Analysis] Total events:', ctx.events.length, 'After filter:', events.length);
  console.log('[Calendar Analysis] Sample events:', events.slice(0, 3).map(e => ({ title: e.title, is_all_day: e.is_all_day })));
  if (events.length < 5) {
    console.log('[Calendar Analysis] Not enough events for analysis');
    return insights;
  }

  const eventsByDate: Record<string, typeof events> = {};
  events.forEach(e => {
    const date = getDateStr(e.start_time);
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push(e);
  });

  const eventCountByDate: Record<string, number> = {};
  Object.entries(eventsByDate).forEach(([date, evs]) => {
    eventCountByDate[date] = evs.length;
  });

  // Calendar events vs steps
  const steps = ctx.metrics.filter(m => m.metric_type === 'steps');
  if (steps.length >= 5) {
    const stepsByDate: Record<string, number> = {};
    steps.forEach(s => { stepsByDate[getDateStr(s.recorded_at)] = s.value; });

    let busyDaySteps: number[] = [];
    let calmDaySteps: number[] = [];

    Object.entries(eventCountByDate).forEach(([date, count]) => {
      const daySteps = stepsByDate[date];
      if (!daySteps) return;
      if (count >= 4) {
        busyDaySteps.push(daySteps);
      } else if (count <= 1) {
        calmDaySteps.push(daySteps);
      }
    });

    if (busyDaySteps.length >= 2 && calmDaySteps.length >= 2) {
      const busyAvg = busyDaySteps.reduce((a, b) => a + b, 0) / busyDaySteps.length;
      const calmAvg = calmDaySteps.reduce((a, b) => a + b, 0) / calmDaySteps.length;
      if (calmAvg - busyAvg > 1000) {
        insights.push({
          type: 'correlation',
          title: 'Busy days = less walking',
          description: `You walk ${Math.round(calmAvg - busyAvg).toLocaleString()} fewer steps on days with 4+ events.`,
          confidence: 0.76,
          relatedMetrics: ['calendar', 'steps'],
        });
      }
    }
  }

  // Calendar events vs sleep
  const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
  if (sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let busyDaySleep: number[] = [];
    let calmDaySleep: number[] = [];

    Object.entries(eventCountByDate).forEach(([date, count]) => {
      const sleep = sleepByDate[date];
      if (!sleep) return;
      if (count >= 4) {
        busyDaySleep.push(sleep);
      } else if (count <= 1) {
        calmDaySleep.push(sleep);
      }
    });

    if (busyDaySleep.length >= 2 && calmDaySleep.length >= 2) {
      const busyAvg = busyDaySleep.reduce((a, b) => a + b, 0) / busyDaySleep.length;
      const calmAvg = calmDaySleep.reduce((a, b) => a + b, 0) / calmDaySleep.length;
      if (calmAvg - busyAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'Busy days hurt sleep',
          description: `You sleep ${(calmAvg - busyAvg).toFixed(1)}h less on days with many events.`,
          confidence: 0.78,
          relatedMetrics: ['calendar', 'sleep'],
        });
      }
    }
  }

  // Calendar events vs symptoms
  const symptoms = ctx.logs.filter(l => l.log_type === 'symptom');
  if (symptoms.length >= 5) {
    const symptomsByDate: Record<string, number> = {};
    symptoms.forEach(s => {
      const date = getDateStr(s.logged_at);
      symptomsByDate[date] = (symptomsByDate[date] || 0) + 1;
    });

    let busyDaySymptoms: number[] = [];
    let calmDaySymptoms: number[] = [];

    Object.entries(eventCountByDate).forEach(([date, count]) => {
      const symCount = symptomsByDate[date] || 0;
      if (count >= 4) {
        busyDaySymptoms.push(symCount);
      } else if (count <= 1) {
        calmDaySymptoms.push(symCount);
      }
    });

    if (busyDaySymptoms.length >= 2 && calmDaySymptoms.length >= 2) {
      const busyAvg = busyDaySymptoms.reduce((a, b) => a + b, 0) / busyDaySymptoms.length;
      const calmAvg = calmDaySymptoms.reduce((a, b) => a + b, 0) / calmDaySymptoms.length;
      if (busyAvg - calmAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'Busy schedule triggers symptoms',
          description: `You report ${Math.round((busyAvg - calmAvg) / (calmAvg || 1) * 100)}% more symptoms on packed days.`,
          confidence: 0.75,
          relatedMetrics: ['calendar', 'symptom'],
        });
      }
    }
  }

  // Early shifts prediction
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const tomorrowEvents = events.filter(e => {
    const eventDate = new Date(e.start_time);
    const dateMatch = eventDate >= tomorrow && eventDate <= tomorrowEnd;
    const isNotAllDay = !e.is_all_day; // Filter out all-day events (is_all_day should be false/null for regular events)
    const passes = dateMatch && isNotAllDay;
    
    if (dateMatch && !passes) {
      console.log('[Calendar] Filtered out event (is_all_day):', e.title, 'is_all_day:', e.is_all_day, 'type:', typeof e.is_all_day);
    }
    return passes;
  });

  console.log('[Calendar] Tomorrow events:', tomorrowEvents.length, tomorrowEvents.map(e => ({ title: e.title, hour: getHourInTimezone(e.start_time, ctx.userTimezone) })));

  const earlyEvent = tomorrowEvents.find(e => getHourInTimezone(e.start_time, ctx.userTimezone) < 8);
  if (earlyEvent) {
    console.log('[Calendar] Early event found:', earlyEvent.title);
    const eventTime = new Date(earlyEvent.start_time);
    const wakeTime = new Date(eventTime);
    wakeTime.setHours(eventTime.getHours() - 1); // 1hr before
    insights.push({
      type: 'prediction',
      title: 'Early start tomorrow',
      description: `"${earlyEvent.title}" at ${eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Consider going to bed early tonight.`,
      confidence: 0.92,
      relatedMetrics: ['calendar', 'sleep'],
    });
  }

  // Calendar load vs HRV
  const hrvData = ctx.metrics.filter(m => m.metric_type === 'hrv');
  if (hrvData.length >= 5) {
    const hrvByDate: Record<string, number> = {};
    hrvData.forEach(h => { hrvByDate[getDateStr(h.recorded_at)] = h.value; });

    let busyDayHRV: number[] = [];
    let calmDayHRV: number[] = [];

    Object.entries(eventCountByDate).forEach(([date, count]) => {
      const hrv = hrvByDate[date];
      if (!hrv) return;
      if (count >= 4) {
        busyDayHRV.push(hrv);
      } else if (count <= 1) {
        calmDayHRV.push(hrv);
      }
    });

    if (busyDayHRV.length >= 2 && calmDayHRV.length >= 2) {
      const busyAvg = busyDayHRV.reduce((a, b) => a + b, 0) / busyDayHRV.length;
      const calmAvg = calmDayHRV.reduce((a, b) => a + b, 0) / calmDayHRV.length;
      if (calmAvg - busyAvg > 5) {
        insights.push({
          type: 'correlation',
          title: 'Calendar stress affects HRV',
          description: `Your HRV is ${Math.round(calmAvg - busyAvg)}ms lower on days with 4+ events.`,
          confidence: 0.77,
          relatedMetrics: ['calendar', 'hrv'],
        });
      }
    }
  }

  // Upcoming week load
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const upcomingEvents = events.filter(e => {
    const eventDate = new Date(e.start_time);
    return eventDate >= new Date() && eventDate <= nextWeek;
  });

  if (upcomingEvents.length >= 15) {
    insights.push({
      type: 'prediction',
      title: 'Heavy week ahead',
      description: `${upcomingEvents.length} events in the next 7 days. Plan recovery time and prioritize sleep.`,
      confidence: 0.88,
      relatedMetrics: ['calendar'],
    });
  }

  // Events during specific hours - TIMEZONE-AWARE
  if (events.length >= 5) {
    const eventsByHour: Record<number, number> = {};
    events.forEach(e => {
      const hour = getHourInTimezone(e.start_time, ctx.userTimezone);
      eventsByHour[hour] = (eventsByHour[hour] || 0) + 1;
    });

    const morningEvents = Object.entries(eventsByHour)
      .filter(([h]) => parseInt(h) >= 6 && parseInt(h) < 12)
      .reduce((sum, [, count]) => sum + count, 0);

    const eveningEvents = Object.entries(eventsByHour)
      .filter(([h]) => parseInt(h) >= 18)
      .reduce((sum, [, count]) => sum + count, 0);

    console.log(`[Calendar Timing] Morning events: ${morningEvents}, Evening events: ${eveningEvents}`);
  }
  return insights;
}