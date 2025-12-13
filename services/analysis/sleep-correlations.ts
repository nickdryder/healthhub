import { AnalyzedInsight, AnalysisContext, getDateStr, getHour } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeSleepCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
  if (sleepData.length < 3) return insights;

  // Basic sleep duration insight
  const avgSleep = sleepData.reduce((s, m) => s + m.value, 0) / sleepData.length;
  if (avgSleep < 7) {
    insights.push({
      type: 'recommendation',
      title: 'Improve sleep duration',
      description: `Your average sleep is ${avgSleep.toFixed(1)} hours. Aim for 7-9 hours.`,
      confidence: 0.85,
      relatedMetrics: ['sleep'],
    });
  }

  // Sleep vs caffeine timing
  const caffeineLogs = ctx.logs.filter(l => l.log_type === 'caffeine');
  if (caffeineLogs.length >= 3 && sleepData.length >= 3) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let lateCaffeineSleepTotal = 0, lateCaffeineDays = 0;
    let earlyCaffeineSleepTotal = 0, earlyCaffeineDays = 0;

    caffeineLogs.forEach(c => {
      const date = getDateStr(c.logged_at);
      const hour = getHourInTimezone(c.logged_at, ctx.timezone);
      const nextDaySleep = sleepByDate[date]; // Sleep recorded for that night
      if (!nextDaySleep) return;

      if (hour >= 14) {
        lateCaffeineSleepTotal += nextDaySleep;
        lateCaffeineDays++;
      } else {
        earlyCaffeineSleepTotal += nextDaySleep;
        earlyCaffeineDays++;
      }
    });

    if (lateCaffeineDays >= 2 && earlyCaffeineDays >= 2) {
      const lateAvg = lateCaffeineSleepTotal / lateCaffeineDays;
      const earlyAvg = earlyCaffeineSleepTotal / earlyCaffeineDays;
      if (earlyAvg - lateAvg > 0.5) {
        insights.push({
          type: 'correlation',
          title: 'Late caffeine hurts sleep',
          description: `You sleep ${(earlyAvg - lateAvg).toFixed(1)}h less after caffeine past 2pm (${lateAvg.toFixed(1)}h vs ${earlyAvg.toFixed(1)}h).`,
          confidence: 0.84,
          relatedMetrics: ['sleep', 'caffeine'],
        });
      }
    }
  }

  // Sleep vs late meal timing
  if (ctx.foods.length >= 5 && sleepData.length >= 3) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let lateMealSleepTotal = 0, lateMealDays = 0;
    let earlyMealSleepTotal = 0, earlyMealDays = 0;
    const processedDates = new Set<string>();

    ctx.foods.forEach(f => {
      const date = getDateStr(f.logged_at);
      if (processedDates.has(date)) return;
      processedDates.add(date);

      const hour = getHourInTimezone(f.logged_at, ctx.timezone);
      const sleep = sleepByDate[date];
      if (!sleep) return;

      if (hour >= 21) {
        lateMealSleepTotal += sleep;
        lateMealDays++;
      } else if (hour >= 17 && hour <= 19) {
        earlyMealSleepTotal += sleep;
        earlyMealDays++;
      }
    });

    if (lateMealDays >= 2 && earlyMealDays >= 2) {
      const lateAvg = lateMealSleepTotal / lateMealDays;
      const earlyAvg = earlyMealSleepTotal / earlyMealDays;
      if (earlyAvg - lateAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'Late eating affects sleep',
          description: `Eating after 9pm correlates with ${(earlyAvg - lateAvg).toFixed(1)}h less sleep.`,
          confidence: 0.76,
          relatedMetrics: ['sleep', 'food'],
        });
      }
    }
  }

  // Sleep vs exercise timing
  const exercises = ctx.logs.filter(l => l.log_type === 'exercise');
  if (exercises.length >= 3 && sleepData.length >= 3) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let morningSleepTotal = 0, morningDays = 0;
    let eveningSleepTotal = 0, eveningDays = 0;

    exercises.forEach(e => {
      const date = getDateStr(e.logged_at);
      const hour = getHourInTimezone(e.logged_at, ctx.timezone);
      const sleep = sleepByDate[date];
      if (!sleep) return;

      if (hour < 12) {
        morningSleepTotal += sleep;
        morningDays++;
      } else if (hour >= 18) {
        eveningSleepTotal += sleep;
        eveningDays++;
      }
    });

    if (morningDays >= 2 && eveningDays >= 2) {
      const morningAvg = morningSleepTotal / morningDays;
      const eveningAvg = eveningSleepTotal / eveningDays;
      if (morningAvg - eveningAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'Morning workouts = better sleep',
          description: `You sleep ${(morningAvg - eveningAvg).toFixed(1)}h more after morning exercise vs evening.`,
          confidence: 0.78,
          relatedMetrics: ['sleep', 'exercise'],
        });
      }
    }
  }

  // Sleep vs steps
  const steps = ctx.metrics.filter(m => m.metric_type === 'steps');
  if (steps.length >= 5 && sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    const avgSteps = steps.reduce((s, m) => s + m.value, 0) / steps.length;
    let highStepSleep = 0, highDays = 0;
    let lowStepSleep = 0, lowDays = 0;

    steps.forEach(s => {
      const date = getDateStr(s.recorded_at);
      const sleep = sleepByDate[date];
      if (!sleep) return;

      if (s.value > avgSteps * 1.2) {
        highStepSleep += sleep;
        highDays++;
      } else if (s.value < avgSteps * 0.8) {
        lowStepSleep += sleep;
        lowDays++;
      }
    });

    if (highDays >= 2 && lowDays >= 2) {
      const highAvg = highStepSleep / highDays;
      const lowAvg = lowStepSleep / lowDays;
      if (highAvg - lowAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'Active days improve sleep',
          description: `High-step days correlate with ${(highAvg - lowAvg).toFixed(1)}h more sleep.`,
          confidence: 0.80,
          relatedMetrics: ['sleep', 'steps'],
        });
      }
    }
  }

  // Sleep consistency
  if (sleepData.length >= 7) {
    const values = sleepData.slice(0, 7).map(s => s.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 1.5) {
      insights.push({
        type: 'recommendation',
        title: 'Inconsistent sleep schedule',
        description: `Your sleep varies by ±${stdDev.toFixed(1)}h. Consistent timing improves sleep quality.`,
        confidence: 0.82,
        relatedMetrics: ['sleep'],
      });
    } else if (stdDev < 0.5 && mean >= 7) {
      insights.push({
        type: 'recommendation',
        title: 'Excellent sleep consistency!',
        description: `Your sleep varies only ±${stdDev.toFixed(1)}h. Great habit!`,
        confidence: 0.88,
        relatedMetrics: ['sleep'],
      });
    }
  }

  // Bedtime consistency analysis - TIMEZONE-AWARE
  const sleepLogs = ctx.logs.filter(l => l.log_type === 'sleep');
  if (sleepLogs.length >= 5) {
    const bedtimesByHour: Record<number, number> = {};
    sleepLogs.forEach(s => {
      // Sleep logs typically record start time
      const hour = getHourInTimezone(s.logged_at, ctx.userTimezone);
      bedtimesByHour[hour] = (bedtimesByHour[hour] || 0) + 1;
    });

    const hoursWithLogs = Object.entries(bedtimesByHour).length;
    if (hoursWithLogs > 1) {
      const consistencyScore = Math.max(...Object.values(bedtimesByHour)) / sleepLogs.length;
      if (consistencyScore < 0.4) {
        insights.push({
          type: 'recommendation',
          title: 'Inconsistent bedtime',
          description: 'Your bedtimes vary widely. A consistent schedule improves sleep quality.',
          confidence: 0.80,
          relatedMetrics: ['sleep'],
        });
      }
    }
  }
  // Sleep vs calendar stress load
  if (ctx.events.length >= 5 && sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    const eventsByDate: Record<string, number> = {};
    ctx.events.filter(e => !e.title.toLowerCase().startsWith('[auto]')).forEach(e => {
      const date = getDateStr(e.start_time);
      eventsByDate[date] = (eventsByDate[date] || 0) + 1;
    });

    let busySleep = 0, busyDays = 0;
    let lightSleep = 0, lightDays = 0;

    Object.entries(eventsByDate).forEach(([date, count]) => {
      const sleep = sleepByDate[date];
      if (!sleep) return;
      if (count >= 4) {
        busySleep += sleep;
        busyDays++;
      } else if (count <= 1) {
        lightSleep += sleep;
        lightDays++;
      }
    });

    if (busyDays >= 2 && lightDays >= 2) {
      const busyAvg = busySleep / busyDays;
      const lightAvg = lightSleep / lightDays;
      if (lightAvg - busyAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'Busy days hurt sleep',
          description: `Days with 4+ events correlate with ${(lightAvg - busyAvg).toFixed(1)}h less sleep.`,
          confidence: 0.75,
          relatedMetrics: ['sleep', 'calendar'],
        });
      }
    }
  }

  // Sleep vs calories (over/under)
  if (ctx.foods.length >= 5 && sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    const caloriesByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.calories) return;
      const date = getDateStr(f.logged_at);
      caloriesByDate[date] = (caloriesByDate[date] || 0) + f.calories;
    });

    const calDays = Object.values(caloriesByDate);
    if (calDays.length >= 3) {
      const avgCal = calDays.reduce((a, b) => a + b, 0) / calDays.length;
      let highCalSleep = 0, highDays = 0;
      let lowCalSleep = 0, lowDays = 0;

      Object.entries(caloriesByDate).forEach(([date, cal]) => {
        const sleep = sleepByDate[date];
        if (!sleep) return;
        if (cal > avgCal * 1.2) {
          highCalSleep += sleep;
          highDays++;
        } else if (cal < avgCal * 0.8) {
          lowCalSleep += sleep;
          lowDays++;
        }
      });

      if (highDays >= 2 && lowDays >= 2) {
        const highAvg = highCalSleep / highDays;
        const lowAvg = lowCalSleep / lowDays;
        const diff = Math.abs(highAvg - lowAvg);
        if (diff > 0.4) {
          const better = highAvg > lowAvg ? 'higher' : 'lower';
          insights.push({
            type: 'correlation',
            title: `${better === 'higher' ? 'Well-fed' : 'Light eating'} days = better sleep`,
            description: `Days with ${better} calorie intake correlate with ${diff.toFixed(1)}h more sleep.`,
            confidence: 0.72,
            relatedMetrics: ['sleep', 'food', 'calories'],
          });
        }
      }
    }
  }

  // Sleep vs sodium intake
  if (ctx.foods.length >= 5 && sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    const sodiumByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.sodium) return;
      const date = getDateStr(f.logged_at);
      sodiumByDate[date] = (sodiumByDate[date] || 0) + f.sodium;
    });

    const sodiumDays = Object.keys(sodiumByDate);
    if (sodiumDays.length >= 3) {
      const avgSodium = Object.values(sodiumByDate).reduce((a, b) => a + b, 0) / sodiumDays.length;
      let highSodiumSleep: number[] = [];
      let lowSodiumSleep: number[] = [];

      sodiumDays.forEach(date => {
        const sodium = sodiumByDate[date];
        const sleep = sleepByDate[date];
        if (!sleep) return;

        if (sodium > avgSodium * 1.3) {
          highSodiumSleep.push(sleep);
        } else if (sodium < avgSodium * 0.7) {
          lowSodiumSleep.push(sleep);
        }
      });

      if (highSodiumSleep.length >= 2 && lowSodiumSleep.length >= 2) {
        const highAvg = highSodiumSleep.reduce((a, b) => a + b, 0) / highSodiumSleep.length;
        const lowAvg = lowSodiumSleep.reduce((a, b) => a + b, 0) / lowSodiumSleep.length;
        if (lowAvg - highAvg > 0.4) {
          insights.push({
            type: 'correlation',
            title: 'High sodium disrupts sleep',
            description: `You sleep ${(lowAvg - highAvg).toFixed(1)}h less on high-sodium days.`,
            confidence: 0.76,
            relatedMetrics: ['sleep', 'food', 'sodium'],
          });
        }
      }
    }
  }
  return insights;
}