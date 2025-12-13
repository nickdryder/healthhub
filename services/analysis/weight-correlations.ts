import { AnalyzedInsight, AnalysisContext, getDateStr } from './types';
import { getHourInTimezone } from '../timezone-utils';

// Calculate 7-day moving average for weight data
function calculateWeightMovingAvg(weightByDate: Record<string, number>): Record<string, number> {
  const sortedDates = Object.keys(weightByDate).sort();
  const movingAvg: Record<string, number> = {};

  sortedDates.forEach((date, i) => {
    const start = Math.max(0, i - 6);
    const window = sortedDates.slice(start, i + 1).map(d => weightByDate[d]);
    movingAvg[date] = window.reduce((a, b) => a + b, 0) / window.length;
  });

  return movingAvg;
}

export function analyzeWeightCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const weightData = ctx.metrics.filter(m => m.metric_type === 'weight');
  if (weightData.length < 5) return insights;

  // Build raw weight by date
  const rawWeightByDate: Record<string, number> = {};
  weightData.forEach(w => { rawWeightByDate[getDateStr(w.recorded_at)] = w.value; });

  // Calculate 7-day moving average
  const weightByDate = calculateWeightMovingAvg(rawWeightByDate);
  const sortedDates = Object.keys(weightByDate).sort();

  // Weight vs sodium (using moving average)
  if (ctx.foods.length >= 5) {
    const sodiumByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.sodium) return;
      const date = getDateStr(f.logged_at);
      sodiumByDate[date] = (sodiumByDate[date] || 0) + f.sodium;
    });

    const sodiumDays = Object.keys(sodiumByDate);
    if (sodiumDays.length >= 3) {
      const avgSodium = Object.values(sodiumByDate).reduce((a, b) => a + b, 0) / sodiumDays.length;
      let highSodiumChange: number[] = [];
      let lowSodiumChange: number[] = [];

      sodiumDays.forEach(date => {
        const sodium = sodiumByDate[date];
        const todayWeight = weightByDate[date];
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        const nextWeight = weightByDate[nextDateStr];
        if (!todayWeight || !nextWeight) return;
        const change = nextWeight - todayWeight;

        if (sodium > avgSodium * 1.3) {
          highSodiumChange.push(change);
        } else if (sodium < avgSodium * 0.7) {
          lowSodiumChange.push(change);
        }
      });

      if (highSodiumChange.length >= 2 && lowSodiumChange.length >= 2) {
        const highAvg = highSodiumChange.reduce((a, b) => a + b, 0) / highSodiumChange.length;
        const lowAvg = lowSodiumChange.reduce((a, b) => a + b, 0) / lowSodiumChange.length;
        if (highAvg - lowAvg > 0.15) {
          insights.push({
            type: 'correlation',
            title: 'Sodium causes water weight',
            description: `Weight (7-day avg) increases ${(highAvg - lowAvg).toFixed(2)}kg more after high-sodium meals.`,
            confidence: 0.79,
            relatedMetrics: ['weight', 'food', 'sodium'],
          });
        }
      }
    }
  }

  // Weight vs sleep (using moving average)
  const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
  if (sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let poorSleepChange: number[] = [];
    let goodSleepChange: number[] = [];

    sortedDates.forEach((date, i) => {
      if (i === 0) return;
      const prevDate = sortedDates[i - 1];
      const sleep = sleepByDate[prevDate];
      if (!sleep) return;

      const change = weightByDate[date] - weightByDate[prevDate];
      if (sleep < 6) {
        poorSleepChange.push(change);
      } else if (sleep >= 7.5) {
        goodSleepChange.push(change);
      }
    });

    if (poorSleepChange.length >= 2 && goodSleepChange.length >= 2) {
      const poorAvg = poorSleepChange.reduce((a, b) => a + b, 0) / poorSleepChange.length;
      const goodAvg = goodSleepChange.reduce((a, b) => a + b, 0) / goodSleepChange.length;
      if (poorAvg - goodAvg > 0.08) {
        insights.push({
          type: 'correlation',
          title: 'Poor sleep affects weight',
          description: `Weight (7-day avg) trends ${(poorAvg - goodAvg).toFixed(2)}kg higher after poor sleep.`,
          confidence: 0.74,
          relatedMetrics: ['weight', 'sleep'],
        });
      }
    }
  }

  // Weight vs food timing (using moving average) - TIMEZONE-AWARE
  if (ctx.foods.length >= 5) {
    const lateMealDates = new Set<string>();
    ctx.foods.forEach(f => {
      if (getHourInTimezone(f.logged_at, ctx.userTimezone) >= 21) {
        lateMealDates.add(getDateStr(f.logged_at));
      }
    });

    let lateEatChange: number[] = [];
    let normalEatChange: number[] = [];

    sortedDates.forEach((date, i) => {
      if (i === 0) return;
      const prevDate = sortedDates[i - 1];
      const change = weightByDate[date] - weightByDate[prevDate];

      if (lateMealDates.has(prevDate)) {
        lateEatChange.push(change);
      } else {
        normalEatChange.push(change);
      }
    });

    if (lateEatChange.length >= 2 && normalEatChange.length >= 2) {
      const lateAvg = lateEatChange.reduce((a, b) => a + b, 0) / lateEatChange.length;
      const normalAvg = normalEatChange.reduce((a, b) => a + b, 0) / normalEatChange.length;
      if (lateAvg - normalAvg > 0.1) {
        insights.push({
          type: 'correlation',
          title: 'Late eating affects weight',
          description: `Weight (7-day avg) trends ${(lateAvg - normalAvg).toFixed(2)}kg higher after eating past 9pm.`,
          confidence: 0.73,
          relatedMetrics: ['weight', 'food'],
        });
      }
    }
  }

  // Weight vs calorie intake (using moving average)
  if (ctx.foods.length >= 5) {
    const caloriesByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.calories) return;
      const date = getDateStr(f.logged_at);
      caloriesByDate[date] = (caloriesByDate[date] || 0) + f.calories;
    });

    const calDays = Object.values(caloriesByDate);
    if (calDays.length >= 5) {
      const avgCal = calDays.reduce((a, b) => a + b, 0) / calDays.length;
      let overEatChange: number[] = [];
      let underEatChange: number[] = [];

      sortedDates.forEach((date, i) => {
        if (i === 0) return;
        const prevDate = sortedDates[i - 1];
        const cal = caloriesByDate[prevDate];
        if (!cal) return;

        const change = weightByDate[date] - weightByDate[prevDate];
        if (cal > avgCal * 1.3) {
          overEatChange.push(change);
        } else if (cal < avgCal * 0.7) {
          underEatChange.push(change);
        }
      });

      if (overEatChange.length >= 2 && underEatChange.length >= 2) {
        const overAvg = overEatChange.reduce((a, b) => a + b, 0) / overEatChange.length;
        const underAvg = underEatChange.reduce((a, b) => a + b, 0) / underEatChange.length;
        if (overAvg - underAvg > 0.15) {
          insights.push({
            type: 'correlation',
            title: 'Calories affect weight trend',
            description: `Weight (7-day avg) trends ${(overAvg - underAvg).toFixed(2)}kg more on surplus vs deficit days.`,
            confidence: 0.78,
            relatedMetrics: ['weight', 'food', 'calories'],
          });
        }
      }
    }
  }

  // Weight trend (using 7-day moving average)
  if (sortedDates.length >= 14) {
    const firstWeek = sortedDates.slice(0, 7).map(d => weightByDate[d]);
    const lastWeek = sortedDates.slice(-7).map(d => weightByDate[d]);
    const firstAvg = firstWeek.reduce((a, b) => a + b, 0) / firstWeek.length;
    const lastAvg = lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length;
    const diff = lastAvg - firstAvg;

    if (Math.abs(diff) > 0.5) {
      const direction = diff > 0 ? 'gained' : 'lost';
      insights.push({
        type: 'prediction',
        title: `Weight trending ${diff > 0 ? 'up' : 'down'}`,
        description: `You've ${direction} ~${Math.abs(diff).toFixed(1)}kg (7-day avg) over the tracking period.`,
        confidence: 0.85,
        relatedMetrics: ['weight'],
      });
    }
  }

  return insights;
}
