import { AnalyzedInsight, AnalysisContext, getDateStr, getHour } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeExerciseCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const exercises = ctx.logs.filter(l => l.log_type === 'exercise');
  console.log(`[Exercise] Found ${exercises.length} exercise logs`);
  if (exercises.length < 3) {
    console.log(`[Exercise] Not enough exercises (need 3+), returning early`);
    return insights;
  }

  const hrData = ctx.metrics.filter(m => m.metric_type === 'heart_rate' || m.metric_type === 'resting_hr');
  const hrvData = ctx.metrics.filter(m => m.metric_type === 'hrv');
  const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
  const symptoms = ctx.logs.filter(l => l.log_type === 'symptom');

  // Group exercises by date
  const exerciseByDate: Record<string, typeof exercises> = {};
  exercises.forEach(e => {
    const date = getDateStr(e.logged_at);
    if (!exerciseByDate[date]) exerciseByDate[date] = [];
    exerciseByDate[date].push(e);
  });

  // Calculate intensity from metadata (sets × reps × weight, or just count)
  const intensityByDate: Record<string, number> = {};
  Object.entries(exerciseByDate).forEach(([date, exs]) => {
    let intensity = 0;
    exs.forEach(e => {
      const meta = e.metadata || {};
      if (meta.sets && meta.reps && meta.weight) {
        intensity += meta.sets * meta.reps * meta.weight;
      } else if (meta.sets && meta.reps) {
        intensity += meta.sets * meta.reps * 10; // bodyweight estimate
      } else {
        intensity += 50; // default per exercise
      }
    });
    intensityByDate[date] = intensity;
  });

  // Exercise intensity vs resting HR
  if (hrData.length >= 5) {
    const hrByDate: Record<string, number> = {};
    hrData.forEach(h => {
      const date = getDateStr(h.recorded_at);
      if (!hrByDate[date] || h.value < hrByDate[date]) {
        hrByDate[date] = h.value; // Use lowest (resting)
      }
    });

    const intensities = Object.values(intensityByDate);
    if (intensities.length >= 3) {
      const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      let highIntensityHR: number[] = [];
      let lowIntensityHR: number[] = [];

      Object.entries(intensityByDate).forEach(([date, intensity]) => {
        // Check next day HR (recovery)
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        const hr = hrByDate[nextDateStr];
        if (!hr) return;

        if (intensity > avgIntensity * 1.3) {
          highIntensityHR.push(hr);
        } else if (intensity < avgIntensity * 0.7) {
          lowIntensityHR.push(hr);
        }
      });

      if (highIntensityHR.length >= 2 && lowIntensityHR.length >= 2) {
        const highAvg = highIntensityHR.reduce((a, b) => a + b, 0) / highIntensityHR.length;
        const lowAvg = lowIntensityHR.reduce((a, b) => a + b, 0) / lowIntensityHR.length;
        if (highAvg - lowAvg > 3) {
          insights.push({
            type: 'correlation',
            title: 'Intense workouts elevate resting HR',
            description: `Resting HR is ${Math.round(highAvg - lowAvg)} bpm higher the day after intense workouts.`,
            confidence: 0.78,
            relatedMetrics: ['exercise', 'heart_rate'],
          });
        }
      }
    }
  }

  // Exercise intensity vs HRV
  if (hrvData.length >= 5) {
    const hrvByDate: Record<string, number> = {};
    hrvData.forEach(h => { hrvByDate[getDateStr(h.recorded_at)] = h.value; });

    const intensities = Object.values(intensityByDate);
    if (intensities.length >= 3) {
      const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      let highIntensityHRV: number[] = [];
      let lowIntensityHRV: number[] = [];

      Object.entries(intensityByDate).forEach(([date, intensity]) => {
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        const hrv = hrvByDate[nextDateStr];
        if (!hrv) return;

        if (intensity > avgIntensity * 1.3) {
          highIntensityHRV.push(hrv);
        } else if (intensity < avgIntensity * 0.7) {
          lowIntensityHRV.push(hrv);
        }
      });

      if (highIntensityHRV.length >= 2 && lowIntensityHRV.length >= 2) {
        const highAvg = highIntensityHRV.reduce((a, b) => a + b, 0) / highIntensityHRV.length;
        const lowAvg = lowIntensityHRV.reduce((a, b) => a + b, 0) / lowIntensityHRV.length;
        if (lowAvg - highAvg > 5) {
          insights.push({
            type: 'correlation',
            title: 'Intense exercise lowers HRV',
            description: `HRV drops ${Math.round(lowAvg - highAvg)}ms the day after intense workouts. Allow recovery.`,
            confidence: 0.80,
            relatedMetrics: ['exercise', 'hrv'],
          });
        }
      }
    }
  }

  // Exercise timing vs sleep quality
  if (sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let morningSleep: number[] = [];
    let eveningSleep: number[] = [];

    exercises.forEach(e => {
      const date = getDateStr(e.logged_at);
      const hour = getHourInTimezone(e.logged_at, ctx.timezone);
      const sleep = sleepByDate[date];
      if (!sleep) return;

      if (hour < 12) {
        morningSleep.push(sleep);
      } else if (hour >= 18) {
        eveningSleep.push(sleep);
      }
    });

    if (morningSleep.length >= 2 && eveningSleep.length >= 2) {
      const morningAvg = morningSleep.reduce((a, b) => a + b, 0) / morningSleep.length;
      const eveningAvg = eveningSleep.reduce((a, b) => a + b, 0) / eveningSleep.length;
      if (morningAvg - eveningAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'Morning workouts = better sleep',
          description: `You sleep ${(morningAvg - eveningAvg).toFixed(1)}h more on morning vs evening workout days.`,
          confidence: 0.77,
          relatedMetrics: ['exercise', 'sleep'],
        });
      }
    }
  }

  // Exercise gaps vs HRV
  if (hrvData.length >= 5) {
    const hrvByDate: Record<string, number> = {};
    hrvData.forEach(h => { hrvByDate[getDateStr(h.recorded_at)] = h.value; });

    const exerciseDates = Object.keys(exerciseByDate).sort();
    const restDays: string[] = [];
    const exerciseDays: string[] = [];

    // Find rest days (no exercise)
    const allDates = Object.keys(hrvByDate);
    allDates.forEach(date => {
      if (exerciseByDate[date]) {
        exerciseDays.push(date);
      } else {
        restDays.push(date);
      }
    });

    if (restDays.length >= 2 && exerciseDays.length >= 2) {
      const restHRV = restDays.map(d => hrvByDate[d]).filter(Boolean);
      const exerciseHRV = exerciseDays.map(d => hrvByDate[d]).filter(Boolean);

      if (restHRV.length >= 2 && exerciseHRV.length >= 2) {
        const restAvg = restHRV.reduce((a, b) => a + b, 0) / restHRV.length;
        const exAvg = exerciseHRV.reduce((a, b) => a + b, 0) / exerciseHRV.length;
        if (restAvg - exAvg > 5) {
          insights.push({
            type: 'correlation',
            title: 'Rest days boost HRV',
            description: `Your HRV is ${Math.round(restAvg - exAvg)}ms higher on rest days. Recovery matters!`,
            confidence: 0.76,
            relatedMetrics: ['exercise', 'hrv'],
          });
        }
      }
    }
  }

  // Exercise type vs symptoms
  if (symptoms.length >= 3) {
    const symptomsByDate: Record<string, string[]> = {};
    symptoms.forEach(s => {
      const date = getDateStr(s.logged_at);
      if (!symptomsByDate[date]) symptomsByDate[date] = [];
      symptomsByDate[date].push(s.value.toLowerCase());
    });

    // Group by exercise name
    const exerciseSymptoms: Record<string, { exerciseDays: number; symptomDays: number }> = {};
    Object.entries(exerciseByDate).forEach(([date, exs]) => {
      const daySymptoms = symptomsByDate[date] || [];
      exs.forEach(e => {
        const name = e.value.toLowerCase();
        if (!exerciseSymptoms[name]) exerciseSymptoms[name] = { exerciseDays: 0, symptomDays: 0 };
        exerciseSymptoms[name].exerciseDays++;
        if (daySymptoms.length > 0) exerciseSymptoms[name].symptomDays++;
      });
    });

    Object.entries(exerciseSymptoms).forEach(([name, data]) => {
      if (data.exerciseDays >= 3) {
        const symptomRate = data.symptomDays / data.exerciseDays;
        if (symptomRate > 0.5) {
          insights.push({
            type: 'correlation',
            title: `${name} may trigger symptoms`,
            description: `You report symptoms ${Math.round(symptomRate * 100)}% of days after ${name}.`,
            confidence: 0.70,
            relatedMetrics: ['exercise', 'symptom'],
          });
        }
      }
    });
  }

  // Strong workout week
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = exercises.filter(e => new Date(e.logged_at).getTime() > weekAgo);
  const uniqueDays = new Set(thisWeek.map(e => getDateStr(e.logged_at)));
  console.log(`[Exercise] Strong workout week check: ${thisWeek.length} exercises in last 7 days, ${uniqueDays.size} unique days`);
  if (uniqueDays.size >= 4) {
    console.log(`[Exercise] Strong workout week insight generated with ${uniqueDays.size} days`);
    insights.push({
      type: 'recommendation',
      title: 'Strong workout week!',
      description: `${uniqueDays.size} workout days this week. Remember to include rest for recovery.`,
      confidence: 0.85,
      relatedMetrics: ['exercise'],
    });
  }

  // Exercise timing patterns - TIMEZONE-AWARE
  if (exercises.length >= 5) {
    const exerciseByHour: Record<number, number> = {};
    exercises.forEach(e => {
      const hour = getHourInTimezone(e.logged_at, ctx.timezone);
      exerciseByHour[hour] = (exerciseByHour[hour] || 0) + 1;
    });

    const morningWorkouts = Object.entries(exerciseByHour)
      .filter(([h]) => parseInt(h) >= 5 && parseInt(h) < 12)
      .reduce((sum, [, count]) => sum + count, 0);

    const eveningWorkouts = Object.entries(exerciseByHour)
      .filter(([h]) => parseInt(h) >= 17 && parseInt(h) < 22)
      .reduce((sum, [, count]) => sum + count, 0);

    // Log exercise timing patterns for debugging
    console.log(`[Exercise Timing] Morning: ${morningWorkouts}, Evening: ${eveningWorkouts}`);
  }
  return insights;
}