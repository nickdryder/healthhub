import { AnalyzedInsight, AnalysisContext, getDateStr } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeStepsCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const steps = ctx.metrics.filter(m => m.metric_type === 'steps');
  if (steps.length < 5) return insights;

  const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
  const hrvData = ctx.metrics.filter(m => m.metric_type === 'hrv');
  const symptoms = ctx.logs.filter(l => l.log_type === 'symptom');

  const stepsByDate: Record<string, number> = {};
  steps.forEach(s => { stepsByDate[getDateStr(s.recorded_at)] = s.value; });

  const avgSteps = steps.reduce((sum, m) => sum + m.value, 0) / steps.length;

  // Activity level insight
  if (avgSteps < 5000) {
    insights.push({
      type: 'recommendation',
      title: 'Increase daily movement',
      description: `Your average is ${Math.round(avgSteps).toLocaleString()} steps. Aim for 7,000-10,000.`,
      confidence: 0.80,
      relatedMetrics: ['steps'],
    });
  } else if (avgSteps >= 10000) {
    insights.push({
      type: 'recommendation',
      title: 'Great activity level!',
      description: `Averaging ${Math.round(avgSteps).toLocaleString()} steps/day. Excellent movement!`,
      confidence: 0.90,
      relatedMetrics: ['steps'],
    });
  }

  // Steps vs mood symptoms
  if (symptoms.length >= 5) {
    const moodSymptoms = ['anxiety', 'stress', 'depression', 'fatigue', 'low energy', 'irritability', 'mood'];
    const symptomsByDate: Record<string, number> = {};
    symptoms.forEach(s => {
      const date = getDateStr(s.logged_at);
      const isMood = moodSymptoms.some(m => s.value.toLowerCase().includes(m));
      if (isMood) {
        symptomsByDate[date] = (symptomsByDate[date] || 0) + 1;
      }
    });

    let highStepsMood: number[] = [];
    let lowStepsMood: number[] = [];

    Object.entries(stepsByDate).forEach(([date, stepCount]) => {
      const moodCount = symptomsByDate[date] || 0;
      if (stepCount > avgSteps * 1.2) {
        highStepsMood.push(moodCount);
      } else if (stepCount < avgSteps * 0.8) {
        lowStepsMood.push(moodCount);
      }
    });

    if (highStepsMood.length >= 2 && lowStepsMood.length >= 2) {
      const highAvg = highStepsMood.reduce((a, b) => a + b, 0) / highStepsMood.length;
      const lowAvg = lowStepsMood.reduce((a, b) => a + b, 0) / lowStepsMood.length;
      if (lowAvg - highAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'More steps = better mood',
          description: `You report ${Math.round((lowAvg - highAvg) * 100 / (highAvg || 1))}% fewer mood symptoms on active days.`,
          confidence: 0.79,
          relatedMetrics: ['steps', 'symptom', 'mood'],
        });
      }
    }
  }

  // Steps vs sleep quality
  if (sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let highStepsSleep: number[] = [];
    let lowStepsSleep: number[] = [];

    Object.entries(stepsByDate).forEach(([date, stepCount]) => {
      const sleep = sleepByDate[date];
      if (!sleep) return;
      if (stepCount > avgSteps * 1.2) {
        highStepsSleep.push(sleep);
      } else if (stepCount < avgSteps * 0.8) {
        lowStepsSleep.push(sleep);
      }
    });

    if (highStepsSleep.length >= 2 && lowStepsSleep.length >= 2) {
      const highAvg = highStepsSleep.reduce((a, b) => a + b, 0) / highStepsSleep.length;
      const lowAvg = lowStepsSleep.reduce((a, b) => a + b, 0) / lowStepsSleep.length;
      if (highAvg - lowAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'Active days = better sleep',
          description: `You sleep ${(highAvg - lowAvg).toFixed(1)}h more on high-step days.`,
          confidence: 0.81,
          relatedMetrics: ['steps', 'sleep'],
        });
      }
    }
  }

  // Steps vs HRV
  if (hrvData.length >= 5) {
    const hrvByDate: Record<string, number> = {};
    hrvData.forEach(h => { hrvByDate[getDateStr(h.recorded_at)] = h.value; });

    let highStepsHRV: number[] = [];
    let lowStepsHRV: number[] = [];

    Object.entries(stepsByDate).forEach(([date, stepCount]) => {
      const hrv = hrvByDate[date];
      if (!hrv) return;
      if (stepCount > avgSteps * 1.2) {
        highStepsHRV.push(hrv);
      } else if (stepCount < avgSteps * 0.8) {
        lowStepsHRV.push(hrv);
      }
    });

    if (highStepsHRV.length >= 2 && lowStepsHRV.length >= 2) {
      const highAvg = highStepsHRV.reduce((a, b) => a + b, 0) / highStepsHRV.length;
      const lowAvg = lowStepsHRV.reduce((a, b) => a + b, 0) / lowStepsHRV.length;
      if (highAvg - lowAvg > 3) {
        insights.push({
          type: 'correlation',
          title: 'Walking boosts HRV',
          description: `Your HRV is ${Math.round(highAvg - lowAvg)}ms higher on active days.`,
          confidence: 0.77,
          relatedMetrics: ['steps', 'hrv'],
        });
      }
    }
  }

  // Steps vs calories (if available)
  const caloriesBurned = ctx.metrics.filter(m => m.metric_type === 'calories_burned' || m.metric_type === 'active_calories');
  if (caloriesBurned.length >= 5) {
    const caloriesByDate: Record<string, number> = {};
    caloriesBurned.forEach(c => { caloriesByDate[getDateStr(c.recorded_at)] = c.value; });

    // Calculate correlation
    const pairs: [number, number][] = [];
    Object.entries(stepsByDate).forEach(([date, stepCount]) => {
      const cal = caloriesByDate[date];
      if (cal) pairs.push([stepCount, cal]);
    });

    if (pairs.length >= 5) {
      const avgStep = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
      const avgCal = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
      // Simple correlation check
      let posCorr = 0, negCorr = 0;
      pairs.forEach(([step, cal]) => {
        if ((step > avgStep && cal > avgCal) || (step < avgStep && cal < avgCal)) {
          posCorr++;
        } else {
          negCorr++;
        }
      });

      if (posCorr / pairs.length > 0.7) {
        insights.push({
          type: 'correlation',
          title: 'Steps predict calorie burn',
          description: `More steps strongly correlate with calories burned. Keep moving!`,
          confidence: 0.85,
          relatedMetrics: ['steps', 'calories'],
        });
      }
    }
  }

  // Steps vs weather
  if (ctx.weather.length >= 5) {
    const weatherByDate: Record<string, typeof ctx.weather[0]> = {};
    ctx.weather.forEach(w => { weatherByDate[w.date] = w; });

    // Rain/precipitation correlation
    let rainyDaySteps: number[] = [];
    let dryDaySteps: number[] = [];

    Object.entries(stepsByDate).forEach(([date, stepCount]) => {
      const weather = weatherByDate[date];
      if (!weather) return;
      if (weather.precipitation_mm > 1) {
        rainyDaySteps.push(stepCount);
      } else if (weather.precipitation_mm === 0) {
        dryDaySteps.push(stepCount);
      }
    });

    if (rainyDaySteps.length >= 2 && dryDaySteps.length >= 2) {
      const rainyAvg = rainyDaySteps.reduce((a, b) => a + b, 0) / rainyDaySteps.length;
      const dryAvg = dryDaySteps.reduce((a, b) => a + b, 0) / dryDaySteps.length;
      if (dryAvg - rainyAvg > 1000) {
        insights.push({
          type: 'correlation',
          title: 'Rain reduces activity',
          description: `You walk ${Math.round(dryAvg - rainyAvg).toLocaleString()} fewer steps on rainy days.`,
          confidence: 0.79,
          relatedMetrics: ['steps', 'weather'],
        });
      }
    }

    // Temperature correlation
    const avgTemp = ctx.weather.reduce((s, w) => s + w.temperature_high, 0) / ctx.weather.length;
    let hotDaySteps: number[] = [];
    let niceDaySteps: number[] = [];
    let coldDaySteps: number[] = [];

    Object.entries(stepsByDate).forEach(([date, stepCount]) => {
      const weather = weatherByDate[date];
      if (!weather) return;
      if (weather.temperature_high > 30) {
        hotDaySteps.push(stepCount);
      } else if (weather.temperature_high >= 15 && weather.temperature_high <= 25) {
        niceDaySteps.push(stepCount);
      } else if (weather.temperature_high < 5) {
        coldDaySteps.push(stepCount);
      }
    });

    if (niceDaySteps.length >= 2 && (hotDaySteps.length >= 2 || coldDaySteps.length >= 2)) {
      const niceAvg = niceDaySteps.reduce((a, b) => a + b, 0) / niceDaySteps.length;

      if (hotDaySteps.length >= 2) {
        const hotAvg = hotDaySteps.reduce((a, b) => a + b, 0) / hotDaySteps.length;
        if (niceAvg - hotAvg > 1500) {
          insights.push({
            type: 'correlation',
            title: 'Heat reduces activity',
            description: `You walk ${Math.round(niceAvg - hotAvg).toLocaleString()} fewer steps when it's over 30°C.`,
            confidence: 0.76,
            relatedMetrics: ['steps', 'weather'],
          });
        }
      }

      if (coldDaySteps.length >= 2) {
        const coldAvg = coldDaySteps.reduce((a, b) => a + b, 0) / coldDaySteps.length;
        if (niceAvg - coldAvg > 1500) {
          insights.push({
            type: 'correlation',
            title: 'Cold reduces activity',
            description: `You walk ${Math.round(niceAvg - coldAvg).toLocaleString()} fewer steps when it's below 5°C.`,
            confidence: 0.76,
            relatedMetrics: ['steps', 'weather'],
          });
        }
      }
    }
  }
  return insights;
}