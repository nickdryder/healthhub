import { AnalyzedInsight, AnalysisContext, getDateStr } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeMedicationCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  if (ctx.medications.length < 5) return insights;

  const medByDate: Record<string, boolean> = {};
  ctx.medications.forEach(m => { medByDate[getDateStr(m.logged_at)] = m.took_medication; });

  let daysWithMed = 0, daysWithoutMed = 0;
  Object.values(medByDate).forEach(took => {
    if (took) daysWithMed++;
    else daysWithoutMed++;
  });

  // Adherence rate
  const adherenceRate = daysWithMed / (daysWithMed + daysWithoutMed);
  if (adherenceRate < 0.7 && ctx.medications.length >= 7) {
    insights.push({
      type: 'recommendation',
      title: 'Medication consistency',
      description: `You've taken medication ${Math.round(adherenceRate * 100)}% of logged days. Try setting a daily reminder.`,
      confidence: 0.82,
      relatedMetrics: ['medication'],
    });
  } else if (adherenceRate >= 0.9 && ctx.medications.length >= 7) {
    insights.push({
      type: 'recommendation',
      title: 'Great medication habits!',
      description: `${Math.round(adherenceRate * 100)}% adherence rate. Keep it up!`,
      confidence: 0.90,
      relatedMetrics: ['medication'],
    });
  }

  // Symptoms when medication is missed
  const symptoms = ctx.logs.filter(l => l.log_type === 'symptom');
  if (symptoms.length >= 5) {
    const symptomsByDate: Record<string, string[]> = {};
    symptoms.forEach(s => {
      const date = getDateStr(s.logged_at);
      if (!symptomsByDate[date]) symptomsByDate[date] = [];
      symptomsByDate[date].push(s.value.toLowerCase());
    });

    const symptomsByMedStatus: Record<string, { withMed: number; withoutMed: number }> = {};

    Object.entries(symptomsByDate).forEach(([date, syms]) => {
      const tookMed = medByDate[date];
      if (tookMed === undefined) return;

      syms.forEach(sym => {
        if (!symptomsByMedStatus[sym]) symptomsByMedStatus[sym] = { withMed: 0, withoutMed: 0 };
        if (tookMed) symptomsByMedStatus[sym].withMed++;
        else symptomsByMedStatus[sym].withoutMed++;
      });
    });

    for (const [symptom, counts] of Object.entries(symptomsByMedStatus)) {
      if (counts.withoutMed < 2) continue;
      const rateWithMed = daysWithMed > 0 ? counts.withMed / daysWithMed : 0;
      const rateWithoutMed = daysWithoutMed > 0 ? counts.withoutMed / daysWithoutMed : 0;

      if (rateWithoutMed > rateWithMed * 1.5 && counts.withoutMed >= 2) {
        const increase = rateWithMed > 0 ? Math.round(((rateWithoutMed - rateWithMed) / rateWithMed) * 100) : 100;
        insights.push({
          type: 'correlation',
          title: `${symptom.charAt(0).toUpperCase() + symptom.slice(1)} linked to missed meds`,
          description: `You report ${symptom} ${increase}% more on days you skip medication.`,
          confidence: Math.min(0.88, 0.68 + (counts.withoutMed / 10) * 0.2),
          relatedMetrics: ['symptom', 'medication'],
        });
        break; // Only show one symptom correlation
      }
    }
  }

  // Sleep impact when medication missed
  const sleepData = ctx.metrics.filter(m => m.metric_type === 'sleep');
  if (sleepData.length >= 5 && daysWithoutMed >= 2) {
    const sleepByDate: Record<string, number> = {};
    sleepData.forEach(s => { sleepByDate[getDateStr(s.recorded_at)] = s.value; });

    let sleepWithMed: number[] = [];
    let sleepWithoutMed: number[] = [];

    Object.entries(medByDate).forEach(([date, took]) => {
      const sleep = sleepByDate[date];
      if (!sleep) return;
      if (took) sleepWithMed.push(sleep);
      else sleepWithoutMed.push(sleep);
    });

    if (sleepWithMed.length >= 2 && sleepWithoutMed.length >= 2) {
      const withAvg = sleepWithMed.reduce((a, b) => a + b, 0) / sleepWithMed.length;
      const withoutAvg = sleepWithoutMed.reduce((a, b) => a + b, 0) / sleepWithoutMed.length;
      if (withAvg - withoutAvg > 0.5) {
        insights.push({
          type: 'correlation',
          title: 'Medication affects sleep',
          description: `You sleep ${(withAvg - withoutAvg).toFixed(1)}h less on days you miss medication.`,
          confidence: 0.79,
          relatedMetrics: ['medication', 'sleep'],
        });
      }
    }
  }

  // HRV impact
  const hrvData = ctx.metrics.filter(m => m.metric_type === 'hrv');
  if (hrvData.length >= 5 && daysWithoutMed >= 2) {
    const hrvByDate: Record<string, number> = {};
    hrvData.forEach(h => { hrvByDate[getDateStr(h.recorded_at)] = h.value; });

    let hrvWithMed: number[] = [];
    let hrvWithoutMed: number[] = [];

    Object.entries(medByDate).forEach(([date, took]) => {
      const hrv = hrvByDate[date];
      if (!hrv) return;
      if (took) hrvWithMed.push(hrv);
      else hrvWithoutMed.push(hrv);
    });

    if (hrvWithMed.length >= 2 && hrvWithoutMed.length >= 2) {
      const withAvg = hrvWithMed.reduce((a, b) => a + b, 0) / hrvWithMed.length;
      const withoutAvg = hrvWithoutMed.reduce((a, b) => a + b, 0) / hrvWithoutMed.length;
      if (withAvg - withoutAvg > 5) {
        insights.push({
          type: 'correlation',
          title: 'Medication impacts HRV',
          description: `Your HRV is ${Math.round(withAvg - withoutAvg)}ms lower when medication is skipped.`,
          confidence: 0.76,
          relatedMetrics: ['medication', 'hrv'],
        });
      }
    }
  }

  // Medication timing patterns - TIMEZONE-AWARE
  if (ctx.medications.length >= 3) {
    const medicationByHour: Record<number, string[]> = {};
    ctx.medications.forEach(m => {
      const hour = getHourInTimezone(m.logged_at, ctx.userTimezone);
      if (!medicationByHour[hour]) medicationByHour[hour] = [];
      medicationByHour[hour].push(m.value);
    });

    const morningMeds = Object.entries(medicationByHour)
      .filter(([h]) => parseInt(h) >= 6 && parseInt(h) < 12)
      .map(([, meds]) => meds)
      .flat();

    const eveningMeds = Object.entries(medicationByHour)
      .filter(([h]) => parseInt(h) >= 18)
      .map(([, meds]) => meds)
      .flat();

    console.log(`[Medication Timing] Morning meds: ${morningMeds.length}, Evening meds: ${eveningMeds.length}`);
  }
  return insights;
}