import { AnalyzedInsight, AnalysisContext, getDateStr, getHour } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeFoodCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  if (ctx.foods.length < 5) return insights;

  const bristolLogs = ctx.logs.filter(l => l.log_type === 'bristol_stool');
  const symptoms = ctx.logs.filter(l => l.log_type === 'symptom');
  const hrvData = ctx.metrics.filter(m => m.metric_type === 'hrv');
  const hrData = ctx.metrics.filter(m => m.metric_type === 'heart_rate' || m.metric_type === 'resting_hr');
  const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
  const weightData = ctx.metrics.filter(m => m.metric_type === 'weight');

  // Food sodium vs weight next morning
  if (weightData.length >= 5) {
    const weightByDate: Record<string, number> = {};
    weightData.forEach(w => { weightByDate[getDateStr(w.recorded_at)] = w.value; });

    const sodiumByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.sodium) return;
      const date = getDateStr(f.logged_at);
      sodiumByDate[date] = (sodiumByDate[date] || 0) + f.sodium;
    });

    const sodiumDays = Object.keys(sodiumByDate);
    if (sodiumDays.length >= 3) {
      const avgSodium = Object.values(sodiumByDate).reduce((a, b) => a + b, 0) / sodiumDays.length;
      let highSodiumWeightChange = 0, highDays = 0;
      let lowSodiumWeightChange = 0, lowDays = 0;

      sodiumDays.forEach(date => {
        const sodium = sodiumByDate[date];
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        const prevWeight = weightByDate[date];
        const nextWeight = weightByDate[nextDateStr];
        if (!prevWeight || !nextWeight) return;

        const change = nextWeight - prevWeight;
        if (sodium > avgSodium * 1.3) {
          highSodiumWeightChange += change;
          highDays++;
        } else if (sodium < avgSodium * 0.7) {
          lowSodiumWeightChange += change;
          lowDays++;
        }
      });

      if (highDays >= 2 && lowDays >= 2) {
        const highAvg = highSodiumWeightChange / highDays;
        const lowAvg = lowSodiumWeightChange / lowDays;
        if (highAvg - lowAvg > 0.3) {
          insights.push({
            type: 'correlation',
            title: 'Sodium causes water retention',
            description: `High-sodium days show ${(highAvg - lowAvg).toFixed(1)}kg more weight gain overnight.`,
            confidence: 0.79,
            relatedMetrics: ['food', 'weight', 'sodium'],
          });
        }
      }
    }
  }

  // Food sugar vs symptoms
  if (symptoms.length >= 3) {
    const symptomsByDate: Record<string, string[]> = {};
    symptoms.forEach(s => {
      const date = getDateStr(s.logged_at);
      if (!symptomsByDate[date]) symptomsByDate[date] = [];
      symptomsByDate[date].push(s.value.toLowerCase());
    });

    const sugarByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.sugar) return;
      const date = getDateStr(f.logged_at);
      sugarByDate[date] = (sugarByDate[date] || 0) + f.sugar;
    });

    const sugarDays = Object.keys(sugarByDate);
    if (sugarDays.length >= 3) {
      const avgSugar = Object.values(sugarByDate).reduce((a, b) => a + b, 0) / sugarDays.length;
      let highSugarSymptoms = 0, highDays = 0;
      let lowSugarSymptoms = 0, lowDays = 0;

      sugarDays.forEach(date => {
        const sugar = sugarByDate[date];
        const daySymptoms = symptomsByDate[date]?.length || 0;
        if (sugar > avgSugar * 1.3) {
          highSugarSymptoms += daySymptoms;
          highDays++;
        } else if (sugar < avgSugar * 0.7) {
          lowSugarSymptoms += daySymptoms;
          lowDays++;
        }
      });

      if (highDays >= 2 && lowDays >= 2) {
        const highAvg = highSugarSymptoms / highDays;
        const lowAvg = lowSugarSymptoms / lowDays;
        if (highAvg - lowAvg > 0.5) {
          insights.push({
            type: 'correlation',
            title: 'High sugar = more symptoms',
            description: `You report ${((highAvg - lowAvg) * 100 / (lowAvg || 1)).toFixed(0)}% more symptoms on high-sugar days.`,
            confidence: 0.74,
            relatedMetrics: ['food', 'symptom', 'sugar'],
          });
        }
      }
    }
  }

  // Food type tags vs bristol
  if (bristolLogs.length >= 5) {
    const bristolByDate: Record<string, number[]> = {};
    bristolLogs.forEach(b => {
      const date = getDateStr(b.logged_at);
      const type = parseInt(b.value.replace('Type ', '')) || 4;
      if (!bristolByDate[date]) bristolByDate[date] = [];
      bristolByDate[date].push(type);
    });

    // Check dairy correlation
    const dairyDates = new Set(ctx.foods.filter(f => f.contains_dairy).map(f => getDateStr(f.logged_at)));
    let dairyBristol: number[] = [];
    let noDairyBristol: number[] = [];

    Object.entries(bristolByDate).forEach(([date, types]) => {
      const avgType = types.reduce((a, b) => a + b, 0) / types.length;
      if (dairyDates.has(date)) {
        dairyBristol.push(avgType);
      } else {
        noDairyBristol.push(avgType);
      }
    });

    if (dairyBristol.length >= 2 && noDairyBristol.length >= 2) {
      const dairyAvg = dairyBristol.reduce((a, b) => a + b, 0) / dairyBristol.length;
      const noDairyAvg = noDairyBristol.reduce((a, b) => a + b, 0) / noDairyBristol.length;
      // Higher bristol = looser, lower = constipated
      if (dairyAvg - noDairyAvg > 1) {
        insights.push({
          type: 'correlation',
          title: 'Dairy affects digestion',
          description: `Bristol scores are ${(dairyAvg - noDairyAvg).toFixed(1)} points higher (looser) on dairy days.`,
          confidence: 0.78,
          relatedMetrics: ['food', 'bristol', 'dairy'],
        });
      }
    }

    // Check gluten correlation
    const glutenDates = new Set(ctx.foods.filter(f => f.contains_gluten).map(f => getDateStr(f.logged_at)));
    let glutenBristol: number[] = [];
    let noGlutenBristol: number[] = [];

    Object.entries(bristolByDate).forEach(([date, types]) => {
      const avgType = types.reduce((a, b) => a + b, 0) / types.length;
      if (glutenDates.has(date)) {
        glutenBristol.push(avgType);
      } else {
        noGlutenBristol.push(avgType);
      }
    });

    if (glutenBristol.length >= 2 && noGlutenBristol.length >= 2) {
      const glutenAvg = glutenBristol.reduce((a, b) => a + b, 0) / glutenBristol.length;
      const noGlutenAvg = noGlutenBristol.reduce((a, b) => a + b, 0) / noGlutenBristol.length;
      if (Math.abs(glutenAvg - noGlutenAvg) > 1) {
        const direction = glutenAvg > noGlutenAvg ? 'looser' : 'harder';
        insights.push({
          type: 'correlation',
          title: 'Gluten impacts digestion',
          description: `Gluten days correlate with ${direction} stools (${Math.abs(glutenAvg - noGlutenAvg).toFixed(1)} Bristol points).`,
          confidence: 0.75,
          relatedMetrics: ['food', 'bristol', 'gluten'],
        });
      }
    }
  }

  // Fiber estimate vs bristol
  if (bristolLogs.length >= 5) {
    const fiberByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.fiber) return;
      const date = getDateStr(f.logged_at);
      fiberByDate[date] = (fiberByDate[date] || 0) + f.fiber;
    });

    const bristolByDate: Record<string, number> = {};
    bristolLogs.forEach(b => {
      const date = getDateStr(b.logged_at);
      const type = parseInt(b.value.replace('Type ', '')) || 4;
      bristolByDate[date] = type;
    });

    const fiberDays = Object.keys(fiberByDate);
    if (fiberDays.length >= 3) {
      const avgFiber = Object.values(fiberByDate).reduce((a, b) => a + b, 0) / fiberDays.length;
      let highFiberBristol: number[] = [];
      let lowFiberBristol: number[] = [];

      fiberDays.forEach(date => {
        const bristol = bristolByDate[date];
        if (!bristol) return;
        if (fiberByDate[date] > avgFiber * 1.2) {
          highFiberBristol.push(bristol);
        } else if (fiberByDate[date] < avgFiber * 0.8) {
          lowFiberBristol.push(bristol);
        }
      });

      if (highFiberBristol.length >= 2 && lowFiberBristol.length >= 2) {
        const highAvg = highFiberBristol.reduce((a, b) => a + b, 0) / highFiberBristol.length;
        const lowAvg = lowFiberBristol.reduce((a, b) => a + b, 0) / lowFiberBristol.length;
        // Ideal is type 3-4
        const highFromIdeal = Math.abs(highAvg - 3.5);
        const lowFromIdeal = Math.abs(lowAvg - 3.5);
        if (lowFromIdeal - highFromIdeal > 0.5) {
          insights.push({
            type: 'correlation',
            title: 'Fiber improves digestion',
            description: `High-fiber days have more ideal Bristol scores (closer to type 3-4).`,
            confidence: 0.77,
            relatedMetrics: ['food', 'bristol', 'fiber'],
          });
        }
      }
    }
  }

  // Food timing vs sleep
  if (sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    const lateMealDates = new Set<string>();
    ctx.foods.forEach(f => {
      if (getHourInTimezone(f.logged_at, ctx.timezone) >= 21) {
        lateMealDates.add(getDateStr(f.logged_at));
      }
    });

    let lateMealSleep: number[] = [];
    let normalSleep: number[] = [];

    Object.entries(sleepByDate).forEach(([date, sleep]) => {
      if (lateMealDates.has(date)) {
        lateMealSleep.push(sleep);
      } else {
        normalSleep.push(sleep);
      }
    });

    if (lateMealSleep.length >= 2 && normalSleep.length >= 2) {
      const lateAvg = lateMealSleep.reduce((a, b) => a + b, 0) / lateMealSleep.length;
      const normalAvg = normalSleep.reduce((a, b) => a + b, 0) / normalSleep.length;
      if (normalAvg - lateAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'Late meals disrupt sleep',
          description: `Eating after 9pm correlates with ${(normalAvg - lateAvg).toFixed(1)}h less sleep.`,
          confidence: 0.76,
          relatedMetrics: ['food', 'sleep'],
        });
      }
    }
  }

  // Meal timing patterns - TIMEZONE-AWARE
  if (ctx.foods.length >= 8) {
    const mealsByHour: Record<number, number> = {};
    ctx.foods.forEach(f => {
      const hour = getHourInTimezone(f.logged_at, ctx.userTimezone);
      mealsByHour[hour] = (mealsByHour[hour] || 0) + 1;
    });

    const morningMeals = Object.entries(mealsByHour)
      .filter(([h]) => parseInt(h) >= 6 && parseInt(h) < 12)
      .reduce((sum, [, count]) => sum + count, 0);

    const eveningMeals = Object.entries(mealsByHour)
      .filter(([h]) => parseInt(h) >= 18 && parseInt(h) < 24)
      .reduce((sum, [, count]) => sum + count, 0);

    if (morningMeals > 0 && eveningMeals > 0) {
      const mealBalance = eveningMeals / (morningMeals + eveningMeals);
      if (mealBalance > 0.6) {
        insights.push({
          type: 'recommendation',
          title: 'Heavy evening eating pattern',
          description: `${Math.round(mealBalance * 100)}% of meals logged after 6pm. Consider more breakfast/lunch to balance.`,
          confidence: 0.75,
          relatedMetrics: ['food'],
        });
      }
    }
  }
  return insights;
}