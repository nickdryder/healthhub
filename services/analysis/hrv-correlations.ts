import { AnalyzedInsight, AnalysisContext, getDateStr } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeHRVCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const hrvData = ctx.metrics.filter(m => m.metric_type === 'hrv');
  const hrData = ctx.metrics.filter(m => m.metric_type === 'heart_rate' || m.metric_type === 'resting_hr');

  // Morning vs evening HRV patterns - TIMEZONE-AWARE
  if (hrvData.length >= 5) {
    const morningHRV: number[] = [];
    const eveningHRV: number[] = [];

    hrvData.forEach(h => {
      const hour = getHourInTimezone(h.recorded_at, ctx.userTimezone);
      if (hour >= 5 && hour < 12) {
        morningHRV.push(h.value);
      } else if (hour >= 18 && hour < 24) {
        eveningHRV.push(h.value);
      }
    });

    if (morningHRV.length >= 2 && eveningHRV.length >= 2) {
      const morningAvg = morningHRV.reduce((a, b) => a + b, 0) / morningHRV.length;
      const eveningAvg = eveningHRV.reduce((a, b) => a + b, 0) / eveningHRV.length;

      console.log(`[HRV Timing] Morning avg: ${morningAvg.toFixed(0)}, Evening avg: ${eveningAvg.toFixed(0)}`);
    }
  }

  // HRV correlations
  if (hrvData.length >= 5) {
    const hrvByDate: Record<string, number> = {};
    hrvData.forEach(h => { hrvByDate[getDateStr(h.recorded_at)] = h.value; });
    const avgHRV = hrvData.reduce((s, h) => s + h.value, 0) / hrvData.length;

    // HRV vs sleep
    const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
    if (sleepData.length >= 5) {
      const sleepByDate: Record<string, number> = {};
      sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

      let goodSleepHRV: number[] = [];
      let poorSleepHRV: number[] = [];

      Object.entries(sleepByDate).forEach(([date, sleep]) => {
        const hrv = hrvByDate[date];
        if (!hrv) return;
        if (sleep >= 7) {
          goodSleepHRV.push(hrv);
        } else if (sleep < 6) {
          poorSleepHRV.push(hrv);
        }
      });

      if (goodSleepHRV.length >= 2 && poorSleepHRV.length >= 2) {
        const goodAvg = goodSleepHRV.reduce((a, b) => a + b, 0) / goodSleepHRV.length;
        const poorAvg = poorSleepHRV.reduce((a, b) => a + b, 0) / poorSleepHRV.length;
        if (goodAvg - poorAvg > 5) {
          insights.push({
            type: 'correlation',
            title: 'Sleep boosts HRV',
            description: `Your HRV is ${Math.round(goodAvg - poorAvg)}ms higher after 7+ hours of sleep.`,
            confidence: 0.83,
            relatedMetrics: ['hrv', 'sleep'],
          });
        }
      }
    }

    // HRV vs stress-heavy calendar days
    if (ctx.events.length >= 5) {
      const eventsByDate: Record<string, number> = {};
      ctx.events.filter(e => !e.title.toLowerCase().startsWith('[auto]')).forEach(e => {
        const date = getDateStr(e.start_time);
        eventsByDate[date] = (eventsByDate[date] || 0) + 1;
      });

      let busyDayHRV: number[] = [];
      let lightDayHRV: number[] = [];

      Object.entries(eventsByDate).forEach(([date, count]) => {
        const hrv = hrvByDate[date];
        if (!hrv) return;
        if (count >= 4) {
          busyDayHRV.push(hrv);
        } else if (count <= 1) {
          lightDayHRV.push(hrv);
        }
      });

      if (busyDayHRV.length >= 2 && lightDayHRV.length >= 2) {
        const busyAvg = busyDayHRV.reduce((a, b) => a + b, 0) / busyDayHRV.length;
        const lightAvg = lightDayHRV.reduce((a, b) => a + b, 0) / lightDayHRV.length;
        if (lightAvg - busyAvg > 5) {
          insights.push({
            type: 'correlation',
            title: 'Busy days stress your body',
            description: `HRV drops ${Math.round(lightAvg - busyAvg)}ms on days with 4+ calendar events.`,
            confidence: 0.76,
            relatedMetrics: ['hrv', 'calendar'],
          });
        }
      }
    }

    // HRV vs food tags (dairy, gluten)
    if (ctx.foods.length >= 5) {
      const dairyDates = new Set(ctx.foods.filter(f => f.contains_dairy).map(f => getDateStr(f.logged_at)));
      let dairyHRV: number[] = [];
      let noDairyHRV: number[] = [];

      Object.entries(hrvByDate).forEach(([date, hrv]) => {
        if (dairyDates.has(date)) {
          dairyHRV.push(hrv);
        } else {
          noDairyHRV.push(hrv);
        }
      });

      if (dairyHRV.length >= 2 && noDairyHRV.length >= 2) {
        const dairyAvg = dairyHRV.reduce((a, b) => a + b, 0) / dairyHRV.length;
        const noDairyAvg = noDairyHRV.reduce((a, b) => a + b, 0) / noDairyHRV.length;
        if (noDairyAvg - dairyAvg > 5) {
          insights.push({
            type: 'correlation',
            title: 'Dairy may affect HRV',
            description: `Your HRV is ${Math.round(noDairyAvg - dairyAvg)}ms lower on days with dairy.`,
            confidence: 0.72,
            relatedMetrics: ['hrv', 'food', 'dairy'],
          });
        }
      }
    }

    // HRV vs exercise recovery
    const exercises = ctx.logs.filter(l => l.log_type === 'exercise');
    if (exercises.length >= 3) {
      const exerciseDates = new Set(exercises.map(e => getDateStr(e.logged_at)));
      let exerciseDayHRV: number[] = [];
      let restDayHRV: number[] = [];

      Object.entries(hrvByDate).forEach(([date, hrv]) => {
        if (exerciseDates.has(date)) {
          exerciseDayHRV.push(hrv);
        } else {
          restDayHRV.push(hrv);
        }
      });

      if (exerciseDayHRV.length >= 2 && restDayHRV.length >= 2) {
        const exAvg = exerciseDayHRV.reduce((a, b) => a + b, 0) / exerciseDayHRV.length;
        const restAvg = restDayHRV.reduce((a, b) => a + b, 0) / restDayHRV.length;
        if (restAvg - exAvg > 5) {
          insights.push({
            type: 'correlation',
            title: 'Exercise temporarily lowers HRV',
            description: `HRV is ${Math.round(restAvg - exAvg)}ms higher on rest days. Recovery is important!`,
            confidence: 0.79,
            relatedMetrics: ['hrv', 'exercise'],
          });
        }
      }
    }

    // HRV vs caffeine (already in caffeine file, but add reverse)
    const caffeineLogs = ctx.logs.filter(l => l.log_type === 'caffeine');
    if (caffeineLogs.length >= 5) {
      const caffeineByDate: Record<string, number> = {};
      caffeineLogs.forEach(c => {
        const date = getDateStr(c.logged_at);
        const amt = parseInt(c.value) || 100;
        caffeineByDate[date] = (caffeineByDate[date] || 0) + amt;
      });

      const avgCaffeine = Object.values(caffeineByDate).reduce((a, b) => a + b, 0) / Object.keys(caffeineByDate).length;
      let noCaffeineHRV: number[] = [];

      Object.entries(hrvByDate).forEach(([date, hrv]) => {
        if (!caffeineByDate[date]) {
          noCaffeineHRV.push(hrv);
        }
      });

      if (noCaffeineHRV.length >= 2) {
        const noCaffeineAvg = noCaffeineHRV.reduce((a, b) => a + b, 0) / noCaffeineHRV.length;
        if (noCaffeineAvg - avgHRV > 5) {
          insights.push({
            type: 'correlation',
            title: 'No caffeine = higher HRV',
            description: `Your HRV is ${Math.round(noCaffeineAvg - avgHRV)}ms higher on caffeine-free days.`,
            confidence: 0.75,
            relatedMetrics: ['hrv', 'caffeine'],
          });
        }
      }
    }

    // HRV vs sodium
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
        let highSodiumHRV: number[] = [];
        let lowSodiumHRV: number[] = [];

        sodiumDays.forEach(date => {
          const hrv = hrvByDate[date];
          if (!hrv) return;
          if (sodiumByDate[date] > avgSodium * 1.3) {
            highSodiumHRV.push(hrv);
          } else if (sodiumByDate[date] < avgSodium * 0.7) {
            lowSodiumHRV.push(hrv);
          }
        });

        if (highSodiumHRV.length >= 2 && lowSodiumHRV.length >= 2) {
          const highAvg = highSodiumHRV.reduce((a, b) => a + b, 0) / highSodiumHRV.length;
          const lowAvg = lowSodiumHRV.reduce((a, b) => a + b, 0) / lowSodiumHRV.length;
          if (lowAvg - highAvg > 4) {
            insights.push({
              type: 'correlation',
              title: 'Sodium lowers HRV',
              description: `High-sodium days show ${Math.round(lowAvg - highAvg)}ms lower HRV.`,
              confidence: 0.73,
              relatedMetrics: ['hrv', 'food', 'sodium'],
            });
          }
        }
      }
    }

    // HRV vs steps
    const steps = ctx.metrics.filter(m => m.metric_type === 'steps');
    if (steps.length >= 5) {
      const stepsByDate: Record<string, number> = {};
      steps.forEach(s => { stepsByDate[getDateStr(s.recorded_at)] = s.value; });
      const avgSteps = steps.reduce((s, m) => s + m.value, 0) / steps.length;

      let activeHRV: number[] = [];
      let sedentaryHRV: number[] = [];

      Object.entries(hrvByDate).forEach(([date, hrv]) => {
        const daySteps = stepsByDate[date];
        if (!daySteps) return;
        if (daySteps > avgSteps * 1.2) {
          activeHRV.push(hrv);
        } else if (daySteps < avgSteps * 0.6) {
          sedentaryHRV.push(hrv);
        }
      });

      if (activeHRV.length >= 2 && sedentaryHRV.length >= 2) {
        const activeAvg = activeHRV.reduce((a, b) => a + b, 0) / activeHRV.length;
        const sedentaryAvg = sedentaryHRV.reduce((a, b) => a + b, 0) / sedentaryHRV.length;
        if (activeAvg - sedentaryAvg > 4) {
          insights.push({
            type: 'correlation',
            title: 'Active days boost HRV',
            description: `HRV is ${Math.round(activeAvg - sedentaryAvg)}ms higher on high-step days.`,
            confidence: 0.78,
            relatedMetrics: ['hrv', 'steps'],
          });
        }
      }
    }

    // HRV vs weight (using 7-day average)
    const weightData = ctx.metrics.filter(m => m.metric_type === 'weight');
    if (weightData.length >= 7) {
      const weightByDate: Record<string, number> = {};
      weightData.forEach(w => { weightByDate[getDateStr(w.recorded_at)] = w.value; });
      const sortedWeightDates = Object.keys(weightByDate).sort();

      // Calculate 7-day moving average for weight
      const weightAvgByDate: Record<string, number> = {};
      sortedWeightDates.forEach((date, i) => {
        const start = Math.max(0, i - 6);
        const window = sortedWeightDates.slice(start, i + 1).map(d => weightByDate[d]);
        weightAvgByDate[date] = window.reduce((a, b) => a + b, 0) / window.length;
      });

      const avgWeight = Object.values(weightAvgByDate).reduce((a, b) => a + b, 0) / Object.keys(weightAvgByDate).length;
      let higherWeightHRV: number[] = [];
      let lowerWeightHRV: number[] = [];

      Object.entries(hrvByDate).forEach(([date, hrv]) => {
        const weight = weightAvgByDate[date];
        if (!weight) return;
        if (weight > avgWeight * 1.02) {
          higherWeightHRV.push(hrv);
        } else if (weight < avgWeight * 0.98) {
          lowerWeightHRV.push(hrv);
        }
      });

      if (higherWeightHRV.length >= 2 && lowerWeightHRV.length >= 2) {
        const highAvg = higherWeightHRV.reduce((a, b) => a + b, 0) / higherWeightHRV.length;
        const lowAvg = lowerWeightHRV.reduce((a, b) => a + b, 0) / lowerWeightHRV.length;
        if (lowAvg - highAvg > 4) {
          insights.push({
            type: 'correlation',
            title: 'Lower weight = higher HRV',
            description: `HRV is ${Math.round(lowAvg - highAvg)}ms higher when weight (7-day avg) is below average.`,
            confidence: 0.74,
            relatedMetrics: ['hrv', 'weight'],
          });
        }
      }
    }

    // HRV vs symptoms
    const symptoms = ctx.logs.filter(l => l.log_type === 'symptom');
    if (symptoms.length >= 5) {
      const symptomDays = new Set(symptoms.map(s => getDateStr(s.logged_at)));
      let symptomDayHRV: number[] = [];
      let noSymptomHRV: number[] = [];

      Object.entries(hrvByDate).forEach(([date, hrv]) => {
        if (symptomDays.has(date)) {
          symptomDayHRV.push(hrv);
        } else {
          noSymptomHRV.push(hrv);
        }
      });

      if (symptomDayHRV.length >= 2 && noSymptomHRV.length >= 2) {
        const symptomAvg = symptomDayHRV.reduce((a, b) => a + b, 0) / symptomDayHRV.length;
        const noSymptomAvg = noSymptomHRV.reduce((a, b) => a + b, 0) / noSymptomHRV.length;
        if (noSymptomAvg - symptomAvg > 4) {
          insights.push({
            type: 'correlation',
            title: 'Low HRV predicts symptoms',
            description: `HRV is ${Math.round(noSymptomAvg - symptomAvg)}ms lower on days with symptoms.`,
            confidence: 0.79,
            relatedMetrics: ['hrv', 'symptom'],
          });
        }
      }
    }

    // HRV vs weather
    if (ctx.weather.length >= 5) {
      const weatherByDate: Record<string, typeof ctx.weather[0]> = {};
      ctx.weather.forEach(w => { weatherByDate[w.date] = w; });

      const avgPressure = ctx.weather.reduce((s, w) => s + w.pressure_hpa, 0) / ctx.weather.length;
      let lowPressureHRV: number[] = [];
      let highPressureHRV: number[] = [];

      Object.entries(hrvByDate).forEach(([date, hrv]) => {
        const weather = weatherByDate[date];
        if (!weather) return;
        if (weather.pressure_hpa < avgPressure - 5) {
          lowPressureHRV.push(hrv);
        } else if (weather.pressure_hpa > avgPressure + 5) {
          highPressureHRV.push(hrv);
        }
      });

      if (lowPressureHRV.length >= 2 && highPressureHRV.length >= 2) {
        const lowAvg = lowPressureHRV.reduce((a, b) => a + b, 0) / lowPressureHRV.length;
        const highAvg = highPressureHRV.reduce((a, b) => a + b, 0) / highPressureHRV.length;
        if (highAvg - lowAvg > 4) {
          insights.push({
            type: 'correlation',
            title: 'Weather pressure affects HRV',
            description: `HRV is ${Math.round(highAvg - lowAvg)}ms lower on low-pressure days.`,
            confidence: 0.71,
            relatedMetrics: ['hrv', 'weather'],
          });
        }
      }
    }

    // HRV vs calories
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
        let deficitHRV: number[] = [];
        let surplusHRV: number[] = [];

        Object.entries(hrvByDate).forEach(([date, hrv]) => {
          const cal = caloriesByDate[date];
          if (!cal) return;
          if (cal < avgCal * 0.7) {
            deficitHRV.push(hrv);
          } else if (cal > avgCal * 1.3) {
            surplusHRV.push(hrv);
          }
        });

        if (deficitHRV.length >= 2 && surplusHRV.length >= 2) {
          const deficitAvg = deficitHRV.reduce((a, b) => a + b, 0) / deficitHRV.length;
          const surplusAvg = surplusHRV.reduce((a, b) => a + b, 0) / surplusHRV.length;
          if (Math.abs(deficitAvg - surplusAvg) > 4) {
            const better = deficitAvg > surplusAvg ? 'deficit' : 'surplus';
            insights.push({
              type: 'correlation',
              title: `Calorie ${better} boosts HRV`,
              description: `HRV is ${Math.round(Math.abs(deficitAvg - surplusAvg))}ms higher on ${better === 'deficit' ? 'low' : 'high'}-calorie days.`,
              confidence: 0.72,
              relatedMetrics: ['hrv', 'food', 'calories'],
            });
          }
        }
      }
    }
  }

  // Resting HR correlations
  if (hrData.length >= 5) {
    const hrByDate: Record<string, number> = {};
    hrData.forEach(h => {
      const date = getDateStr(h.recorded_at);
      if (!hrByDate[date] || h.value < hrByDate[date]) {
        hrByDate[date] = h.value; // Use lowest (resting)
      }
    });
    const avgHR = Object.values(hrByDate).reduce((s, h) => s + h, 0) / Object.values(hrByDate).length;

    // Resting HR vs symptoms
    const symptoms = ctx.logs.filter(l => l.log_type === 'symptom');
    if (symptoms.length >= 5) {
      const symptomsByDate: Record<string, number> = {};
      symptoms.forEach(s => {
        const date = getDateStr(s.logged_at);
        symptomsByDate[date] = (symptomsByDate[date] || 0) + 1;
      });

      let highHRSymptoms: number[] = [];
      let lowHRSymptoms: number[] = [];

      Object.entries(hrByDate).forEach(([date, hr]) => {
        const symptomCount = symptomsByDate[date] || 0;
        if (hr > avgHR * 1.1) {
          highHRSymptoms.push(symptomCount);
        } else if (hr < avgHR * 0.9) {
          lowHRSymptoms.push(symptomCount);
        }
      });

      if (highHRSymptoms.length >= 2 && lowHRSymptoms.length >= 2) {
        const highAvg = highHRSymptoms.reduce((a, b) => a + b, 0) / highHRSymptoms.length;
        const lowAvg = lowHRSymptoms.reduce((a, b) => a + b, 0) / lowHRSymptoms.length;
        if (highAvg - lowAvg > 0.3) {
          insights.push({
            type: 'correlation',
            title: 'High HR correlates with symptoms',
            description: `You report ${Math.round((highAvg - lowAvg) / (lowAvg || 1) * 100)}% more symptoms on elevated HR days.`,
            confidence: 0.75,
            relatedMetrics: ['heart_rate', 'symptom'],
          });
        }
      }
    }

    // Resting HR vs sleep debt
    const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
    if (sleepData.length >= 7) {
      // Calculate rolling 7-day sleep avg
      const sleepByDate: Record<string, number> = {};
      sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

      let sleepDebtHR: number[] = [];
      let wellRestedHR: number[] = [];

      const sortedDates = Object.keys(sleepByDate).sort();
      sortedDates.forEach((date, i) => {
        if (i < 3) return; // Need some history
        const recentSleep = sortedDates.slice(Math.max(0, i - 3), i).map(d => sleepByDate[d]).filter(Boolean);
        if (recentSleep.length < 2) return;
        const avgRecent = recentSleep.reduce((a, b) => a + b, 0) / recentSleep.length;
        const hr = hrByDate[date];
        if (!hr) return;

        if (avgRecent < 6.5) {
          sleepDebtHR.push(hr);
        } else if (avgRecent >= 7.5) {
          wellRestedHR.push(hr);
        }
      });

      if (sleepDebtHR.length >= 2 && wellRestedHR.length >= 2) {
        const debtAvg = sleepDebtHR.reduce((a, b) => a + b, 0) / sleepDebtHR.length;
        const restedAvg = wellRestedHR.reduce((a, b) => a + b, 0) / wellRestedHR.length;
        if (debtAvg - restedAvg > 3) {
          insights.push({
            type: 'correlation',
            title: 'Sleep debt raises resting HR',
            description: `Your resting HR is ${Math.round(debtAvg - restedAvg)} bpm higher when sleep-deprived.`,
            confidence: 0.80,
            relatedMetrics: ['heart_rate', 'sleep'],
          });
        }
      }
    }

    // Overtraining detection
    const exercises = ctx.logs.filter(l => l.log_type === 'exercise');
    if (exercises.length >= 5) {
      const exerciseByDate: Record<string, number> = {};
      exercises.forEach(e => {
        const date = getDateStr(e.logged_at);
        exerciseByDate[date] = (exerciseByDate[date] || 0) + 1;
      });

      // Check consecutive workout days
      const sortedDates = Object.keys(exerciseByDate).sort();
      let consecutiveDays = 0;
      let maxConsecutive = 0;

      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diff = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
        if (diff === 1) {
          consecutiveDays++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
        } else {
          consecutiveDays = 0;
        }
      }

      if (maxConsecutive >= 5) {
        // Check if HR is trending up
        const recentHR = Object.entries(hrByDate).slice(-7).map(([_, hr]) => hr);
        if (recentHR.length >= 5) {
          const firstHalf = recentHR.slice(0, Math.floor(recentHR.length / 2));
          const secondHalf = recentHR.slice(Math.floor(recentHR.length / 2));
          const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
          if (secondAvg - firstAvg > 3) {
            insights.push({
              type: 'recommendation',
              title: 'Possible overtraining',
              description: `${maxConsecutive + 1} consecutive workout days with rising resting HR. Consider a rest day.`,
              confidence: 0.78,
              relatedMetrics: ['heart_rate', 'exercise'],
            });
          }
        }
      }
    }

    // Resting HR vs weight (using 7-day moving average)
    const weightData = ctx.metrics.filter(m => m.metric_type === 'weight');
    if (weightData.length >= 7) {
      const weightByDate: Record<string, number> = {};
      weightData.forEach(w => { weightByDate[getDateStr(w.recorded_at)] = w.value; });
      const sortedWeightDates = Object.keys(weightByDate).sort();

      // Calculate 7-day moving average for weight
      const weightAvgByDate: Record<string, number> = {};
      sortedWeightDates.forEach((date, i) => {
        const start = Math.max(0, i - 6);
        const window = sortedWeightDates.slice(start, i + 1).map(d => weightByDate[d]);
        weightAvgByDate[date] = window.reduce((a, b) => a + b, 0) / window.length;
      });

      const avgWeight = Object.values(weightAvgByDate).reduce((a, b) => a + b, 0) / Object.keys(weightAvgByDate).length;
      let higherWeightHR: number[] = [];
      let lowerWeightHR: number[] = [];

      Object.entries(hrByDate).forEach(([date, hr]) => {
        const weight = weightAvgByDate[date];
        if (!weight) return;
        if (weight > avgWeight * 1.02) {
          higherWeightHR.push(hr);
        } else if (weight < avgWeight * 0.98) {
          lowerWeightHR.push(hr);
        }
      });

      if (higherWeightHR.length >= 2 && lowerWeightHR.length >= 2) {
        const highAvg = higherWeightHR.reduce((a, b) => a + b, 0) / higherWeightHR.length;
        const lowAvg = lowerWeightHR.reduce((a, b) => a + b, 0) / lowerWeightHR.length;
        if (highAvg - lowAvg > 2) {
          insights.push({
            type: 'correlation',
            title: 'Weight affects resting HR',
            description: `Resting HR is ${Math.round(highAvg - lowAvg)} bpm higher when weight (7-day avg) is elevated.`,
            confidence: 0.77,
            relatedMetrics: ['heart_rate', 'weight'],
          });
        }
      }
    }
  }

  return insights;
}