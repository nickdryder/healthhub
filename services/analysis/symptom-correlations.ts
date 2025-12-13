import { AnalyzedInsight, AnalysisContext, getDateStr } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeSymptomCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const symptoms = ctx.logs.filter(l => l.log_type === 'symptom');
  if (symptoms.length < 3) return insights;

  const symptomsByDate: Record<string, string[]> = {};
  symptoms.forEach(s => {
    const date = getDateStr(s.logged_at);
    if (!symptomsByDate[date]) symptomsByDate[date] = [];
    symptomsByDate[date].push(s.value.toLowerCase());
  });

  // Most common symptom with frequency breakdown
  const symptomCounts: Record<string, number> = {};
  symptoms.forEach(s => { symptomCounts[s.value] = (symptomCounts[s.value] || 0) + 1; });
  const mostCommon = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0];
  if (mostCommon && mostCommon[1] >= 3) {
    const frequency = ((mostCommon[1] / symptoms.length) * 100).toFixed(0);
    insights.push({
      type: 'correlation',
      title: `Recurring ${mostCommon[0]}`,
      description: `You've logged ${mostCommon[0]} ${mostCommon[1]} times (${frequency}% of all symptoms). Common triggers: sleep, stress, diet. Review your notes for patterns.`,
      confidence: 0.75,
      relatedMetrics: ['symptom'],
    });
  }

  // Day of week pattern with specific symptom breakdown
  const dayCount: Record<number, number> = {};
  const daySymptomsMap: Record<number, string[]> = {};
  symptoms.forEach(s => {
    const day = new Date(s.logged_at).getDay();
    dayCount[day] = (dayCount[day] || 0) + 1;
    if (!daySymptomsMap[day]) daySymptomsMap[day] = [];
    daySymptomsMap[day].push(s.value.toLowerCase());
  });
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const maxDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
  if (maxDay && maxDay[1] >= 3) {
    const dayNum = parseInt(maxDay[0]);
    const daySymptoms = daySymptomsMap[dayNum] || [];
    const symptomsOnDay: Record<string, number> = {};
    daySymptoms.forEach(s => { symptomsOnDay[s] = (symptomsOnDay[s] || 0) + 1; });
    const topSymptom = Object.entries(symptomsOnDay).sort((a, b) => b[1] - a[1])[0];
    const symptomDetail = topSymptom ? ` (mainly ${topSymptom[0]})` : '';
    insights.push({
      type: 'correlation',
      title: `${dayNames[dayNum]}s trigger symptoms${symptomDetail}`,
      description: `You report symptoms on ${dayNames[dayNum]}s ${maxDay[1]} times${topSymptom ? ` - most often ${topSymptom[0]} (${topSymptom[1]} times)` : ''}. Consider work stress, social plans, or routine changes on this day.`,
      confidence: 0.74,
      relatedMetrics: ['symptom'],
    });
  }

  // Symptoms vs supplements
  const supplements = ctx.logs.filter(l => l.log_type === 'supplement');
  if (supplements.length >= 5) {
    const supplementDates = new Set(supplements.map(s => getDateStr(s.logged_at)));
    let withSupp = 0, withoutSupp = 0;
    let suppDays = 0, noSuppDays = 0;

    Object.entries(symptomsByDate).forEach(([date, syms]) => {
      if (supplementDates.has(date)) {
        withSupp += syms.length;
        suppDays++;
      } else {
        withoutSupp += syms.length;
        noSuppDays++;
      }
    });

    if (suppDays >= 2 && noSuppDays >= 2) {
      const suppAvg = withSupp / suppDays;
      const noSuppAvg = withoutSupp / noSuppDays;
      if (noSuppAvg - suppAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'Supplements may reduce symptoms',
          description: `You report ${Math.round((noSuppAvg - suppAvg) / (suppAvg || 1) * 100)}% fewer symptoms on days you take supplements.`,
          confidence: 0.73,
          relatedMetrics: ['symptom', 'supplement'],
        });
      }
    }
  }

  // Symptoms vs sleep duration
  const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
  if (sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let poorSleepSymptoms = 0, poorDays = 0;
    let goodSleepSymptoms = 0, goodDays = 0;

    Object.entries(sleepByDate).forEach(([date, sleep]) => {
      const daySymptoms = symptomsByDate[date]?.length || 0;
      if (sleep < 6) {
        poorSleepSymptoms += daySymptoms;
        poorDays++;
      } else if (sleep >= 7.5) {
        goodSleepSymptoms += daySymptoms;
        goodDays++;
      }
    });

    if (poorDays >= 2 && goodDays >= 2) {
      const poorAvg = poorSleepSymptoms / poorDays;
      const goodAvg = goodSleepSymptoms / goodDays;
      if (poorAvg - goodAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'Poor sleep = more symptoms',
          description: `You report ${Math.round((poorAvg - goodAvg) / (goodAvg || 1) * 100)}% more symptoms after <6h sleep.`,
          confidence: 0.81,
          relatedMetrics: ['symptom', 'sleep'],
        });
      }
    }
  }

  // Symptoms vs food tags
  if (ctx.foods.length >= 5) {
    const dairyDates = new Set(ctx.foods.filter(f => f.contains_dairy).map(f => getDateStr(f.logged_at)));
    const glutenDates = new Set(ctx.foods.filter(f => f.contains_gluten).map(f => getDateStr(f.logged_at)));

    // Dairy correlation
    let dairySymptoms = 0, dairyDays = 0;
    let noDairySymptoms = 0, noDairyDays = 0;

    Object.entries(symptomsByDate).forEach(([date, syms]) => {
      if (dairyDates.has(date)) {
        dairySymptoms += syms.length;
        dairyDays++;
      } else {
        noDairySymptoms += syms.length;
        noDairyDays++;
      }
    });

    if (dairyDays >= 2 && noDairyDays >= 2) {
      const dairyAvg = dairySymptoms / dairyDays;
      const noDairyAvg = noDairySymptoms / noDairyDays;
      if (dairyAvg - noDairyAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'Dairy may trigger symptoms',
          description: `You report ${Math.round((dairyAvg - noDairyAvg) / (noDairyAvg || 1) * 100)}% more symptoms on dairy days.`,
          confidence: 0.76,
          relatedMetrics: ['symptom', 'food', 'dairy'],
        });
      }
    }

    // Gluten correlation
    let glutenSymptoms = 0, glutenDays = 0;
    let noGlutenSymptoms = 0, noGlutenDays = 0;

    Object.entries(symptomsByDate).forEach(([date, syms]) => {
      if (glutenDates.has(date)) {
        glutenSymptoms += syms.length;
        glutenDays++;
      } else {
        noGlutenSymptoms += syms.length;
        noGlutenDays++;
      }
    });

    if (glutenDays >= 2 && noGlutenDays >= 2) {
      const glutenAvg = glutenSymptoms / glutenDays;
      const noGlutenAvg = noGlutenSymptoms / noGlutenDays;
      if (glutenAvg - noGlutenAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'Gluten may trigger symptoms',
          description: `You report ${Math.round((glutenAvg - noGlutenAvg) / (noGlutenAvg || 1) * 100)}% more symptoms on gluten days.`,
          confidence: 0.74,
          relatedMetrics: ['symptom', 'food', 'gluten'],
        });
      }
    }
  }

  // Symptoms vs bristol (gut-symptom correlation)
  const bristolLogs = ctx.logs.filter(l => l.log_type === 'bristol_stool');
  if (bristolLogs.length >= 5) {
    const bristolByDate: Record<string, number[]> = {};
    bristolLogs.forEach(b => {
      const date = getDateStr(b.logged_at);
      const type = parseInt(b.value.replace('Type ', '')) || 4;
      if (!bristolByDate[date]) bristolByDate[date] = [];
      bristolByDate[date].push(type);
    });

    let abnormalGutSymptoms: string[] = [];
    let abnormalDays = 0;
    let normalGutSymptoms: string[] = [];
    let normalDays = 0;

    Object.entries(bristolByDate).forEach(([date, types]) => {
      const avgType = types.reduce((a, b) => a + b, 0) / types.length;
      const daySymptoms = symptomsByDate[date] || [];
      // Normal is 3-4, abnormal is <3 or >5
      if (avgType < 3 || avgType > 5) {
        abnormalGutSymptoms.push(...daySymptoms);
        abnormalDays++;
      } else {
        normalGutSymptoms.push(...daySymptoms);
        normalDays++;
      }
    });

    if (abnormalDays >= 2 && normalDays >= 2) {
      const abnormalAvg = abnormalGutSymptoms.length / abnormalDays;
      const normalAvg = normalGutSymptoms.length / normalDays;
      if (abnormalAvg - normalAvg > 0.3) {
        // Find the most common symptom on abnormal gut days
        const symptomCounts: Record<string, number> = {};
        abnormalGutSymptoms.forEach(s => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
        const topSymptoms = Object.entries(symptomCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([sym]) => sym);

        const symptomList = topSymptoms.length > 0 
          ? topSymptoms.join(', ') 
          : 'various symptoms';

        insights.push({
          type: 'correlation',
          title: 'Gut issues linked to symptoms',
          description: `Abnormal digestion correlates with ${topSymptoms.length > 0 ? `${symptomList}` : 'more symptoms'}. Days with Bristol <3 or >5 have ${Math.round((abnormalAvg - normalAvg) / (normalAvg || 1) * 100)}% more reports.`,
          confidence: 0.77,
          relatedMetrics: ['symptom', 'bristol'],
        });
      }
    }
  }

  // Symptoms vs calendar categories
  if (ctx.events.length >= 5) {
    const eventsByDate: Record<string, number> = {};
    ctx.events.filter(e => !e.title.toLowerCase().startsWith('[auto]')).forEach(e => {
      const date = getDateStr(e.start_time);
      eventsByDate[date] = (eventsByDate[date] || 0) + 1;
    });

    let busyDaySymptoms = 0, busyDays = 0;
    let calmDaySymptoms = 0, calmDays = 0;

    Object.entries(eventsByDate).forEach(([date, count]) => {
      const daySymptoms = symptomsByDate[date]?.length || 0;
      if (count >= 4) {
        busyDaySymptoms += daySymptoms;
        busyDays++;
      } else if (count <= 1) {
        calmDaySymptoms += daySymptoms;
        calmDays++;
      }
    });

    if (busyDays >= 2 && calmDays >= 2) {
      const busyAvg = busyDaySymptoms / busyDays;
      const calmAvg = calmDaySymptoms / calmDays;
      if (busyAvg - calmAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'Busy days trigger symptoms',
          description: `You report ${Math.round((busyAvg - calmAvg) / (calmAvg || 1) * 100)}% more symptoms on days with 4+ events.`,
          confidence: 0.75,
          relatedMetrics: ['symptom', 'calendar'],
        });
      }
    }
  }

  // Symptoms vs calorie deficit
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
      let lowCalSymptoms = 0, lowDays = 0;
      let normalCalSymptoms = 0, normalDays = 0;

      Object.entries(caloriesByDate).forEach(([date, cal]) => {
        const daySymptoms = symptomsByDate[date]?.length || 0;
        if (cal < avgCal * 0.7) {
          lowCalSymptoms += daySymptoms;
          lowDays++;
        } else if (cal >= avgCal * 0.9 && cal <= avgCal * 1.1) {
          normalCalSymptoms += daySymptoms;
          normalDays++;
        }
      });

      if (lowDays >= 2 && normalDays >= 2) {
        const lowAvg = lowCalSymptoms / lowDays;
        const normalAvg = normalCalSymptoms / normalDays;
        if (lowAvg - normalAvg > 0.3) {
          insights.push({
            type: 'correlation',
            title: 'Under-eating triggers symptoms',
            description: `Low-calorie days correlate with ${Math.round((lowAvg - normalAvg) / (normalAvg || 1) * 100)}% more symptoms.`,
            confidence: 0.72,
            relatedMetrics: ['symptom', 'food', 'calories'],
          });
        }
      }
    }
  }

  // Low sleep vs symptoms (already have sleep vs symptoms, but emphasize LOW sleep)
  if (sleepData.length >= 5) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.logged_at)] = s.value; });

    let veryLowSleepSymptoms = 0, veryLowDays = 0;
    let normalSleepSymptoms = 0, normalDays = 0;

    Object.entries(sleepByDate).forEach(([date, sleep]) => {
      const daySymptoms = symptomsByDate[date]?.length || 0;
      if (sleep < 5) {
        veryLowSleepSymptoms += daySymptoms;
        veryLowDays++;
      } else if (sleep >= 7 && sleep <= 9) {
        normalSleepSymptoms += daySymptoms;
        normalDays++;
      }
    });

    if (veryLowDays >= 2 && normalDays >= 2) {
      const lowAvg = veryLowSleepSymptoms / veryLowDays;
      const normalAvg = normalSleepSymptoms / normalDays;
      if (lowAvg - normalAvg > 0.5) {
        insights.push({
          type: 'correlation',
          title: 'Very low sleep spikes symptoms',
          description: `Days with <5h sleep have ${Math.round((lowAvg / (normalAvg || 1)) * 100 - 100)}% more symptoms.`,
          confidence: 0.83,
          relatedMetrics: ['symptom', 'sleep'],
        });
      }
    }
  }

  // Symptom clusters - symptoms that tend to occur on the same day
  if (symptoms.length >= 10) {
    const symptomPairs: Record<string, number> = {};
    const symptomTotals: Record<string, number> = {};

    Object.entries(symptomsByDate).forEach(([date, syms]) => {
      if (syms.length < 2) return;
      syms.forEach(s => { symptomTotals[s] = (symptomTotals[s] || 0) + 1; });
      // Count pairs
      for (let i = 0; i < syms.length; i++) {
        for (let j = i + 1; j < syms.length; j++) {
          const pair = [syms[i], syms[j]].sort().join('|');
          symptomPairs[pair] = (symptomPairs[pair] || 0) + 1;
        }
      }
    });

    // Find strongest cluster
    const pairEntries = Object.entries(symptomPairs).filter(([_, count]) => count >= 3);
    if (pairEntries.length > 0) {
      const [topPair, topCount] = pairEntries.sort((a, b) => b[1] - a[1])[0];
      const [sym1, sym2] = topPair.split('|');
      const sym1Total = symptomTotals[sym1] || 1;
      const coOccurRate = Math.round((topCount / sym1Total) * 100);

      if (coOccurRate >= 40) {
        insights.push({
          type: 'correlation',
          title: `${sym1} & ${sym2} cluster together`,
          description: `When you have ${sym1}, ${sym2} appears ${coOccurRate}% of the time (${topCount} days). This pattern suggests a common underlying trigger—try tracking what differs on days they both occur.`,
          confidence: 0.77,
          relatedMetrics: ['symptom'],
        });
      }
    }
  }

  // Steps vs symptoms
  const steps = ctx.metrics.filter(m => m.metric_type === 'steps');
  if (steps.length >= 5 && symptoms.length >= 5) {
    const stepsByDate: Record<string, number> = {};
    steps.forEach(s => { stepsByDate[getDateStr(s.recorded_at)] = s.value; });
    const avgSteps = steps.reduce((s, m) => s + m.value, 0) / steps.length;

    let lowStepsSymptoms = 0, lowStepDays = 0;
    let highStepsSymptoms = 0, highStepDays = 0;

    Object.entries(stepsByDate).forEach(([date, stepCount]) => {
      const daySymptoms = symptomsByDate[date]?.length || 0;
      if (stepCount < avgSteps * 0.6) {
        lowStepsSymptoms += daySymptoms;
        lowStepDays++;
      } else if (stepCount > avgSteps * 1.3) {
        highStepsSymptoms += daySymptoms;
        highStepDays++;
      }
    });

    if (lowStepDays >= 2 && highStepDays >= 2) {
      const lowAvg = lowStepsSymptoms / lowStepDays;
      const highAvg = highStepsSymptoms / highStepDays;
      if (lowAvg - highAvg > 0.3) {
        insights.push({
          type: 'correlation',
          title: 'Low activity days = more symptoms',
          description: `Sedentary days have ${Math.round((lowAvg - highAvg) / (highAvg || 1) * 100)}% more symptoms than active days.`,
          confidence: 0.76,
          relatedMetrics: ['symptom', 'steps'],
        });
      }
    }
  }

  // Calories vs symptoms (over AND under thresholds)
  if (ctx.foods.length >= 5 && symptoms.length >= 5) {
    const caloriesByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.calories) return;
      const date = getDateStr(f.logged_at);
      caloriesByDate[date] = (caloriesByDate[date] || 0) + f.calories;
    });

    const calDays = Object.values(caloriesByDate);
    if (calDays.length >= 5) {
      const avgCal = calDays.reduce((a, b) => a + b, 0) / calDays.length;

      // Symptoms by calorie category
      const symptomsByCal: Record<string, { dates: string[]; symptoms: string[] }> = {
        veryLow: { dates: [], symptoms: [] },
        low: { dates: [], symptoms: [] },
        normal: { dates: [], symptoms: [] },
        high: { dates: [], symptoms: [] },
        veryHigh: { dates: [], symptoms: [] },
      };

      Object.entries(caloriesByDate).forEach(([date, cal]) => {
        const daySymptoms = symptomsByDate[date] || [];
        if (cal < avgCal * 0.5) {
          symptomsByCal.veryLow.dates.push(date);
          symptomsByCal.veryLow.symptoms.push(...daySymptoms);
        } else if (cal < avgCal * 0.75) {
          symptomsByCal.low.dates.push(date);
          symptomsByCal.low.symptoms.push(...daySymptoms);
        } else if (cal <= avgCal * 1.25) {
          symptomsByCal.normal.dates.push(date);
          symptomsByCal.normal.symptoms.push(...daySymptoms);
        } else if (cal <= avgCal * 1.5) {
          symptomsByCal.high.dates.push(date);
          symptomsByCal.high.symptoms.push(...daySymptoms);
        } else {
          symptomsByCal.veryHigh.dates.push(date);
          symptomsByCal.veryHigh.symptoms.push(...daySymptoms);
        }
      });

      // Check undereating
      if (symptomsByCal.veryLow.dates.length >= 2 && symptomsByCal.normal.dates.length >= 2) {
        const veryLowAvg = symptomsByCal.veryLow.symptoms.length / symptomsByCal.veryLow.dates.length;
        const normalAvg = symptomsByCal.normal.symptoms.length / symptomsByCal.normal.dates.length;
        if (veryLowAvg - normalAvg > 0.4) {
          insights.push({
            type: 'correlation',
            title: 'Undereating triggers symptoms',
            description: `Days under ${Math.round(avgCal * 0.5)} cal have ${Math.round((veryLowAvg / (normalAvg || 1) - 1) * 100)}% more symptoms.`,
            confidence: 0.75,
            relatedMetrics: ['symptom', 'food', 'calories'],
          });
        }
      }

      // Check overeating
      if (symptomsByCal.veryHigh.dates.length >= 2 && symptomsByCal.normal.dates.length >= 2) {
        const veryHighAvg = symptomsByCal.veryHigh.symptoms.length / symptomsByCal.veryHigh.dates.length;
        const normalAvg = symptomsByCal.normal.symptoms.length / symptomsByCal.normal.dates.length;
        if (veryHighAvg - normalAvg > 0.4) {
          insights.push({
            type: 'correlation',
            title: 'Overeating triggers symptoms',
            description: `Days over ${Math.round(avgCal * 1.5)} cal have ${Math.round((veryHighAvg / (normalAvg || 1) - 1) * 100)}% more symptoms.`,
            confidence: 0.74,
            relatedMetrics: ['symptom', 'food', 'calories'],
          });
        }
      }
    }
  }

  // Symptoms vs supplement timing (morning vs evening supplements)
  if (supplements.length >= 5 && symptoms.length >= 5) {
    const morningSupps = new Set<string>();
    const eveningSupps = new Set<string>();

    supplements.forEach(s => {
      const date = getDateStr(s.logged_at);
      const hour = getHourInTimezone(s.logged_at, ctx.userTimezone);
      if (hour < 12) morningSupps.add(date);
      else if (hour >= 17) eveningSupps.add(date);
    });

    let morningSymptoms: string[] = [];
    let eveningSymptoms: string[] = [];

    symptoms.forEach(sym => {
      const date = getDateStr(sym.logged_at);
      if (morningSupps.has(date)) {
        morningSymptoms.push(sym.value);
      } else if (eveningSupps.has(date)) {
        eveningSymptoms.push(sym.value);
      }
    });

    if (morningSymptoms.length >= 3 && eveningSymptoms.length >= 3) {
      const morningSymptomCount = morningSymptoms.length;
      const eveningSymptomCount = eveningSymptoms.length;

      if (eveningSymptomCount > morningSymptomCount * 1.3) {
        insights.push({
          type: 'correlation',
          title: 'Evening supplements trigger symptoms',
          description: `You report ${Math.round((eveningSymptomCount / morningSymptomCount - 1) * 100)}% more symptoms on days with evening supplements.`,
          confidence: 0.72,
          relatedMetrics: ['symptom', 'supplement'],
        });
      }
    }
  }

  // Symptoms vs local weather
  if (ctx.weather.length >= 5 && symptoms.length >= 5) {
    const weatherByDate: Record<string, typeof ctx.weather[0]> = {};
    ctx.weather.forEach(w => { weatherByDate[w.date] = w; });

    // Pressure correlations
    const avgPressure = ctx.weather.reduce((s, w) => s + w.pressure_hpa, 0) / ctx.weather.length;
    let lowPressureSymptoms = 0, lowPressureDays = 0;
    let highPressureSymptoms = 0, highPressureDays = 0;

    Object.entries(weatherByDate).forEach(([date, weather]) => {
      const daySymptoms = symptomsByDate[date]?.length || 0;
      if (weather.pressure_hpa < avgPressure - 5) {
        lowPressureSymptoms += daySymptoms;
        lowPressureDays++;
      } else if (weather.pressure_hpa > avgPressure + 5) {
        highPressureSymptoms += daySymptoms;
        highPressureDays++;
      }
    });

    if (lowPressureDays >= 2 && highPressureDays >= 2) {
      const lowAvg = lowPressureSymptoms / lowPressureDays;
      const highAvg = highPressureSymptoms / highPressureDays;
      if (lowAvg - highAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'Low pressure triggers symptoms',
          description: `You report ${Math.round((lowAvg - highAvg) / (highAvg || 1) * 100)}% more symptoms on low-pressure days.`,
          confidence: 0.73,
          relatedMetrics: ['symptom', 'weather'],
        });
      }
    }

    // Humidity correlations
    const avgHumidity = ctx.weather.reduce((s, w) => s + w.humidity_avg, 0) / ctx.weather.length;
    let highHumiditySymptoms = 0, highHumidityDays = 0;
    let lowHumiditySymptoms = 0, lowHumidityDays = 0;

    Object.entries(weatherByDate).forEach(([date, weather]) => {
      const daySymptoms = symptomsByDate[date]?.length || 0;
      if (weather.humidity_avg > avgHumidity + 10) {
        highHumiditySymptoms += daySymptoms;
        highHumidityDays++;
      } else if (weather.humidity_avg < avgHumidity - 10) {
        lowHumiditySymptoms += daySymptoms;
        lowHumidityDays++;
      }
    });

    if (highHumidityDays >= 2 && lowHumidityDays >= 2) {
      const highAvg = highHumiditySymptoms / highHumidityDays;
      const lowAvg = lowHumiditySymptoms / lowHumidityDays;
      if (highAvg - lowAvg > 0.4) {
        insights.push({
          type: 'correlation',
          title: 'High humidity worsens symptoms',
          description: `Humid days have ${Math.round((highAvg - lowAvg) / (lowAvg || 1) * 100)}% more symptoms.`,
          confidence: 0.71,
          relatedMetrics: ['symptom', 'weather'],
        });
      }
    }
  }
  return insights;
}